import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

import {
  classifyMigrationSql,
  validateMigrationRiskReport,
} from "../src/lib/migration-risk"

type Options = {
  base?: string
  migrations: string[]
}

function main() {
  const options = parseOptions(process.argv.slice(2))
  const migrationNames = options.migrations.length
    ? options.migrations
    : options.base
      ? changedMigrationNames(options.base)
      : []
  const results = migrationNames.map((name) => inspectMigration(name))
  const failures = results.flatMap((result) => result.errors)

  process.stdout.write(
    `${JSON.stringify({
      migrations: results.map((result) => ({
        findings: result.findings,
        name: result.name,
      })),
      status: failures.length ? "failed" : "ok",
    }, null, 2)}\n`
  )

  if (failures.length) {
    process.stderr.write(`${failures.join("\n")}\n`)
    process.exitCode = 1
  }
}

function parseOptions(args: readonly string[]): Options {
  const options: Options = { migrations: [] }

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]
    const value = args[index + 1]?.trim()

    if ((option === "--base" || option === "--migration") && value && !value.startsWith("--")) {
      if (option === "--base") {
        options.base = value
      } else {
        options.migrations.push(value)
      }
      index += 1
      continue
    }

    throw new Error("Use --base <git-sha> and/or --migration <migration-name>.")
  }

  return options
}

function changedMigrationNames(base: string) {
  const changedFiles = execFileSync(
    "git",
    ["diff", "--name-only", `${base}...HEAD`, "--", "prisma/migrations"],
    { encoding: "utf8", windowsHide: true }
  )

  return [...new Set(
    changedFiles
      .split(/\r?\n/)
      .map((file) => file.match(/^prisma\/migrations\/([^/]+)\/migration\.sql$/)?.[1])
      .filter((name): name is string => Boolean(name))
  )]
}

export function inspectMigration(name: string, rootDirectory = process.cwd()) {
  const migrationsDirectory = resolve(rootDirectory, "prisma", "migrations")
  const migrationDirectory = resolve(migrationsDirectory, name)

  if (
    migrationDirectory !== migrationsDirectory &&
    !migrationDirectory.startsWith(`${migrationsDirectory}${sep}`)
  ) {
    return {
      errors: [`Migration name is outside prisma/migrations: ${name}`],
      findings: [],
      name,
    }
  }

  const sqlPath = resolve(migrationDirectory, "migration.sql")
  if (!existsSync(sqlPath)) {
    return {
      errors: [`Migration SQL is missing: ${name}`],
      findings: [],
      name,
    }
  }

  const sql = readFileSync(sqlPath, "utf8")
  const findings = classifyMigrationSql(sql)

  const reportPath = resolve(
    rootDirectory,
    "docs",
    "operations",
    "migration-risk",
    `${name}.md`
  )
  const missingFields = validateMigrationRiskReport(
    existsSync(reportPath) ? readFileSync(reportPath, "utf8") : undefined,
    { migrationName: name, sql }
  )

  return {
    errors: missingFields.length
      ? [`Migration ${name}${findings.length ? ` is flagged (${findings.map(({ code }) => code).join(", ")})` : ""} has an invalid risk report: ${missingFields.join(", ")}.`]
      : [],
    findings,
    name,
  }
}

const invokedScript = process.argv[1]
if (invokedScript && import.meta.url === pathToFileURL(resolve(invokedScript)).href) {
  main()
}
