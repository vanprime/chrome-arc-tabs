import React, { useEffect, useRef, useState } from "react"
import { formatCleanDomain, urlsRoughlyMatch } from "~lib/url-utils"
import type { ArcSpace } from "~types/arc"

interface TopBarProps {
  activeTab: chrome.tabs.Tab | null
  activeSpace: ArcSpace
  filterQuery: string
  collapseNativeTabs: boolean
  isTablessWindow: boolean
  isChromeless: boolean
  onFilterChange: (q: string) => void
  onOpenCommandBar: () => void
  onNavigateOmnibox: (input: string, newTab: boolean) => Promise<void>
  onCopyCleanUrl: () => void
  onPinActiveTab: () => void
  onToggleCollapseNativeTabs: () => Promise<void>
  onToggleTablessWindow: () => Promise<void>
  onToggleChromelessMode: () => Promise<void>
  onOpenArchive: () => void
}

export function TopBar({
  activeTab,
  activeSpace,
  filterQuery,
  collapseNativeTabs,
  isTablessWindow,
  isChromeless,
  onFilterChange,
  onOpenCommandBar,
  onNavigateOmnibox,
  onCopyCleanUrl,
  onPinActiveTab,
  onToggleCollapseNativeTabs,
  onToggleTablessWindow,
  onToggleChromelessMode,
  onOpenArchive
}: TopBarProps) {
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [omniboxValue, setOmniboxValue] = useState("")
  const omniboxInputRef = useRef<HTMLInputElement>(null)

  const isPinned = Boolean(
    activeTab &&
      activeSpace.pinnedTabs.some(
        (p) =>
          p.linkedTabId === activeTab.id ||
          urlsRoughlyMatch(p.url, activeTab.url)
      )
  )

  useEffect(() => {
    if (!isEditingUrl) {
      const currentUrl =
        activeTab?.url && !activeTab.url.startsWith("chrome://newtab")
          ? activeTab.url
          : ""
      setOmniboxValue(currentUrl)
    }
  }, [activeTab?.url, isEditingUrl])

  const handleBack = async () => {
    await chrome.runtime.sendMessage({
      type: "BROWSER_NAV_ACTION",
      action: "back"
    })
  }

  const handleForward = async () => {
    await chrome.runtime.sendMessage({
      type: "BROWSER_NAV_ACTION",
      action: "forward"
    })
  }

  const handleReload = async () => {
    await chrome.runtime.sendMessage({
      type: "BROWSER_NAV_ACTION",
      action: "reload"
    })
  }

  const startEditingOmnibox = () => {
    const raw =
      activeTab?.url && !activeTab.url.startsWith("chrome://newtab")
        ? activeTab.url
        : ""
    setOmniboxValue(raw)
    setIsEditingUrl(true)
    setTimeout(() => {
      omniboxInputRef.current?.focus()
      omniboxInputRef.current?.select()
    }, 10)
  }

  const SearchTag = "search" as unknown as React.ElementType

  return (
    <header className="arc-topbar">
      <div
        className="arc-nav-controls"
        role="toolbar"
        aria-label="Browser navigation and sidebar tools">
        <button
          type="button"
          className="icon-btn"
          aria-label="Go back"
          title="Back"
          onClick={handleBack}>
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
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Go forward"
          title="Forward"
          onClick={handleForward}>
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
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Reload current tab"
          title="Reload"
          onClick={handleReload}>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>

        <div className="nav-spacer" />

        <button
          type="button"
          className="icon-btn copy-pill-btn"
          aria-label="Copy clean URL"
          title="Copy Clean URL (⌘⇧C)"
          onClick={onCopyCleanUrl}>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>

        <button
          type="button"
          className={`icon-btn ${isPinned ? "is-pinned-active" : ""}`}
          aria-label="Pin or unpin active tab"
          title="Pin/Unpin Current Tab (⌥P)"
          onClick={onPinActiveTab}>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </button>

        <button
          type="button"
          className={`icon-btn ${isChromeless ? "is-pinned-active" : ""}`}
          aria-label="Toggle Arc Chromeless Mode (Hide Chrome Top Bar)"
          title={
            isChromeless
              ? "Exit Arc Chromeless Fullscreen Mode"
              : "Enter Arc Chromeless Mode (Hides Chrome's Top Tab & URL Bar)"
          }
          onClick={onToggleChromelessMode}>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>

        <button
          type="button"
          className="icon-btn"
          aria-label="Open Archive and Recently Closed Tabs"
          title="Archive & Recently Closed"
          onClick={onOpenArchive}>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>

        <button
          type="button"
          {...({ popovertarget: "settings-popover" } as any)}
          className="icon-btn"
          aria-label="Arc Sidebar Settings"
          title="Settings & Native Chrome Integration">
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Prominent 1-Click Chrome UI Replacement & Hiding Bar */}
      <div
        className="chrome-mode-bar"
        role="group"
        aria-label="Hide Chrome UI Controls">
        <button
          type="button"
          className={`mode-pill-btn ${collapseNativeTabs ? "is-active" : ""}`}
          title="Default ON: Represents each Space (🌿 Personal, ⚡ Work, 🔭 Research) as a Native Chrome Tab Group and auto-collapses inactive Spaces in Chrome's top strip"
          onClick={onToggleCollapseNativeTabs}>
          <span>{collapseNativeTabs ? "✓" : "○"} Collapse Top Tabs</span>
        </button>
        <button
          type="button"
          className={`mode-pill-btn ${isTablessWindow ? "is-active" : ""}`}
          title="Opens a desktop window with NO Chrome horizontal tab strip and NO Chrome URL bar (uses docked left Arc sidebar)"
          onClick={onToggleTablessWindow}>
          <span>❐ {isTablessWindow ? "Normal Win" : "Tabless Win"}</span>
        </button>
        <button
          type="button"
          className={`mode-pill-btn ${isChromeless ? "is-active" : ""}`}
          title="Toggles edge-to-edge Fullscreen Chromeless Mode with docked left Arc sidebar"
          onClick={onToggleChromelessMode}>
          <span>⛶ Fullscreen</span>
        </button>
      </div>

      <SearchTag className="arc-search-region">
        <div className="url-bar-row">
          {isEditingUrl ? (
            <form
              className="arc-omnibox-form"
              onSubmit={async (e) => {
                e.preventDefault()
                setIsEditingUrl(false)
                if (omniboxValue.trim()) {
                  await onNavigateOmnibox(omniboxValue.trim(), false)
                }
              }}>
              <input
                ref={omniboxInputRef}
                type="text"
                className="arc-omnibox-input"
                placeholder="Enter URL or search Google..."
                aria-label="Address and search bar"
                value={omniboxValue}
                onChange={(e) => setOmniboxValue(e.target.value)}
                onBlur={() => setIsEditingUrl(false)}
                onKeyDown={async (e) => {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    setIsEditingUrl(false)
                  } else if (
                    e.key === "Enter" &&
                    (e.metaKey || e.ctrlKey || e.altKey)
                  ) {
                    e.preventDefault()
                    setIsEditingUrl(false)
                    if (omniboxValue.trim()) {
                      await onNavigateOmnibox(omniboxValue.trim(), true)
                    }
                  }
                }}
              />
            </form>
          ) : (
            <div className="arc-url-pill-group">
              <button
                type="button"
                className="arc-url-pill"
                aria-label="Edit current URL or search"
                title={`${activeTab?.url || "New Tab"}\nClick to type URL • Click ⌘K for Command Bar`}
                onClick={startEditingOmnibox}>
                <svg
                  className="url-lock-icon"
                  aria-hidden="true"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="url-domain-text">
                  {activeTab ? formatCleanDomain(activeTab.url) : "New Tab"}
                </span>
              </button>
              <button
                type="button"
                className="cmd-trigger-chip"
                title="Open Arc Command Bar (⌘K)"
                aria-label="Open Arc Command Bar"
                onClick={onOpenCommandBar}>
                ⌘K
              </button>
            </div>
          )}
        </div>

        <div className="inline-filter-row">
          <svg
            className="filter-icon"
            aria-hidden="true"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="sidebar-filter-input"
            placeholder="Filter tabs in sidebar..."
            aria-label="Filter tabs in sidebar"
            value={filterQuery}
            onChange={(e) => onFilterChange(e.target.value)}
          />
          {filterQuery && (
            <button
              type="button"
              className="filter-clear-btn"
              aria-label="Clear filter"
              onClick={() => onFilterChange("")}>
              ×
            </button>
          )}
        </div>
      </SearchTag>
    </header>
  )
}
