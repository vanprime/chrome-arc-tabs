import React, { useEffect, useRef, useState } from "react"
import {
  DEFAULT_FALLBACK_ICON,
  formatCleanDomain,
  getFaviconUrl
} from "~lib/url-utils"
import type { ArcArchiveEntry } from "~types/arc"

interface ArchiveDialogProps {
  isOpen: boolean
  archiveEntries: ArcArchiveEntry[]
  onClose: () => void
  onRestoreUrl: (url: string) => Promise<void>
  onClearArchive: () => Promise<void>
}

interface CombinedArchiveItem {
  title: string
  url: string
  subtitle: string
  favIconUrl: string
}

export function ArchiveDialog({
  isOpen,
  archiveEntries,
  onClose,
  onRestoreUrl,
  onClearArchive
}: ArchiveDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState("")
  const [recentSessions, setRecentSessions] = useState<CombinedArchiveItem[]>([])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      setQuery("")
      ;(async () => {
        try {
          const sessions = await chrome.sessions.getRecentlyClosed({
            maxResults: 15
          })
          const mapped: CombinedArchiveItem[] = []
          for (const s of sessions) {
            if (s.tab?.url && !s.tab.url.startsWith("chrome://newtab")) {
              mapped.push({
                title: s.tab.title || s.tab.url,
                url: s.tab.url,
                subtitle: `Recently Closed • ${formatCleanDomain(s.tab.url)}`,
                favIconUrl: s.tab.favIconUrl || ""
              })
            }
          }
          setRecentSessions(mapped)
        } catch {
          setRecentSessions([])
        }
      })()
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      dialog.returnValue = ""
      onClose()
    }
    dialog.addEventListener("close", handleClose)
    return () => dialog.removeEventListener("close", handleClose)
  }, [onClose])

  const allItems: CombinedArchiveItem[] = [
    ...archiveEntries.map((entry) => ({
      title: entry.title || entry.url,
      url: entry.url,
      subtitle: `${entry.reason || "Archived"} • ${formatCleanDomain(entry.url)}`,
      favIconUrl: entry.favIconUrl
    })),
    ...recentSessions
  ]

  const q = query.trim().toLowerCase()
  const filtered = allItems.filter(
    (item) =>
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q)
  )

  return (
    <dialog
      ref={dialogRef}
      className="arc-modal"
      {...({ closedby: "any" } as any)}
      aria-labelledby="archive-dialog-title">
      <div className="modal-inner">
        <div className="modal-title-bar">
          <h2 id="archive-dialog-title">Archive &amp; Recently Closed</h2>
          <div className="archive-header-actions">
            <button
              type="button"
              className="btn-text-subtle"
              onClick={onClearArchive}>
              Clear Archive
            </button>
            <button
              type="button"
              className="modal-close-btn"
              aria-label="Close Archive"
              onClick={() => dialogRef.current?.close()}>
              ×
            </button>
          </div>
        </div>

        <div className="archive-search-box">
          <input
            type="search"
            className="arc-input"
            placeholder="Search archived or recently closed tabs..."
            aria-label="Search archived tabs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <ul className="archive-list">
          {filtered.length === 0 ? (
            <li className="pinned-empty-drop">
              No archived or recently closed tabs found.
            </li>
          ) : (
            filtered.map((item, idx) => (
              <li key={`${item.url}-${idx}`}>
                <button
                  type="button"
                  className="cmd-result-item"
                  onClick={async () => {
                    dialogRef.current?.close()
                    await onRestoreUrl(item.url)
                  }}>
                  <img
                    className="tab-favicon"
                    width={16}
                    height={16}
                    alt=""
                    src={getFaviconUrl(item.url, item.favIconUrl)}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_FALLBACK_ICON
                    }}
                  />
                  <div className="cmd-item-text">
                    <span className="cmd-item-title">{item.title}</span>
                    <span className="cmd-item-sub">{item.subtitle}</span>
                  </div>
                  <span className="cmd-badge">Restore</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </dialog>
  )
}
