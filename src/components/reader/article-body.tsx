import { type ReaderArticle } from "@/lib/articles"
import { imageProxyUrl } from "@/lib/image-proxy-url"
import { extractYouTubeVideoId } from "@/lib/youtube-feeds"

const ARTICLE_IMAGE_HTML_PATTERN = /<img\b/i

export function ArticleBody({ article }: { article: ReaderArticle }) {
  const proxiedImageUrl = imageProxyUrl(article.imageUrl)
  const fallbackImageUrl =
    proxiedImageUrl &&
    !extractYouTubeVideoId(article.url) &&
    !articleHtmlHasImage(article.sanitizedContentHtml)
      ? proxiedImageUrl
      : null

  if (article.sanitizedContentHtml) {
    return (
      <>
        {fallbackImageUrl ? <ArticleImageFallback imageUrl={fallbackImageUrl} /> : null}
        <div
          className="min-w-0 max-w-full space-y-4 break-words text-foreground [&_*]:max-w-full [&_a]:break-words [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l [&_blockquote]:pl-4 [&_img]:max-h-[520px] [&_img]:rounded-lg [&_img]:object-contain [&_p]:break-words [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3"
          dangerouslySetInnerHTML={{ __html: article.sanitizedContentHtml }}
        />
      </>
    )
  }

  return (
    <>
      {fallbackImageUrl ? <ArticleImageFallback imageUrl={fallbackImageUrl} /> : null}
      <p className="min-w-0 whitespace-pre-wrap break-words">
        {article.contentText || "This article did not include readable body text in the feed."}
      </p>
    </>
  )
}

function ArticleImageFallback({ imageUrl }: { imageUrl: string }) {
  // Feed-level images are body media here, not cropped preview headers.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className="max-h-[520px] w-full rounded-lg object-contain" src={imageUrl} />
  )
}

function articleHtmlHasImage(html: string | null) {
  return Boolean(html && ARTICLE_IMAGE_HTML_PATTERN.test(html))
}
