"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Script from "next/script"

type TurnstileWidgetProps = {
  action: string
  siteKey: string
}

type TurnstileRenderOptions = {
  sitekey: string
  action: string
  theme: "auto"
  callback: (token: string) => void
  "expired-callback": () => void
  "error-callback": () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: TurnstileRenderOptions
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

export function TurnstileWidget({ action, siteKey }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState("")
  const normalizedSiteKey = siteKey.trim()

  const renderWidget = useCallback(() => {
    if (!normalizedSiteKey || !containerRef.current || !window.turnstile) {
      return
    }

    if (widgetIdRef.current) {
      return
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: normalizedSiteKey,
      action,
      theme: "auto",
      callback: setToken,
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    })
  }, [action, normalizedSiteKey])

  useEffect(() => {
    renderWidget()
    const intervalId = window.setInterval(() => {
      renderWidget()

      if (widgetIdRef.current) {
        window.clearInterval(intervalId)
      }
    }, 250)
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId)
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)

      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [renderWidget])

  if (!normalizedSiteKey) {
    return null
  }

  return (
    <div className="min-h-16">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
        onReady={renderWidget}
      />
      <div ref={containerRef} />
      <input name="cf-turnstile-response" type="hidden" value={token} />
    </div>
  )
}
