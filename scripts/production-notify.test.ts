import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

describe("Arctic RSS operational notifications", () => {
  it("sends an escaped HTML email alongside the plain-text fallback", async () => {
    const script = await readFile("scripts/production-notify.sh", "utf8")
    const match = script.match(/const nodemailer = require\("nodemailer"\)([\s\S]*?)^NODE$/m)

    expect(match).not.toBeNull()

    const notifier = match?.[1]
    const harness = `
const sent = []
const nodemailer = { createTransport: () => ({ sendMail: async (message) => sent.push(message) }) }
${notifier}
setTimeout(() => process.stdout.write(JSON.stringify(sent[0])), 0)
`
    const result = spawnSync(process.execPath, ["-e", harness], {
      encoding: "utf8",
      env: {
        ...process.env,
        OPS_ALERT_BODY: "Plain-text fallback",
        OPS_ALERT_EVENT: "backup-failure<&",
        OPS_ALERT_OCCURRED_AT: "2026-07-28T18:00:00Z",
        OPS_ALERT_SOURCE: '<script>alert("x")</script>',
        OPS_ALERT_SUBJECT: "Arctic RSS alert: backup-failure",
        OPS_ALERT_TO: "ops@example.test",
        SMTP_HOST: "smtp.example.test",
        SMTP_PASSWORD: "test-password",
        SMTP_USER: "ops@example.test",
      },
    })

    expect(result.status).toBe(0)
    const message = JSON.parse(result.stdout) as { html: string; text: string }
    expect(message.text).toBe("Plain-text fallback")
    expect(message.html).toContain("Arctic RSS")
    expect(message.html).toContain("Action needed")
    expect(message.html).toContain("backup-failure&lt;&amp;")
    expect(message.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;")
    expect(message.html).not.toContain('<script>alert("x")</script>')
  })
})
