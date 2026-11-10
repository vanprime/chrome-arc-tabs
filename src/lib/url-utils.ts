import type { ArcSpace } from "~types/arc"

export const DEFAULT_FALLBACK_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%238b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
  )

export function getFaviconUrl(pageUrl?: string, rawFavIconUrl = ""): string {
  if (
    rawFavIconUrl &&
    (rawFavIconUrl.startsWith("http") || rawFavIconUrl.startsWith("data:"))
  ) {
    return rawFavIconUrl
  }
  if (
    pageUrl &&
    (pageUrl.startsWith("http://") || pageUrl.startsWith("https://"))
  ) {
    const base = chrome.runtime.getURL("/_favicon/")
    return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`
  }
  return DEFAULT_FALLBACK_ICON
}

export function formatCleanDomain(url?: string): string {
  if (!url) return "New Tab"
  if (url.startsWith("chrome://newtab")) return "New Tab"
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname.replace(/^www\./, "") ||
      parsed.protocol.replace(":", "")
    )
  } catch {
    return url
  }
}

export function cleanTrackingUrl(rawUrl?: string): string {
  if (!rawUrl) return ""
  try {
    const parsed = new URL(rawUrl)
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
      "ref",
      "igshid"
    ]
    for (const key of trackingParams) {
      parsed.searchParams.delete(key)
    }
    return parsed.toString()
  } catch {
    return rawUrl
  }
}

export function urlsRoughlyMatch(urlA?: string, urlB?: string): boolean {
  if (!urlA || !urlB) return false
  if (urlA === urlB) return true
  try {
    const a = new URL(urlA)
    const b = new URL(urlB)
    return (
      a.origin === b.origin &&
      a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "")
    )
  } catch {
    return false
  }
}

export function matchSpaceByDomain(
  url: string | undefined,
  spaces: ArcSpace[]
): string | null {
  if (!url) return null
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    for (const space of spaces) {
      if (!Array.isArray(space.domainRules)) continue
      for (const rule of space.domainRules) {
        const cleanRule = rule.trim().toLowerCase()
        if (
          cleanRule &&
          (hostname === cleanRule || hostname.endsWith(`.${cleanRule}`))
        ) {
          return space.id
        }
      }
    }
  } catch {
    // Ignore non-standard URLs
  }
  return null
}

export function categorizeTabDomain(url?: string): string {
  const host = formatCleanDomain(url).toLowerCase()
  if (
    /github|gitlab|stackoverflow|localhost|vercel|netlify|linear|jira/.test(
      host
    )
  ) {
    return "⚡ Engineering & Dev"
  }
  if (/docs|wikipedia|arxiv|developer|mdn|notion|medium|substack/.test(host)) {
    return "📚 Docs & Knowledge"
  }
  if (/youtube|spotify|netflix|twitch|soundcloud|vimeo/.test(host)) {
    return "🎧 Media & Video"
  }
  if (
    /mail|slack|discord|x\.com|twitter|reddit|linkedin|news\.ycombinator/.test(
      host
    )
  ) {
    return "💬 Social & Comms"
  }
  return `🌐 ${host || "General"}`
}
