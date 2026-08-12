const endpoints = [
  { method: "GET", path: "/api/mobile/authorize" },
  { method: "POST", path: "/api/v1/device-authorizations/exchange" },
  { method: "POST", path: "/api/v1/device-sessions/refresh" },
];

try {
  const origin = parseOrigin(process.argv.slice(2));
  let failed = false;
  for (const endpoint of endpoints) {
    const response = await fetch(new URL(endpoint.path, origin), {
      headers: endpoint.method === "POST" ? { "Content-Type": "application/json" } : {},
      method: endpoint.method,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    }).catch((error) => {
      failed = true;
      console.error(`${endpoint.method} ${endpoint.path}: request failed (${safeErrorCategory(error)})`);
      return null;
    });

    if (!response) {
      continue;
    }

    const noStore = response.headers.get("cache-control")?.toLowerCase().includes("no-store") === true;
    const passed = response.status === 404 && noStore;
    console.log(`${endpoint.method} ${endpoint.path}: status=${response.status} no_store=${noStore}`);
    if (!passed) {
      failed = true;
    }
  }

  if (failed) {
    console.error("Mobile authorization containment verification failed.");
    process.exitCode = 1;
  } else {
    console.log("Mobile authorization containment verified without credentials or request bodies.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Mobile authorization containment verification failed.");
  process.exitCode = 2;
}

function parseOrigin(arguments_) {
  if (arguments_.length !== 2 || arguments_[0] !== "--origin") {
    throw new Error("Usage: npm run mobile:verify-auth-containment -- --origin https://example.test");
  }

  const origin = new URL(arguments_[1]);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("--origin must be an HTTPS origin without credentials, path, query, or fragment.");
  }
  return origin;
}

function safeErrorCategory(error) {
  if (error?.name === "TimeoutError") {
    return "timeout";
  }
  if (error?.name === "AbortError") {
    return "aborted";
  }
  return "network_error";
}
