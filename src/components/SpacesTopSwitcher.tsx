import React, { useState } from "react"
import type { ArcSpace, ContextMenuItem, DragPayload } from "~types/arc"

interface SpacesTopSwitcherProps {
  spaces: ArcSpace[]
  activeSpace: ArcSpace
  dragPayload: DragPayload | null
  onSwitchSpace: (spaceId: string) => Promise<void>
  onMoveTabToSpace: (tabId: number, spaceId: string) => Promise<void>
  onOpenCreateSpace: () => void
  onOpenEditSpace: () => void
  onOpenContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
}

export function SpacesTopSwitcher({
  spaces,
  activeSpace,
  dragPayload,
  onSwitchSpace,
  onMoveTabToSpace,
  onOpenCreateSpace,
  onOpenEditSpace,
  onOpenContextMenu
}: SpacesTopSwitcherProps) {
  const [dragOverSpaceId, setDragOverSpaceId] = useState<string | null>(null)

  return (
    <nav className="arc-top-spaces-section" aria-label="Arc Spaces">
      <div className="top-spaces-grid">
        {spaces.map((space) => {
          const isActive = space.id === activeSpace.id
          const isDragOver = dragOverSpaceId === space.id

          return (
            <button
              key={space.id}
              type="button"
              className={`top-space-tile ${isActive ? "is-active" : ""} ${isDragOver ? "is-drag-over" : ""}`}
              style={
                {
                  "--tile-hue": space.theme?.hue ?? 256,
                  "--tile-accent": space.theme?.accentHue ?? 318
                } as React.CSSProperties
              }
              title={`Switch to ${space.name} Space (Drop tabs here to move)`}
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
                    label: `Customize ${space.name} Theme & Rules`,
                    action: async () => {
                      await onSwitchSpace(space.id)
                      onOpenEditSpace()
                    }
                  },
                  {
                    label: "Create New Space...",
                    action: () => onOpenCreateSpace()
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
          aria-label="Create new Space"
          title="Create New Space"
          onClick={onOpenCreateSpace}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </nav>
  )
}
