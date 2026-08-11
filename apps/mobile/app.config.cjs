const sourceRevision = [process.env.EAS_BUILD_GIT_COMMIT_HASH, process.env.GITHUB_SHA]
  .find((value) => /^[a-f0-9]{7,64}$/i.test(value ?? ""))
  ?.slice(0, 40) ?? "unknown"
const requestedEnvironment = process.env.EXPO_PUBLIC_ARCTIC_RSS_ENVIRONMENT?.trim()
const buildEnvironment = ["development", "preview", "production"].includes(requestedEnvironment)
  ? requestedEnvironment
  : "unknown"

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    arcticRssBuild: {
      environment: buildEnvironment,
      sourceRevision,
    },
  },
})
