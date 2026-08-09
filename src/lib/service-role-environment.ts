import environmentManifest from "../../config/service-role-environments.json"

export const SERVICE_ROLE_ENVIRONMENT_MANIFEST = environmentManifest.roles
export const INFRASTRUCTURE_ENVIRONMENT_MANIFEST = environmentManifest.infrastructure
export const RUNTIME_COMPATIBILITY_ALIASES =
  environmentManifest.runtimeCompatibilityAliases
export const MANAGED_ENVIRONMENT_ALIASES = environmentManifest.managedAliases

export type ServiceEnvironmentRole = keyof typeof SERVICE_ROLE_ENVIRONMENT_MANIFEST

export function getServiceRoleEnvironment(role: ServiceEnvironmentRole) {
  return SERVICE_ROLE_ENVIRONMENT_MANIFEST[role]
}

export function getRuntimeAllowedServiceRoleEnvironment(role: ServiceEnvironmentRole) {
  return [
    ...new Set([
      ...getServiceRoleEnvironment(role).allowed,
      ...RUNTIME_COMPATIBILITY_ALIASES[role],
    ]),
  ]
}

export function getRuntimeRequiredServiceRoleEnvironment(role: ServiceEnvironmentRole) {
  const entry = getServiceRoleEnvironment(role)
  const compatibilityOptional: readonly string[] = entry.runtimeOptionalViaCompatibility

  return entry.required.filter(
    (variable) => !compatibilityOptional.includes(variable)
  )
}

export const ALL_ROLE_ENVIRONMENT_VARIABLES = [
  ...new Set(
    Object.values(SERVICE_ROLE_ENVIRONMENT_MANIFEST).flatMap(({ allowed }) => allowed)
  ),
]

export const ALL_MANAGED_ENVIRONMENT_VARIABLES = [
  ...new Set([
    ...ALL_ROLE_ENVIRONMENT_VARIABLES,
    ...Object.values(INFRASTRUCTURE_ENVIRONMENT_MANIFEST).flat(),
    ...MANAGED_ENVIRONMENT_ALIASES,
  ]),
].sort()

export function findUnexpectedManagedServiceRoleEnvironmentVariables(
  environment: Readonly<Record<string, string | undefined>>,
  role: ServiceEnvironmentRole
) {
  const allowed = new Set(getRuntimeAllowedServiceRoleEnvironment(role))

  return ALL_MANAGED_ENVIRONMENT_VARIABLES.filter(
    (variable) => environment[variable] !== undefined && !allowed.has(variable)
  )
}
