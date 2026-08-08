export const MIGRATION_RISK_REPORT_FIELDS = [
  "Migration name",
  "Author/date",
  "Affected tables",
  "Estimated row counts",
  "Estimated table and index sizes",
  "Expected lock type",
  "Rewrite or scan risk",
  "Expected duration",
  "Online-safe strategy",
  "Backfill plan",
  "Validation plan",
  "Maintenance mode required",
  "Rollback feasibility",
  "Forward-recovery plan",
  "Backup evidence required",
  "Owner approval",
  "Production result",
] as const

export type MigrationRiskCode =
  | "ALTER_COLUMN_TYPE"
  | "DROP_COLUMN"
  | "DROP_TABLE"
  | "FOREIGN_KEY_WITHOUT_NOT_VALID"
  | "NON_CONCURRENT_INDEX"
  | "NON_NULL_ADDITION"
  | "STORED_GENERATED_COLUMN"
  | "TYPE_REPLACEMENT"
  | "UNBOUNDED_DELETE"
  | "UNBOUNDED_UPDATE"

export type MigrationRiskFinding = {
  code: MigrationRiskCode
  line: number
  message: string
}

type RiskRule = {
  code: MigrationRiskCode
  message: string
  matches: (statement: string) => boolean
}

const riskRules: RiskRule[] = [
  {
    code: "NON_CONCURRENT_INDEX",
    message: "CREATE INDEX without CONCURRENTLY can block writes on a material table.",
    matches: (statement) =>
      /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!CONCURRENTLY\b)/i.test(statement),
  },
  {
    code: "STORED_GENERATED_COLUMN",
    message: "A stored generated column can scan or rewrite a material table.",
    matches: (statement) =>
      /\bGENERATED\s+ALWAYS\s+AS\b[\s\S]*\bSTORED\b/i.test(statement),
  },
  {
    code: "ALTER_COLUMN_TYPE",
    message: "ALTER COLUMN TYPE can rewrite a table and take an ACCESS EXCLUSIVE lock.",
    matches: (statement) => /\bALTER\s+COLUMN\b[\s\S]*\bTYPE\b/i.test(statement),
  },
  {
    code: "DROP_COLUMN",
    message: "DROP COLUMN can require a disruptive lock and has no simple rollback.",
    matches: (statement) => /\bDROP\s+COLUMN\b/i.test(statement),
  },
  {
    code: "DROP_TABLE",
    message: "DROP TABLE is destructive and requires a forward-recovery decision.",
    matches: (statement) => /\bDROP\s+TABLE\b/i.test(statement),
  },
  {
    code: "UNBOUNDED_UPDATE",
    message: "UPDATE without WHERE is an unbounded backfill inside the migration transaction.",
    matches: (statement) =>
      /^\s*UPDATE\b/i.test(statement) && !/\bWHERE\b/i.test(statement),
  },
  {
    code: "UNBOUNDED_DELETE",
    message: "DELETE without WHERE is an unbounded destructive operation.",
    matches: (statement) =>
      /^\s*DELETE\s+FROM\b/i.test(statement) && !/\bWHERE\b/i.test(statement),
  },
  {
    code: "NON_NULL_ADDITION",
    message: "Adding a NOT NULL column needs an expand-and-contract or small-table decision.",
    matches: (statement) =>
      /\bADD\s+COLUMN\b[\s\S]*\bNOT\s+NULL\b/i.test(statement),
  },
  {
    code: "FOREIGN_KEY_WITHOUT_NOT_VALID",
    message: "A new foreign key without NOT VALID can scan and lock a material table.",
    matches: (statement) =>
      /\bFOREIGN\s+KEY\b/i.test(statement) && !/\bNOT\s+VALID\b/i.test(statement),
  },
  {
    code: "TYPE_REPLACEMENT",
    message: "Enum replacement, removal, or rename requires an explicit compatibility plan.",
    matches: (statement) =>
      /\bALTER\s+TYPE\b[\s\S]*\b(?:DROP\s+VALUE|RENAME\s+TO)\b/i.test(statement),
  },
]

export function classifyMigrationSql(sql: string): MigrationRiskFinding[] {
  return splitSqlStatements(sql).flatMap(({ line, text }) =>
    riskRules
      .filter((rule) => rule.matches(text))
      .map((rule) => ({ code: rule.code, line, message: rule.message }))
  )
}

export function missingMigrationRiskReportFields(content: string) {
  return MIGRATION_RISK_REPORT_FIELDS.filter((field) => {
    const value = content.match(new RegExp(`^\\s*${escapeRegex(field)}\\s*:\\s*(.+)\\s*$`, "mi"))?.[1]

    return !value || /^(?:n\/a|tbd|todo|unknown)$/i.test(value.trim())
  })
}

export function validateMigrationRiskReport(content: string | undefined) {
  return content ? missingMigrationRiskReportFields(content) : ["risk report"]
}

function splitSqlStatements(sql: string) {
  const statements: Array<{ line: number; text: string }> = []
  let start = 0

  for (const match of sql.matchAll(/;/g)) {
    const end = match.index ?? start
    const text = sql.slice(start, end + 1)

    if (text.trim()) {
      statements.push({ line: lineAt(sql, start), text: stripSqlComments(text) })
    }
    start = end + 1
  }

  const trailing = sql.slice(start)
  if (trailing.trim()) {
    statements.push({ line: lineAt(sql, start), text: stripSqlComments(trailing) })
  }

  return statements
}

function stripSqlComments(statement: string) {
  return statement.replace(/--[^\r\n]*/g, "")
}

function lineAt(value: string, index: number) {
  return value.slice(0, index).split(/\r?\n/).length
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
