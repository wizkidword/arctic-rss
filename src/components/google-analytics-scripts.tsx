type GoogleAnalyticsScriptsProps = {
  measurementId: string
}

export function GoogleAnalyticsScripts({
  measurementId,
}: GoogleAnalyticsScriptsProps) {
  const normalizedMeasurementId = measurementId.trim()

  if (!normalizedMeasurementId) {
    return null
  }

  return (
    <>
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
          normalizedMeasurementId
        )}`}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: [
            "window.dataLayer = window.dataLayer || [];",
            "window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};",
            "window.gtag('js', new Date());",
            `window.gtag('config', ${JSON.stringify(normalizedMeasurementId)}, { allow_google_signals: false, allow_ad_personalization_signals: false });`,
          ].join("\n"),
        }}
      />
    </>
  )
}
