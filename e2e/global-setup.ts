import { createServer, type Server } from "node:http"

import { runFixtureControl } from "./support/fixtures"

export default async function globalSetup() {
  if (process.env.ARCTIC_RSS_E2E_AUTHENTICATED !== "1") {
    return
  }

  const server = await startFixtureFeedServer()
  await runFixtureControl(["seed"])

  return async () => {
    await closeFixtureFeedServer(server)
  }
}

async function startFixtureFeedServer() {
  const origin = new URL(
    process.env.ARCTIC_RSS_E2E_FEED_ORIGIN ?? "http://127.0.0.1:4311"
  )
  const server = createServer((request, response) => {
    const body = responseForPath(request.url ?? "/", origin)

    if (!body) {
      response.writeHead(404)
      response.end("Not found")
      return
    }

    response.writeHead(200, {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "no-store",
    })
    response.end(body)
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(Number(origin.port), origin.hostname, resolve)
  })

  return server
}

function responseForPath(requestUrl: string, origin: URL) {
  const path = new URL(requestUrl, origin).pathname

  if (path === "/reader.xml") {
    return rssDocument({
      articleTitle: "E2E Reader Article One",
      feedTitle: "E2E Reader Feed",
      itemId: "reader-one",
    })
  }

  if (path === "/opml-a.xml") {
    return rssDocument({
      articleTitle: "E2E OPML Article A",
      feedTitle: "E2E OPML Feed A",
      itemId: "opml-a",
    })
  }

  if (path === "/opml-b.xml") {
    return rssDocument({
      articleTitle: "E2E OPML Article B",
      feedTitle: "E2E OPML Feed B",
      itemId: "opml-b",
    })
  }

  return null
}

function rssDocument({
  articleTitle,
  feedTitle,
  itemId,
}: {
  articleTitle: string
  feedTitle: string
  itemId: string
}) {
  const fixtureHost = process.env.ARCTIC_RSS_E2E_FEED_HOST ?? "feeds.e2e.arcticrss.test"
  const publicOrigin = `http://${fixtureHost}`

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${feedTitle}</title>
    <link>${publicOrigin}</link>
    <description>Deterministic Arctic RSS E2E feed.</description>
    <item>
      <guid isPermaLink="false">${itemId}</guid>
      <title>${articleTitle}</title>
      <link>${publicOrigin}/articles/${itemId}</link>
      <description>Deterministic E2E article content.</description>
      <content:encoded><![CDATA[<p>Deterministic E2E article content.</p>]]></content:encoded>
      <pubDate>Tue, 01 Jan 2030 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`
}

async function closeFixtureFeedServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}
