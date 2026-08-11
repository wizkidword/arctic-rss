function packageNameFromLockPath(lockPath) {
  const nodeModulesIndex = lockPath.lastIndexOf("node_modules/");
  if (nodeModulesIndex === -1) {
    return null;
  }

  const packagePath = lockPath.slice(nodeModulesIndex + "node_modules/".length);
  const segments = packagePath.split("/");
  return segments[0]?.startsWith("@")
    ? segments.length >= 2
      ? `${segments[0]}/${segments[1]}`
      : null
    : segments[0] || null;
}

// These packages are installed to configure, prebuild, bundle, or inspect the
// Android app. They are not included in the JavaScript bundle shipped to a
// reader, even when Expo declares them as regular npm dependencies.
const MOBILE_BUILD_TOOL_PACKAGES = new Set([
  "@expo/cli",
  "@expo/config",
  "@expo/config-plugins",
  "@expo/devtools",
  "@expo/fingerprint",
  "@expo/local-build-cache-provider",
  "@expo/metro",
  "@expo/metro-config",
  "@expo/prebuild-config",
  "@react-native/community-cli-plugin",
  "@react-native/gradle-plugin",
  "expo-modules-autolinking",
  "metro",
  "metro-config",
  "metro-transform-worker",
]);

function dependencyNames(metadata) {
  const requiredPeers = Object.keys(metadata.peerDependencies ?? {}).filter(
    (dependencyName) => metadata.peerDependenciesMeta?.[dependencyName]?.optional !== true,
  );
  return [
    ...Object.keys(metadata.dependencies ?? {}).map((dependencyName) => ({ dependencyName, optional: false })),
    ...Object.keys(metadata.optionalDependencies ?? {}).map((dependencyName) => ({ dependencyName, optional: true })),
    ...requiredPeers.map((dependencyName) => ({ dependencyName, optional: true })),
  ];
}

function workspacePathsByName(packages) {
  return new Map(
    Object.entries(packages)
      .filter(([, metadata]) => metadata?.name && !metadata?.link)
      .map(([lockPath, metadata]) => [metadata.name, lockPath]),
  );
}

function resolveLinkedPackage(packages, lockPath) {
  const metadata = packages[lockPath];
  return metadata?.link && typeof metadata.resolved === "string" && packages[metadata.resolved]
    ? metadata.resolved
    : lockPath;
}

function resolveDependencyLockPath(packages, workspaceByName, parentPath, dependencyName) {
  let currentPath = parentPath;
  while (true) {
    const candidate = currentPath
      ? `${currentPath}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (packages[candidate]) {
      return resolveLinkedPackage(packages, candidate);
    }
    if (!currentPath) {
      return workspaceByName.get(dependencyName) ?? null;
    }
    const nestedNodeModulesIndex = currentPath.lastIndexOf("/node_modules/");
    currentPath =
      nestedNodeModulesIndex === -1 ? "" : currentPath.slice(0, nestedNodeModulesIndex);
  }
}

function strongestReachability(current, next) {
  return current === "runtime" || next === "runtime" ? "runtime" : "build";
}

export function createMobileDependencyGraph(lockfile) {
  const packages = lockfile.packages ?? {};
  const mobilePackage = packages["apps/mobile"];
  if (!mobilePackage) {
    throw new Error("package-lock.json does not contain the mobile workspace.");
  }
  const workspaceByName = workspacePathsByName(packages);
  const pending = [
    ...Object.keys(mobilePackage.dependencies ?? {}).map((dependencyName) => ({
      dependencyName,
      parentPath: "apps/mobile",
      reachability: "runtime",
    })),
    ...Object.keys(mobilePackage.devDependencies ?? {}).map((dependencyName) => ({
      dependencyName,
      parentPath: "apps/mobile",
      reachability: "build",
    })),
  ];
  const reachabilityByPath = new Map();

  while (pending.length > 0) {
    const { dependencyName, optional, parentPath, reachability } = pending.pop();
    const lockPath = resolveDependencyLockPath(
      packages,
      workspaceByName,
      parentPath,
      dependencyName,
    );
    if (!lockPath) {
      if (optional) {
        continue;
      }
      throw new Error(`The mobile dependency ${dependencyName} cannot be resolved from ${parentPath}.`);
    }
    const existingReachability = reachabilityByPath.get(lockPath);
    const nextReachability = strongestReachability(existingReachability, reachability);
    if (existingReachability === nextReachability) {
      continue;
    }
    reachabilityByPath.set(lockPath, nextReachability);
    const metadata = packages[lockPath];
    for (const childDependency of dependencyNames(metadata)) {
      pending.push({
        ...childDependency,
        parentPath: lockPath,
        reachability:
          nextReachability === "runtime" && MOBILE_BUILD_TOOL_PACKAGES.has(childDependency.dependencyName)
            ? "build"
            : nextReachability,
      });
    }
  }

  return [...reachabilityByPath.entries()]
    .map(([lockPath, reachability]) => {
      const metadata = packages[lockPath];
      const packageName = packageNameFromLockPath(lockPath);
      return {
        integrity: typeof metadata.integrity === "string" ? metadata.integrity : null,
        license: typeof metadata.license === "string" ? metadata.license : null,
        lockPath,
        name: packageName ?? metadata.name ?? null,
        reachability,
        resolved: typeof metadata.resolved === "string" ? metadata.resolved : null,
        version: typeof metadata.version === "string" ? metadata.version : null,
      };
    })
    .sort((left, right) => left.lockPath.localeCompare(right.lockPath));
}

export function createMobileAdvisoryPayload(graph) {
  const versionsByPackage = new Map();
  for (const component of graph) {
    if (!component.name || !component.version || component.lockPath.startsWith("packages/")) {
      continue;
    }
    const versions = versionsByPackage.get(component.name) ?? new Set();
    versions.add(component.version);
    versionsByPackage.set(component.name, versions);
  }
  return Object.fromEntries(
    [...versionsByPackage.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([packageName, versions]) => [packageName, [...versions].sort()]),
  );
}

export function componentPackageUrl(component) {
  const encodedName = component.name?.startsWith("@")
    ? component.name.replace("/", "%2F")
    : component.name;
  return component.name && component.version ? `pkg:npm/${encodedName}@${component.version}` : null;
}
