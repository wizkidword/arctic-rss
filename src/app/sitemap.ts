import type { MetadataRoute } from "next"

const SITE_URL = "https://arcticrss.com"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "monthly",
      priority: 1,
      url: SITE_URL,
    },
    {
      changeFrequency: "weekly",
      priority: 0.8,
      url: `${SITE_URL}/guest`,
    },
    {
      changeFrequency: "weekly",
      priority: 0.7,
      url: `${SITE_URL}/guest/discover`,
    },
    {
      changeFrequency: "weekly",
      priority: 0.6,
      url: `${SITE_URL}/guest/podcasts/discover`,
    },
    {
      changeFrequency: "yearly",
      priority: 0.3,
      url: `${SITE_URL}/legal`,
    },
    {
      changeFrequency: "yearly",
      priority: 0.3,
      url: `${SITE_URL}/privacy`,
    },
    {
      changeFrequency: "yearly",
      priority: 0.3,
      url: `${SITE_URL}/terms`,
    },
    {
      changeFrequency: "yearly",
      priority: 0.2,
      url: `${SITE_URL}/cookies`,
    },
    {
      changeFrequency: "yearly",
      priority: 0.2,
      url: `${SITE_URL}/security`,
    },
    {
      changeFrequency: "yearly",
      priority: 0.2,
      url: `${SITE_URL}/community`,
    },
    {
      changeFrequency: "yearly",
      priority: 0.2,
      url: `${SITE_URL}/retention`,
    },
  ]
}
