import * as WebBrowser from "expo-web-browser"

import { MOBILE_SERVICE_ORIGIN } from "@/config"

export async function openArcticRssWebPath(path: string) {
  await WebBrowser.openBrowserAsync(new URL(path, MOBILE_SERVICE_ORIGIN).toString())
}
