import React, { useState } from "react"
import {
  chromeGroupColorHex,
  formatSpaceGroupTitle,
  hueToChromeGroupColor
} from "~lib/url-utils"
import type { ArcSpace, ContextMenuItem, DragPayload } from "~types/arc"

interface SpacesTopSwitcherProps {
  spaces: ArcSpace[]
  activeSpace: ArcSpace
  tabCountsBySpace: Record<string, number>
  dragPayload: DragPayload | null
  onSwitchSpace: (spaceId: string) => Promise<void>
  onMoveTabToSpace: (tabId: number, spaceId: string) => Promise<void>
  onSyncNativeGroups: () => Promise<void>
  onOpenCreateSpace: () => void
  onOpenEditSpace: () => void
  onOpenArcImport: () => void
  onOpenContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
}

export function SpacesTopSwitcher({
  spaces,
  activeSpace,
  tabCountsBySpace,
  dragPayload,
  onSwitchSpace,
  onMoveTabToSpace,
  onSyncNativeGroups,
  onOpenCreateSpace,
  onOpenEditSpace,
  onOpenArcImport,
  onOpenContextMenu
}: SpacesTopSwitcherProps) {
  const [dragOverSpaceId, setDragOverSpaceId] = useState<string | null>(null)

  return (
    <nav className="arc-top-spaces-section" aria-label="Arc Spaces">
      <div className="top-spaces-grid">
        {spaces.map((space) => {
          const isActive = space.id === activeSpace.id
          const isDragOver = dragOverSpaceId === space.id
          const groupColor = hueToChromeGroupColor(space.theme?.hue)
          const groupHex = chromeGroupColorHex(groupColor)
          const tabCount = tabCountsBySpace[space.id] || 0

          return (
            <button
              key={space.id}
              type="button"
              className={`top-space-tile ${isActive ? "is-active" : ""} ${isDragOver ? "is-drag-over" : ""}`}
              style={
                {
                  "--tile-hue": space.theme?.hue ?? 256,
                  "--tile-accent": space.theme?.accentHue ?? 318,
                  "--group-color": groupHex
                } as React.CSSProperties
              }
              title={`${formatSpaceGroupTitle(space)} — Synced as Native Chrome "${groupColor}" Tab Group (${tabCount} open tab${tabCount === 1 ? "" : "s"})\nClick to switch Space • Drop tabs here to move`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSwitchSpace(space.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                onOpenContextMenu(e.clientX, e.clientY, [
                  {
                    label: `Switch to ${space.icon} ${space.name}`,
                    action: async () => {
                      await onSwitchSpace(space.id)
                    }
                  },
                  {
                    label: `Customize ${space.name} Theme & Group Color`,
                    action: async () => {
                      await onSwitchSpace(space.id)
                      onOpenEditSpace()
                    }
                  },
                  {
                    label: "Sync Open Tabs with Native Chrome Tab Groups",
                    action: async () => {
                      await onSyncNativeGroups()
                    }
                  },
                  {
                    label: "Create New Space (Native Tab Group)...",
                    action: () => onOpenCreateSpace()
                  },
                  {
                    label: "🌈 Import from Arc Browser...",
                    action: () => onOpenArcImport()
                  }
                ])
              }}
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
              <span
                className="top-space-group-pill"
                aria-hidden="true"
                title={`Native Chrome Tab Group (${groupColor})`}>
                <span className="top-space-group-dot" />
                {tabCount > 0 && (
                  <span className="top-space-group-count">{tabCount}</span>
                )}
              </span>
              <span className="top-space-icon" aria-hidden="true">
                {space.icon || "🌿"}
              </span>
              <span className="top-space-name">{space.name}</span>
            </button>
          )
        })}

        <button
          type="button"
          className="top-space-add-tile"
          aria-label="Create new Space and Native Chrome Tab Group"
          title="Create New Space (Also creates a Native Chrome Tab Group)"
          onClick={onOpenCreateSpace}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </nav>
  )
}
