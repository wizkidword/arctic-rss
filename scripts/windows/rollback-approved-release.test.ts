import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("approved rollback command", () => {
  it("requires the recorded prior topology, image tags, and typed rollback confirmation", async () => {
    const script = await readFile("scripts/windows/rollback-approved-release.ps1", "utf8")

    expect(script).toContain('[ValidateSet("all-in-one", "all-in-one-with-chat", "split", "split-with-chat")]')
    expect(script).toContain("function Get-ReleaseRecord")
    expect(script).toContain("$previousTopology -ne $Topology.Name")
    expect(script).toContain("previousImageTags")
    expect(script).toContain('Release record previous commit')
    expect(script).toContain('Type ROLLBACK $shortSha')
    expect(script).toContain('ROLLBACK $shortSha')
  })

  it("uses manifest-selected rollback services and verifies their health without migrations", async () => {
    const script = await readFile("scripts/windows/rollback-approved-release.ps1", "utf8")

    expect(script).toContain("function Get-RollbackTopology")
    expect(script).toContain("topology_rollback_services_b64=")
    expect(script).toContain("previous_image_tags_b64=")
    expect(script).toContain('up -d --no-deps --no-build --force-recreate "${topology_rollback_services[@]}"')
    expect(script).toContain("previous_compose config --services")
    expect(script).toContain("previous_compose config --images")
    expect(script).toContain("TOPOLOGY_HEALTH")
    expect(script).toContain("previous_commit='__PREVIOUS_COMMIT__'")
    expect(script).toContain('ARCTIC_RSS_TOPOLOGY="$topology_name"')
    expect(script).toContain('ARCTIC_RSS_BUILD_SHA="$previous_commit"')
    expect(script).not.toContain("migrate deploy")
    expect(script).not.toContain('migrate", "deploy')
  })
})
