import React, { useState } from "react"
import {
  categorizeTabDomain,
  cleanTrackingUrl,
  DEFAULT_FALLBACK_ICON,
  formatCleanDomain,
  getFaviconUrl
} from "~lib/url-utils"
import type {
  ArcSpace,
  ArcSplitPair,
  ContextMenuItem,
  DragPayload
} from "~types/arc"

interface TodaySectionProps {
  activeSpace: ArcSpace
  allSpaces: ArcSpace[]
  todayTabs: chrome.tabs.Tab[]
  splitPairs: ArcSplitPair[]
  viewAllSpacesTabs: boolean
  tidyGroupedMode: boolean
  dragPayload: DragPayload | null
  onDragStartItem: (payload: DragPayload) => void
  onToggleScope: () => Promise<void>
  onToggleTidyMode: () => void
  onClearTodayTabs: () => Promise<void>
  onOpenCommandBar: () => void
  onPinTab: (tab: chrome.tabs.Tab) => Promise<void>
  onAddToFavorites: (title: string, url: string, favIconUrl?: string) => Promise<void>
  onCreateSplitPair: (tab: chrome.tabs.Tab) => Promise<void>
  onUnsplitPair: (pairId: string) => Promise<void>
  onMoveTabToSpace: (tabId: number, spaceId: string) => Promise<void>
  onToggleMuteTab: (tabId: number) => Promise<void>
  onCopyCleanUrl: (url: string) => Promise<void>
  onOpenContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
  onRefresh: () => Promise<void>
}

export function TodaySection({
  activeSpace,
  allSpaces,
  todayTabs,
  splitPairs,
  viewAllSpacesTabs,
  tidyGroupedMode,
  dragPayload,
  onDragStartItem,
  onToggleScope,
  onToggleTidyMode,
  onClearTodayTabs,
  onOpenCommandBar,
  onPinTab,
  onAddToFavorites,
  onCreateSplitPair,
  onUnsplitPair,
  onMoveTabToSpace,
  onToggleMuteTab,
  onCopyCleanUrl,
  onOpenContextMenu,
  onRefresh
}: TodaySectionProps) {
  const [dragOverTabId, setDragOverTabId] = useState<number | null>(null)

  const pairedTabIds = new Set<number>()
  const validPairs: {
    pair: ArcSplitPair
    tabA: chrome.tabs.Tab
    tabB: chrome.tabs.Tab
  }[] = []

  for (const pair of splitPairs) {
    const tabA = todayTabs.find((t) => t.id === pair.leftTabId)
    const tabB = todayTabs.find((t) => t.id === pair.rightTabId)
    if (tabA?.id && tabB?.id) {
      pairedTabIds.add(tabA.id)
      pairedTabIds.add(tabB.id)
      validPairs.push({ pair, tabA, tabB })
    }
  }

  const remainingTabs = todayTabs.filter(
    (t) => t.id && !pairedTabIds.has(t.id)
  )

  const renderTodayTabRow = (tab: chrome.tabs.Tab) => {
    if (!tab.id) return null
    const tabId = tab.id
    const isAudibleOrMuted = Boolean(tab.audible || tab.mutedInfo?.muted)
    const isMuted = Boolean(tab.mutedInfo?.muted)

    return (
      <li
        key={tabId}
        draggable
        className={`tab-row today-tab-row ${tab.active ? "is-active" : ""} ${tab.discarded ? "is-discarded" : ""} ${dragOverTabId === tabId ? "is-drag-over" : ""}`}
        onDragStart={(e) => {
          onDragStartItem({
            kind: "today-tab",
            tabId,
            index: tab.index,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl
          })
          e.dataTransfer.effectAllowed = "move"
        }}
        onDragOver={(e) => {
          if (dragPayload?.kind === "today-tab") {
            e.preventDefault()
            setDragOverTabId(tabId)
          }
        }}
        onDragLeave={() => setDragOverTabId(null)}
        onDrop={async (e) => {
          e.preventDefault()
          setDragOverTabId(null)
          if (
            dragPayload?.kind === "today-tab" &&
            dragPayload.tabId &&
            dragPayload.tabId !== tabId
          ) {
            await chrome.tabs.move(dragPayload.tabId, { index: tab.index })
            await onRefresh()
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          const moveSpaceItems: ContextMenuItem[] = allSpaces
            .filter((s) => s.id !== activeSpace.id)
            .map((s) => ({
              label: `Move to ${s.icon} ${s.name}`,
              action: async () => {
                await onMoveTabToSpace(tabId, s.id)
              }
            }))

          onOpenContextMenu(e.clientX, e.clientY, [
            {
              label: `Pin to ${activeSpace.name}`,
              action: async () => {
                await onPinTab(tab)
              }
            },
            {
              label: "Add to Top Favorites",
              action: async () => {
                if (tab.url) {
                  await onAddToFavorites(
                    tab.title || "",
                    tab.url,
                    tab.favIconUrl
                  )
                }
              }
            },
            {
              label: "Pair in Split View with Active Tab",
              action: async () => {
                await onCreateSplitPair(tab)
              }
            },
            {
              label: "Copy Clean URL",
              action: async () => {
                await onCopyCleanUrl(cleanTrackingUrl(tab.url))
              }
            },
            {
              label: "Duplicate Tab",
              action: async () => {
                await chrome.tabs.duplicate(tabId)
              }
            },
            ...(!tab.active && !tab.discarded
              ? [
                  {
                    label: "💤 Suspend Tab (Save Memory)",
                    action: async () => {
                      await chrome.runtime.sendMessage({
                        type: "DISCARD_TAB",
                        tabId
                      })
                      await onRefresh()
                    }
                  }
                ]
              : []),
            ...moveSpaceItems,
            {
              label: "Close Tab",
              danger: true,
              action: async () => {
                await chrome.runtime.sendMessage({
                  type: "CLOSE_TAB",
                  tabId
                })
              }
            }
          ])
        }}>
        <button
          type="button"
          className="tab-main-click"
          title={`${tab.title || "Tab"}\n${tab.url || ""}`}
          onClick={async () => {
            await chrome.runtime.sendMessage({
              type: "ACTIVATE_TAB",
              tabId
            })
          }}>
          <img
            className="tab-favicon"
            width={16}
            height={16}
            alt=""
            src={getFaviconUrl(tab.url, tab.favIconUrl)}
            onError={(e) => {
              e.currentTarget.src = DEFAULT_FALLBACK_ICON
            }}
          />
          <span className="tab-title">
            {(tab.discarded ? "💤 " : "") +
              (tab.title || formatCleanDomain(tab.url))}
          </span>
        </button>

        {isAudibleOrMuted && (
          <button
            type="button"
            className={`tab-audio-btn ${isMuted ? "is-muted" : ""}`}
            title={isMuted ? "Unmute tab" : "Mute tab"}
            aria-label={isMuted ? "Unmute tab" : "Mute tab"}
            onClick={(e) => {
              e.stopPropagation()
              onToggleMuteTab(tabId)
            }}>
            {isMuted ? "🔇" : "🔊"}
          </button>
        )}

        <div className="tab-row-actions">
          <button
            type="button"
            className="row-action-btn"
            title={`Pin to ${activeSpace.name}`}
            aria-label={`Pin to ${activeSpace.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onPinTab(tab)
            }}>
            📌
          </button>
          <button
            type="button"
            className="row-action-btn"
            title="Pair in Arc Split View with active tab"
            aria-label="Pair in Arc Split View with active tab"
            onClick={(e) => {
              e.stopPropagation()
              onCreateSplitPair(tab)
            }}>
            ◫
          </button>
          <button
            type="button"
            className="row-action-btn"
            title="Close tab"
            aria-label="Close tab"
            onClick={async (e) => {
              e.stopPropagation()
              await chrome.runtime.sendMessage({
                type: "CLOSE_TAB",
                tabId
              })
            }}>
            ×
          </button>
        </div>
      </li>
    )
  }

  const buckets = new Map<string, chrome.tabs.Tab[]>()
  if (tidyGroupedMode && remainingTabs.length > 1) {
    for (const tab of remainingTabs) {
      const cat = categorizeTabDomain(tab.url)
      if (!buckets.has(cat)) buckets.set(cat, [])
      buckets.get(cat)?.push(tab)
    }
  }

  return (
    <>
      <div className="arc-divider-bar" role="separator">
        <div className="divider-left">
          <span className="divider-label">Today</span>
          <span className="count-pill">{todayTabs.length}</span>
          <button
            type="button"
            className="scope-chip"
            title="Toggle between Space tabs and All window tabs"
            onClick={onToggleScope}>
            {viewAllSpacesTabs ? "All" : "Space"}
          </button>
        </div>
        <div className="divider-line" />
        <div className="divider-actions">
          <button
            type="button"
            className="divider-btn tidy-btn"
            title="Auto-group Today tabs by domain category"
            onClick={onToggleTidyMode}>
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
            </svg>
            <span>Tidy</span>
          </button>
          <button
            type="button"
            className="divider-btn clear-btn"
            title="Archive and close inactive Today tabs"
            onClick={onClearTodayTabs}>
            Clear
          </button>
        </div>
      </div>

      <button
        type="button"
        className="arc-new-tab-btn"
        onClick={onOpenCommandBar}>
        <span className="new-tab-plus" aria-hidden="true">
          +
        </span>
        <span className="new-tab-label">New Tab</span>
        <kbd className="shortcut-badge" aria-hidden="true">
          ⌘T
        </kbd>
      </button>

      <section className="arc-today-section" aria-label="Today Open Tabs">
        <h2 className="sr-only">Today Tabs</h2>

        {tidyGroupedMode && remainingTabs.length > 1 && (
          <div className="tidy-groups-container">
            {Array.from(buckets.entries()).map(([category, groupTabs]) => (
              <div key={category} className="tidy-domain-card">
                <div className="tidy-card-header">
                  <span>{category}</span>
                  <span>{groupTabs.length}</span>
                </div>
                <ul className="tab-list">
                  {groupTabs.map((tab) => renderTodayTabRow(tab))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <ul className="tab-list today-list">
          {validPairs.map(({ pair, tabA, tabB }) => (
            <li key={pair.id} className="split-pair-row">
              {[tabA, tabB].map((t, idx) => (
                <React.Fragment key={t.id}>
                  {idx === 1 && <span className="split-divider-v" />}
                  <button
                    type="button"
                    className={`split-half-btn ${t.active ? "is-active" : ""}`}
                    title={`${t.title}\n${t.url}`}
                    onClick={async () => {
                      await chrome.runtime.sendMessage({
                        type: "ACTIVATE_TAB",
                        tabId: t.id
                      })
                    }}>
                    <img
                      className="tab-favicon"
                      width={14}
                      height={14}
                      alt=""
                      src={getFaviconUrl(t.url, t.favIconUrl)}
                    />
                    <span className="tab-title">
                      {t.title || formatCleanDomain(t.url)}
                    </span>
                  </button>
                </React.Fragment>
              ))}
              <button
                type="button"
                className="row-action-btn"
                title="Unsplit tabs"
                aria-label="Unsplit tabs"
                onClick={() => onUnsplitPair(pair.id)}>
                ×
              </button>
            </li>
          ))}

          {(!tidyGroupedMode || remainingTabs.length <= 1) &&
            remainingTabs.map((tab) => renderTodayTabRow(tab))}
        </ul>
      </section>
    </>
  )
}
