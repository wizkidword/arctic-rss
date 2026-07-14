import type { MetadataRoute } from "next"

const SITE_URL = "https://arcticrss.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/app/",
        "/irc/",
        "/forgot-password",
        "/login",
        "/reset-password",
        "/signup",
        "/verify-email",
      ],
      userAgent: "*",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
