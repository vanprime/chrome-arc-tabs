import React, { useState } from "react"
import {
  cleanTrackingUrl,
  DEFAULT_FALLBACK_ICON,
  formatCleanDomain,
  getFaviconUrl,
  urlsRoughlyMatch
} from "~lib/url-utils"
import type {
  ArcFolder,
  ArcPinnedTab,
  ArcSpace,
  ContextMenuItem,
  DragPayload
} from "~types/arc"

interface PinnedSectionProps {
  activeSpace: ArcSpace
  tabs: chrome.tabs.Tab[]
  filterQuery: string
  dragPayload: DragPayload | null
  onDragStartItem: (payload: DragPayload) => void
  onOpenSpaceEditor: () => void
  onOpenNewFolder: () => void
  onOpenRenameFolder: (folder: ArcFolder) => void
  onToggleFolderCollapse: (folderId: string) => Promise<void>
  onDeleteFolder: (folderId: string) => Promise<void>
  onActivatePinnedTab: (pin: ArcPinnedTab, linkedTab?: chrome.tabs.Tab) => Promise<void>
  onCloseOrUnpinTab: (pin: ArcPinnedTab, linkedTab?: chrome.tabs.Tab) => Promise<void>
  onUpdatePinnedTab: (
    pinId: string,
    updater: (pin: ArcPinnedTab) => void
  ) => Promise<void>
  onDropIntoFolder: (folderId: string | null, payload: DragPayload) => Promise<void>
  onToggleMuteTab: (tabId: number) => Promise<void>
  onCopyCleanUrl: (url: string) => Promise<void>
  onOpenContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
  onShowToast: (text: string) => void
}

export function PinnedSection({
  activeSpace,
  tabs,
  filterQuery,
  dragPayload,
  onDragStartItem,
  onOpenSpaceEditor,
  onOpenNewFolder,
  onOpenRenameFolder,
  onToggleFolderCollapse,
  onDeleteFolder,
  onActivatePinnedTab,
  onCloseOrUnpinTab,
  onUpdatePinnedTab,
  onDropIntoFolder,
  onToggleMuteTab,
  onCopyCleanUrl,
  onOpenContextMenu,
  onShowToast
}: PinnedSectionProps) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [dragOverRoot, setDragOverRoot] = useState(false)

  const matchesFilter = (title = "", url = "") => {
    if (!filterQuery) return true
    const q = filterQuery.toLowerCase()
    return title.toLowerCase().includes(q) || url.toLowerCase().includes(q)
  }

  const renderPinnedRow = (pin: ArcPinnedTab) => {
    const linkedTab = pin.linkedTabId
      ? tabs.find((t) => t.id === pin.linkedTabId)
      : tabs.find((t) => urlsRoughlyMatch(t.url, pin.url))

    const displayTitle =
      linkedTab?.title || pin.title || formatCleanDomain(pin.url)
    const displayUrl = linkedTab?.url || pin.url
    if (!matchesFilter(displayTitle, displayUrl)) return null

    const isDrifted = Boolean(
      linkedTab && !urlsRoughlyMatch(linkedTab.url, pin.url)
    )
    const isAudibleOrMuted = Boolean(
      linkedTab && (linkedTab.audible || linkedTab.mutedInfo?.muted)
    )
    const isMuted = Boolean(linkedTab?.mutedInfo?.muted)

    return (
      <li
        key={pin.id}
        draggable
        className={`tab-row pinned-tab-row ${linkedTab?.active ? "is-active" : ""} ${linkedTab ? "is-live-pin" : "is-closed-pin"}`}
        onDragStart={(e) => {
          onDragStartItem({
            kind: "pinned",
            pinId: pin.id,
            title: displayTitle,
            url: pin.url,
            favIconUrl: pin.favIconUrl
          })
          e.dataTransfer.effectAllowed = "move"
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          const folderMoveItems: ContextMenuItem[] = activeSpace.folders.map(
            (folder) => ({
              label: `Move to Folder: ${folder.name}`,
              action: async () => {
                await onUpdatePinnedTab(pin.id, (p) => {
                  p.folderId = folder.id
                })
              }
            })
          )

          onOpenContextMenu(e.clientX, e.clientY, [
            ...(isDrifted && linkedTab?.id
              ? [
                  {
                    label: "Reset to Pinned URL",
                    action: async () => {
                      if (linkedTab.id) {
                        await chrome.tabs.update(linkedTab.id, { url: pin.url })
                      }
                    }
                  },
                  {
                    label: "Replace Pinned URL with Current",
                    action: async () => {
                      await onUpdatePinnedTab(pin.id, (p) => {
                        p.url = linkedTab.url || p.url
                        p.title = linkedTab.title || p.title
                      })
                      onShowToast("Updated pinned URL")
                    }
                  }
                ]
              : []),
            ...folderMoveItems,
            ...(pin.folderId
              ? [
                  {
                    label: "Remove from Folder",
                    action: async () => {
                      await onUpdatePinnedTab(pin.id, (p) => {
                        p.folderId = null
                      })
                    }
                  }
                ]
              : []),
            {
              label: "Copy Clean URL",
              action: async () => {
                await onCopyCleanUrl(cleanTrackingUrl(displayUrl))
              }
            },
            {
              label: "Unpin from Space",
              danger: true,
              action: async () => {
                await onCloseOrUnpinTab(pin, undefined)
              }
            }
          ])
        }}>
        <button
          type="button"
          className="tab-main-click"
          title={
            linkedTab
              ? `${displayTitle} (Open)\n${displayUrl}`
              : `${displayTitle} (Closed Pin — Click to open)\n${displayUrl}`
          }
          onClick={() => onActivatePinnedTab(pin, linkedTab)}>
          <img
            className="tab-favicon"
            width={16}
            height={16}
            alt=""
            src={getFaviconUrl(
              displayUrl,
              linkedTab?.favIconUrl || pin.favIconUrl
            )}
            onError={(e) => {
              e.currentTarget.src = DEFAULT_FALLBACK_ICON
            }}
          />
          <span className="tab-title">{displayTitle}</span>
          {linkedTab ? (
            <span className="tab-live-dot" title="Open in current window" />
          ) : (
            <span className="pin-saved-badge" title="Saved Pin (Tab closed)">
              Saved
            </span>
          )}
        </button>

        {isAudibleOrMuted && linkedTab?.id && (
          <button
            type="button"
            className={`tab-audio-btn ${isMuted ? "is-muted" : ""}`}
            title={isMuted ? "Unmute tab" : "Mute tab"}
            aria-label={isMuted ? "Unmute tab" : "Mute tab"}
            onClick={(e) => {
              e.stopPropagation()
              if (linkedTab.id) onToggleMuteTab(linkedTab.id)
            }}>
            {isMuted ? "🔇" : "🔊"}
          </button>
        )}

        <div className="tab-row-actions">
          {isDrifted && linkedTab?.id && (
            <button
              type="button"
              className="row-action-btn"
              title={`Reset to pinned URL (${pin.url})`}
              aria-label="Reset to pinned URL"
              onClick={async (e) => {
                e.stopPropagation()
                if (linkedTab.id) {
                  await chrome.tabs.update(linkedTab.id, { url: pin.url })
                  onShowToast("Reset to pinned URL")
                }
              }}>
              ↩
            </button>
          )}
          {linkedTab && (
            <button
              type="button"
              className="row-action-btn"
              title="Close tab (Keep pinned)"
              aria-label="Close tab (Keep pinned)"
              onClick={(e) => {
                e.stopPropagation()
                onCloseOrUnpinTab(pin, linkedTab)
              }}>
              —
            </button>
          )}
          <button
            type="button"
            className="row-action-btn"
            title="Unpin from Space"
            aria-label="Unpin from Space"
            onClick={(e) => {
              e.stopPropagation()
              onCloseOrUnpinTab(pin, undefined)
            }}>
            ×
          </button>
        </div>
      </li>
    )
  }

  const folders = activeSpace.folders || []
  const rootPins = (activeSpace.pinnedTabs || []).filter((p) => !p.folderId)

  return (
    <>
      <section
        className="arc-space-header-section"
        aria-labelledby="active-space-heading">
        <div className="space-title-row">
          <button
            type="button"
            className="space-heading-btn"
            title="Customize Space Theme & Routing Rules"
            onClick={onOpenSpaceEditor}>
            <span className="space-emoji" aria-hidden="true">
              {activeSpace.icon || "🌿"}
            </span>
            <h1 id="active-space-heading" className="space-title-text">
              {activeSpace.name}
            </h1>
          </button>
          <div className="space-header-actions">
            <button
              type="button"
              className="mini-action-btn"
              aria-label="Create folder in Space"
              title="New Folder"
              onClick={onOpenNewFolder}>
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </button>
            <button
              type="button"
              className="mini-action-btn"
              aria-label="Customize Space theme and domain routing"
              title="Space Theme & Domain Rules"
              onClick={onOpenSpaceEditor}>
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <section
        className={`arc-pinned-section ${dragOverRoot ? "is-drag-over" : ""}`}
        aria-label="Pinned Tabs and Folders"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOverRoot(true)
        }}
        onDragLeave={() => setDragOverRoot(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDragOverRoot(false)
          if (dragPayload) {
            await onDropIntoFolder(null, dragPayload)
          }
        }}>
        <h2 className="sr-only">Pinned Tabs</h2>
        <div className="folders-list">
          {folders.map((folder) => {
            const folderPins = activeSpace.pinnedTabs.filter(
              (p) => p.folderId === folder.id
            )
            const isCollapsed = Boolean(folder.collapsed && !filterQuery)

            return (
              <div
                key={folder.id}
                className={`folder-group ${isCollapsed ? "is-collapsed" : ""}`}>
                <div
                  className={`folder-header-row ${dragOverFolderId === folder.id ? "is-drag-over" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOverFolderId(folder.id)
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOverFolderId(null)
                    if (dragPayload) {
                      await onDropIntoFolder(folder.id, dragPayload)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onOpenContextMenu(e.clientX, e.clientY, [
                      {
                        label: "Open All Folder Tabs",
                        action: async () => {
                          for (const p of folderPins) {
                            await onActivatePinnedTab(p, undefined)
                          }
                        }
                      },
                      {
                        label: "Rename Folder",
                        action: () => onOpenRenameFolder(folder)
                      },
                      {
                        label: "Delete Folder (Keep Tabs)",
                        danger: true,
                        action: async () => {
                          await onDeleteFolder(folder.id)
                        }
                      }
                    ])
                  }}>
                  <button
                    type="button"
                    className="folder-toggle-btn"
                    aria-expanded={!folder.collapsed}
                    onClick={() => onToggleFolderCollapse(folder.id)}>
                    <svg
                      className="folder-chevron"
                      aria-hidden="true"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <svg
                      className="folder-icon"
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor">
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>
                    <span className="folder-name">{folder.name}</span>
                    <span className="folder-count">{folderPins.length}</span>
                  </button>
                </div>
                <ul className="folder-children">
                  {folderPins.map((pin) => renderPinnedRow(pin))}
                </ul>
              </div>
            )
          })}
        </div>

        <ul className="tab-list pinned-list">
          {rootPins.map((pin) => renderPinnedRow(pin))}
        </ul>

        {folders.length === 0 && rootPins.length === 0 && (
          <div className="pinned-empty-drop">
            <span>Drag tabs here or click 📌 to pin to this Space</span>
          </div>
        )}
      </section>
    </>
  )
}
