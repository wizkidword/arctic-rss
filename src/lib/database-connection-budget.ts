import connectionBudget from "../../config/database-connection-budget.json"

export const DATABASE_CONNECTION_BUDGET = connectionBudget

export const DATABASE_RUNTIME_ROLES = [
  "chat-gateway",
  "web",
  "worker-ai-mail",
  "worker-all",
  "worker-chat-events",
  "worker-health",
  "worker-imports",
  "worker-ingestion",
  "worker-maintenance",
] as const

export type DatabaseRuntimeRole = (typeof DATABASE_RUNTIME_ROLES)[number]
export type DatabaseBudgetRole = keyof typeof DATABASE_CONNECTION_BUDGET.roles

export const DATABASE_CONNECTION_RESERVE_TOTAL = Object.values(
  DATABASE_CONNECTION_BUDGET.postgres.reserves
).reduce((total, reserve) => total + reserve, 0)

export const DATABASE_APPLICATION_CONNECTION_BUDGET =
  DATABASE_CONNECTION_BUDGET.postgres.maxConnections -
  DATABASE_CONNECTION_RESERVE_TOTAL

export function getDatabaseConnectionBudgetForRole(role: DatabaseBudgetRole) {
  return DATABASE_CONNECTION_BUDGET.roles[role]
}

export function isDatabaseRuntimeRole(value: string): value is DatabaseRuntimeRole {
  return (DATABASE_RUNTIME_ROLES as readonly string[]).includes(value)
}
