import { collectDoctorReport } from "../src/lib/doctor"

async function main() {
  const report = await collectDoctorReport()

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  process.exitCode = report.securityBoundary.status === "failed" || !report.queueReadiness.ready ? 1 : 0
}

main().catch(() => {
  console.error("Doctor could not collect a redacted report.")
  process.exitCode = 1
})
