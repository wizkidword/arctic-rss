import "dotenv/config"

import {
  inspectSmartDigestEmailDelivery,
  reconcileSmartDigestEmailDelivery,
} from "../src/lib/smart-digest-delivery-reconciliation"

const options = parseOptions(process.argv.slice(2))

if (options.action === "inspect") {
  void inspectSmartDigestEmailDelivery({ runId: options.runId }).then(
    writeResult,
  )
} else {
  void reconcileSmartDigestEmailDelivery({
    decision:
      options.action === "confirm-delivered"
        ? "CONFIRM_DELIVERED"
        : "CONFIRM_NOT_DELIVERED",
    runId: options.runId,
  }).then(writeResult)
}

type Options = {
  action: "confirm-delivered" | "confirm-not-delivered" | "inspect"
  runId: string
}

function parseOptions(args: string[]): Options {
  const runFlag = args.indexOf("--run")
  const runId = runFlag >= 0 ? args[runFlag + 1]?.trim() : undefined
  const actions = args.filter((argument) => argument.startsWith("--confirm-"))

  if (!runId || actions.length > 1) {
    throw new Error(
      "Use --run <digest-run-id> with no confirmation to inspect, --confirm-delivered, or --confirm-not-delivered.",
    )
  }

  if (!actions.length) {
    return { action: "inspect", runId }
  }
  if (actions[0] === "--confirm-delivered") {
    return { action: "confirm-delivered", runId }
  }
  if (actions[0] === "--confirm-not-delivered") {
    return { action: "confirm-not-delivered", runId }
  }

  throw new Error(
    "Use --run <digest-run-id> with no confirmation to inspect, --confirm-delivered, or --confirm-not-delivered.",
  )
}

function writeResult(result: unknown) {
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
