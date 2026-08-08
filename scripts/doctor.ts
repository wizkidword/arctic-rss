import {
  collectDoctorReport,
  evaluateDoctorReport,
  parseDoctorCommand,
} from "../src/lib/doctor"

async function main() {
  const command = parseDoctorCommand(process.argv.slice(2))
  const environment = {
    ...process.env,
    ...(command.role ? { ARCTIC_RSS_SERVICE_ROLE: command.role } : {}),
    ...(command.topology ? { ARCTIC_RSS_TOPOLOGY: command.topology } : {}),
  }
  const report = await collectDoctorReport(environment, { scope: command.scope })
  const evaluation = evaluateDoctorReport(report, { warnOnly: command.warnOnly })

  process.stdout.write(`${JSON.stringify({ evaluation, report }, null, 2)}\n`)
  process.exitCode = evaluation.exitCode
}

main().catch(() => {
  console.error("Doctor could not collect a redacted report.")
  process.exitCode = 1
})
