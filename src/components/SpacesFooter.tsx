import React, { useState } from "react"
import type { ArcSpace, DragPayload } from "~types/arc"

interface SpacesFooterProps {
  spaces: ArcSpace[]
  activeSpace: ArcSpace
  dragPayload: DragPayload | null
  onSwitchSpace: (spaceId: string) => Promise<void>
  onMoveTabToSpace: (tabId: number, spaceId: string) => Promise<void>
  onOpenArchive: () => void
  onOpenCreateSpace: () => void
}

export function SpacesFooter({
  spaces,
  activeSpace,
  dragPayload,
  onSwitchSpace,
  onMoveTabToSpace,
  onOpenArchive,
  onOpenCreateSpace
}: SpacesFooterProps) {
  const [dragOverSpaceId, setDragOverSpaceId] = useState<string | null>(null)

  return (
    <footer className="arc-footer">
      <button
        type="button"
        className="footer-icon-btn"
        aria-label="Open Archive and Recently Closed Tabs"
        title="Archive & Recently Closed"
        onClick={onOpenArchive}>
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      <nav className="spaces-switcher-nav" aria-label="Arc Spaces">
        <div className="spaces-dock">
          {spaces.map((space) => (
            <button
              key={space.id}
              type="button"
              className={`space-dock-btn ${space.id === activeSpace.id ? "is-active" : ""} ${dragOverSpaceId === space.id ? "is-drag-over" : ""}`}
              title={`Switch to ${space.name}`}
              onClick={() => onSwitchSpace(space.id)}
              onDragOver={(e) => {
                if (dragPayload?.kind === "today-tab") {
                  e.preventDefault()
                  setDragOverSpaceId(space.id)
                }
              }}
              onDragLeave={() => setDragOverSpaceId(null)}
              onDrop={async (e) => {
                e.preventDefault()
                setDragOverSpaceId(null)
                if (dragPayload?.kind === "today-tab" && dragPayload.tabId) {
                  await onMoveTabToSpace(dragPayload.tabId, space.id)
                }
              }}>
              <span aria-hidden="true">{space.icon || "🌿"}</span>
              <span>{space.name}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="footer-right-controls">
        <button
          type="button"
          className="footer-icon-btn"
          aria-label="Create new Space"
          title="New Space"
          onClick={onOpenCreateSpace}>
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          {...({ popovertarget: "settings-popover" } as any)}
          className="footer-icon-btn"
          aria-label="Arc Sidebar Settings"
          title="Settings & Auto-Archive">
          <svg
            aria-hidden="true"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </footer>
  )
}
