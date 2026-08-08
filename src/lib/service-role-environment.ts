import environmentManifest from "../../config/service-role-environments.json"

export const SERVICE_ROLE_ENVIRONMENT_MANIFEST = environmentManifest.roles
export const INFRASTRUCTURE_ENVIRONMENT_MANIFEST = environmentManifest.infrastructure

export type ServiceEnvironmentRole = keyof typeof SERVICE_ROLE_ENVIRONMENT_MANIFEST

export function getServiceRoleEnvironment(role: ServiceEnvironmentRole) {
  return SERVICE_ROLE_ENVIRONMENT_MANIFEST[role]
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
