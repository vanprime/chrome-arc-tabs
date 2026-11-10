import React from "react"
import { urlsRoughlyMatch } from "~lib/url-utils"
import type { ArcSpace } from "~types/arc"

interface TopBarProps {
  activeTab: chrome.tabs.Tab | null
  activeSpace: ArcSpace
  filterQuery: string
  onFilterChange: (q: string) => void
  onOpenCommandBar: () => void
  onCopyCleanUrl: () => void
  onPinActiveTab: () => void
  onOpenArchive: () => void
}

export function TopBar({
  activeTab,
  activeSpace,
  filterQuery,
  onFilterChange,
  onOpenCommandBar,
  onCopyCleanUrl,
  onPinActiveTab,
  onOpenArchive
}: TopBarProps) {
  const isPinned = Boolean(
    activeTab &&
      activeSpace.pinnedTabs.some(
        (p) =>
          p.linkedTabId === activeTab.id ||
          urlsRoughlyMatch(p.url, activeTab.url)
      )
  )

  const SearchTag = "search" as unknown as React.ElementType

  return (
    <header className="arc-topbar">
      <SearchTag className="arc-search-region">
        <div
          className="arc-url-pill-group"
          role="toolbar"
          aria-label="Filter tabs and sidebar tools">
          <div className="arc-filter-pill">
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
              placeholder="Filter tabs..."
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

          <button
            type="button"
            className="cmd-trigger-chip"
            title="Open Arc Command Bar (⌘K)"
            aria-label="Open Arc Command Bar"
            onClick={onOpenCommandBar}>
            ⌘K
          </button>

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
      </SearchTag>
    </header>
  )
}
