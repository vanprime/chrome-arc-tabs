import React from "react"
import {
  DEFAULT_FALLBACK_ICON,
  formatCleanDomain,
  getFaviconUrl
} from "~lib/url-utils"

interface MediaBarProps {
  audibleTab: chrome.tabs.Tab | undefined
  onToggleMuteTab: (tabId: number) => Promise<void>
}

export function MediaBar({ audibleTab, onToggleMuteTab }: MediaBarProps) {
  if (!audibleTab?.id) return null
  const tabId = audibleTab.id

  return (
    <aside className="arc-media-bar" aria-label="Now playing audio">
      <button
        type="button"
        className="media-bar-info"
        aria-label="Jump to tab playing audio"
        onClick={async () => {
          await chrome.runtime.sendMessage({
            type: "ACTIVATE_TAB",
            tabId
          })
        }}>
        <img
          className="media-favicon"
          src={getFaviconUrl(audibleTab.url, audibleTab.favIconUrl)}
          alt=""
          width={16}
          height={16}
          onError={(e) => {
            e.currentTarget.src = DEFAULT_FALLBACK_ICON
          }}
        />
        <div className="media-text">
          <span className="media-title">
            {audibleTab.title || formatCleanDomain(audibleTab.url)}
          </span>
          <span className="media-subtitle">Click to focus tab</span>
        </div>
      </button>
      <div className="equalizer-bars" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <button
        type="button"
        className="icon-btn media-mute-btn"
        aria-label="Toggle mute on playing tab"
        onClick={() => onToggleMuteTab(tabId)}>
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      </button>
    </aside>
  )
}
