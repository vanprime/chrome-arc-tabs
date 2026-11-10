import React, { useState } from "react"
import {
  cleanTrackingUrl,
  DEFAULT_FALLBACK_ICON,
  getFaviconUrl,
  urlsRoughlyMatch
} from "~lib/url-utils"
import type { ArcFavorite, ContextMenuItem, DragPayload } from "~types/arc"

interface FavoritesGridProps {
  favorites: ArcFavorite[]
  tabs: chrome.tabs.Tab[]
  onActivateOrOpenUrl: (url: string) => Promise<void>
  onRemoveFavorite: (id: string) => Promise<void>
  onDropToFavorites: (payload: DragPayload) => Promise<void>
  onOpenContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
  onCopyCleanUrl: (url: string) => Promise<void>
  onDragStartItem: (payload: DragPayload) => void
  dragPayload: DragPayload | null
}

export function FavoritesGrid({
  favorites,
  tabs,
  onActivateOrOpenUrl,
  onRemoveFavorite,
  onDropToFavorites,
  onOpenContextMenu,
  onCopyCleanUrl,
  onDragStartItem,
  dragPayload
}: FavoritesGridProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <section className="arc-favorites-section" aria-label="Favorites">
      <div
        className={`favorites-grid ${isDragOver ? "is-drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setIsDragOver(false)
          if (dragPayload) {
            await onDropToFavorites(dragPayload)
          }
        }}>
        {favorites.map((fav) => {
          const matchingTab = tabs.find(
            (t) =>
              urlsRoughlyMatch(t.url, fav.url) ||
              (Boolean(fav.url) && Boolean(t.url?.startsWith(fav.url)))
          )
          const isActive = Boolean(matchingTab?.active)
          const isOpen = Boolean(matchingTab)
          const isAudible = Boolean(matchingTab?.audible)

          return (
            <button
              key={fav.id}
              type="button"
              draggable
              className={`favorite-tile ${isActive ? "is-active" : ""} ${isOpen ? "is-open" : ""}`}
              title={`${fav.title}\n${fav.url}`}
              aria-label={fav.title || "Favorite site"}
              onClick={() => onActivateOrOpenUrl(fav.url)}
              onDragStart={(e) => {
                onDragStartItem({
                  kind: "favorite",
                  id: fav.id,
                  title: fav.title,
                  url: fav.url,
                  favIconUrl: fav.favIconUrl
                })
                e.dataTransfer.effectAllowed = "move"
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                onOpenContextMenu(e.clientX, e.clientY, [
                  {
                    label: "Open in New Tab",
                    action: async () => {
                      await chrome.runtime.sendMessage({
                        type: "CREATE_TAB",
                        url: fav.url
                      })
                    }
                  },
                  {
                    label: "Copy Clean URL",
                    action: async () => {
                      await onCopyCleanUrl(cleanTrackingUrl(fav.url))
                    }
                  },
                  {
                    label: "Remove from Favorites",
                    danger: true,
                    action: async () => {
                      await onRemoveFavorite(fav.id)
                    }
                  }
                ])
              }}>
              <img
                className="fav-icon-img"
                width={18}
                height={18}
                alt=""
                src={getFaviconUrl(
                  fav.url,
                  matchingTab?.favIconUrl || fav.favIconUrl
                )}
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_FALLBACK_ICON
                }}
              />
              {isAudible && (
                <span className="fav-audio-dot" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
