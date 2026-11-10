import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  cleanTrackingUrl,
  DEFAULT_FALLBACK_ICON,
  formatCleanDomain,
  getFaviconUrl
} from "~lib/url-utils"
import type { ArcSpace, ArcState, CommandSuggestion } from "~types/arc"

interface CommandDialogProps {
  isOpen: boolean
  onClose: () => void
  arcState: ArcState
  activeSpace: ArcSpace
  tabs: chrome.tabs.Tab[]
  activeTab: chrome.tabs.Tab | null
  onSwitchSpace: (spaceId: string) => Promise<void>
  onActivateOrOpenUrl: (url: string, spaceId?: string) => Promise<void>
  onToggleTidyMode: () => void
  onCopyCleanUrl: (url: string) => Promise<void>
  onClearTodayTabs: () => Promise<void>
  onSuspendInactiveTabs: () => Promise<void>
}

export function CommandDialog({
  isOpen,
  onClose,
  arcState,
  activeSpace,
  tabs,
  activeTab,
  onSwitchSpace,
  onActivateOrOpenUrl,
  onToggleTidyMode,
  onCopyCleanUrl,
  onClearTodayTabs,
  onSuspendInactiveTabs
}: CommandDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      setQuery("")
      setSelectedIndex(0)
      if (!dialog.open) {
        dialog.showModal()
      }
      inputRef.current?.focus()
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

    // Light-dismiss fallback if closedBy is not supported
    let cleanupFallback: (() => void) | undefined
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect()
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
      }
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e)
      }
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) dialog.close()
      }
      dialog.addEventListener("pointerdown", onPointerDown)
      dialog.addEventListener("pointerup", onPointerUp)
      cleanupFallback = () => {
        dialog.removeEventListener("pointerdown", onPointerDown)
        dialog.removeEventListener("pointerup", onPointerUp)
      }
    }

    return () => {
      dialog.removeEventListener("close", handleClose)
      cleanupFallback?.()
    }
  }, [onClose])

  const suggestions = useMemo<CommandSuggestion[]>(() => {
    const q = query.trim().toLowerCase()
    const list: CommandSuggestion[] = []

    if (q.length > 0) {
      const looksLikeUrl =
        /^(https?:\/\/|localhost|\w+\.\w{2,})/.test(q) && !q.includes(" ")
      if (looksLikeUrl) {
        const targetUrl = q.startsWith("http")
          ? query.trim()
          : `https://${query.trim()}`
        list.push({
          title: `Open URL: ${targetUrl}`,
          subtitle: `Navigate in ${activeSpace.name}`,
          badge: "Open URL",
          iconUrl: DEFAULT_FALLBACK_ICON,
          run: async () => {
            await chrome.runtime.sendMessage({
              type: "CREATE_TAB",
              url: targetUrl,
              spaceId: activeSpace.id
            })
          }
        })
      }
      list.push({
        title: `Search Google for "${query.trim()}"`,
        subtitle: "google.com",
        badge: "Web Search",
        iconUrl: getFaviconUrl("https://www.google.com"),
        run: async () => {
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
          await chrome.runtime.sendMessage({
            type: "CREATE_TAB",
            url: searchUrl,
            spaceId: activeSpace.id
          })
        }
      })
    }

    for (const tab of tabs) {
      const tTitle = tab.title || formatCleanDomain(tab.url)
      const tUrl = tab.url || ""
      if (
        !q ||
        tTitle.toLowerCase().includes(q) ||
        tUrl.toLowerCase().includes(q)
      ) {
        list.push({
          title: tTitle,
          subtitle: formatCleanDomain(tUrl),
          badge: tab.active ? "Active Tab" : "Switch to Tab",
          iconUrl: getFaviconUrl(tUrl, tab.favIconUrl),
          run: async () => {
            if (tab.id) {
              await chrome.runtime.sendMessage({
                type: "ACTIVATE_TAB",
                tabId: tab.id
              })
            }
          }
        })
      }
    }

    for (const space of arcState.spaces) {
      for (const pin of space.pinnedTabs) {
        if (
          !q ||
          pin.title.toLowerCase().includes(q) ||
          pin.url.toLowerCase().includes(q)
        ) {
          list.push({
            title: pin.title,
            subtitle: `${space.icon} ${space.name} • ${formatCleanDomain(pin.url)}`,
            badge: "Pinned",
            iconUrl: getFaviconUrl(pin.url, pin.favIconUrl),
            run: async () => {
              await onSwitchSpace(space.id)
              await onActivateOrOpenUrl(pin.url, space.id)
            }
          })
        }
      }
    }

    const quickCommands: CommandSuggestion[] = [
      {
        title: "Tidy Today Tabs by Domain Category",
        subtitle: "Arc Max Smart Tidy",
        badge: "Command",
        iconUrl: DEFAULT_FALLBACK_ICON,
        run: () => onToggleTidyMode()
      },
      {
        title: "Copy Clean URL of Current Tab",
        subtitle: "Strips tracking parameters (⌘⇧C)",
        badge: "Command",
        iconUrl: DEFAULT_FALLBACK_ICON,
        run: async () => {
          if (activeTab?.url) {
            await onCopyCleanUrl(cleanTrackingUrl(activeTab.url))
          }
        }
      },
      {
        title: "Clear & Archive Inactive Today Tabs",
        subtitle: "Moves unpinned Today tabs to Archive",
        badge: "Command",
        iconUrl: DEFAULT_FALLBACK_ICON,
        run: async () => {
          await onClearTodayTabs()
        }
      },
      {
        title: "Suspend Inactive Tabs (Memory Saver)",
        subtitle: "Discards background tabs to free RAM",
        badge: "Command",
        iconUrl: DEFAULT_FALLBACK_ICON,
        run: async () => {
          await onSuspendInactiveTabs()
        }
      }
    ]

    for (const cmd of quickCommands) {
      if (
        !q ||
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle.toLowerCase().includes(q)
      ) {
        list.push(cmd)
      }
    }

    return list.slice(0, 18)
  }, [
    query,
    tabs,
    arcState.spaces,
    activeSpace,
    activeTab,
    onSwitchSpace,
    onActivateOrOpenUrl,
    onToggleTidyMode,
    onCopyCleanUrl,
    onClearTodayTabs,
    onSuspendInactiveTabs
  ])

  const clampedIndex = Math.min(
    selectedIndex,
    Math.max(0, suggestions.length - 1)
  )

  return (
    <dialog
      ref={dialogRef}
      className="arc-modal command-modal"
      {...({ closedby: "any" } as any)}
      aria-labelledby="command-dialog-title">
      <div className="modal-inner">
        <div className="command-header">
          <h2 id="command-dialog-title" className="sr-only">
            Arc Command Bar
          </h2>
          <svg
            className="cmd-search-icon"
            aria-hidden="true"
            width="16"
            height="16"
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
            ref={inputRef}
            type="text"
            className="command-input"
            placeholder="Search tabs, pinned, or enter URL / query..."
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={async (e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                if (suggestions.length > 0) {
                  setSelectedIndex((prev) => (prev + 1) % suggestions.length)
                }
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                if (suggestions.length > 0) {
                  setSelectedIndex(
                    (prev) =>
                      (prev - 1 + suggestions.length) % suggestions.length
                  )
                }
              } else if (e.key === "Enter") {
                e.preventDefault()
                const chosen = suggestions[clampedIndex]
                if (chosen) {
                  dialogRef.current?.close("execute")
                  await chosen.run()
                }
              }
            }}
          />
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Close Command Bar"
            onClick={() => dialogRef.current?.close()}>
            Esc
          </button>
        </div>

        <ul
          className="command-results-list"
          role="listbox"
          aria-label="Command suggestions">
          {suggestions.map((item, idx) => (
            <li key={`${item.title}-${idx}`}>
              <button
                type="button"
                className={`cmd-result-item ${idx === clampedIndex ? "is-selected" : ""}`}
                onClick={async () => {
                  dialogRef.current?.close("execute")
                  await item.run()
                }}>
                <img
                  className="tab-favicon"
                  width={16}
                  height={16}
                  alt=""
                  src={item.iconUrl || DEFAULT_FALLBACK_ICON}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_FALLBACK_ICON
                  }}
                />
                <div className="cmd-item-text">
                  <span className="cmd-item-title">{item.title}</span>
                  <span className="cmd-item-sub">{item.subtitle}</span>
                </div>
                <span className="cmd-badge">{item.badge}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}
