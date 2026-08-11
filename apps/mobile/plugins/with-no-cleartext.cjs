const { withAndroidManifest } = require("@expo/config-plugins")

module.exports = function withNoCleartext(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const application = manifestConfig.modResults.manifest.application?.[0]
    if (!application) {
      throw new Error("Android manifest does not define an application element.")
    }
    application.$["android:usesCleartextTraffic"] = "false"
    return manifestConfig
  })
}
