import React from "react"
import { formatCleanDomain, urlsRoughlyMatch } from "~lib/url-utils"
import type { ArcSpace } from "~types/arc"

interface TopBarProps {
  activeTab: chrome.tabs.Tab | null
  activeSpace: ArcSpace
  filterQuery: string
  onFilterChange: (q: string) => void
  onOpenCommandBar: () => void
  onCopyCleanUrl: () => void
  onPinActiveTab: () => void
}

export function TopBar({
  activeTab,
  activeSpace,
  filterQuery,
  onFilterChange,
  onOpenCommandBar,
  onCopyCleanUrl,
  onPinActiveTab
}: TopBarProps) {
  const isPinned = Boolean(
    activeTab &&
      activeSpace.pinnedTabs.some(
        (p) =>
          p.linkedTabId === activeTab.id ||
          urlsRoughlyMatch(p.url, activeTab.url)
      )
  )

  const handleBack = async () => {
    if (!activeTab?.id) return
    try {
      await chrome.tabs.goBack(activeTab.id)
    } catch {
      // Cannot go back
    }
  }

  const handleForward = async () => {
    if (!activeTab?.id) return
    try {
      await chrome.tabs.goForward(activeTab.id)
    } catch {
      // Cannot go forward
    }
  }

  const handleReload = async () => {
    if (!activeTab?.id) return
    await chrome.tabs.reload(activeTab.id)
  }

  const SearchTag = "search" as unknown as React.ElementType

  return (
    <header className="arc-topbar">
      <div
        className="arc-nav-controls"
        role="toolbar"
        aria-label="Browser navigation">
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
      </div>

      <SearchTag className="arc-search-region">
        <div className="url-bar-row">
          <button
            type="button"
            className="arc-url-pill"
            aria-label="Open Arc Command Bar or navigate URL"
            title={activeTab?.url || "Open Arc Command Bar (⌘K)"}
            onClick={onOpenCommandBar}>
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
            <kbd className="shortcut-badge" aria-hidden="true">
              ⌘K
            </kbd>
          </button>
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
