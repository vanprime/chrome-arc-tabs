import React, { useCallback, useEffect, useRef, useState } from "react"
import { FavoritesGrid } from "~components/FavoritesGrid"
import { MediaBar } from "~components/MediaBar"
import { ArchiveDialog } from "~components/modals/ArchiveDialog"
import { CommandDialog } from "~components/modals/CommandDialog"
import { FolderDialog } from "~components/modals/FolderDialog"
import { SpaceDialog } from "~components/modals/SpaceDialog"
import { PinnedSection } from "~components/PinnedSection"
import { SpacesTopSwitcher } from "~components/SpacesTopSwitcher"
import { TodaySection } from "~components/TodaySection"
import { TopBar } from "~components/TopBar"
import { DEFAULT_ARC_STATE, saveArcState } from "~lib/storage"
import {
  cleanTrackingUrl,
  formatCleanDomain,
  urlsRoughlyMatch
} from "~lib/url-utils"
import type {
  ArcFolder,
  ArcSpace,
  ArcState,
  ArcTheme,
  ContextMenuItem,
  DragPayload
} from "~types/arc"

import "./style.css"

export default function ArcSidePanel() {
  const [arcState, setArcState] = useState<ArcState>(DEFAULT_ARC_STATE)
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([])
  const [windowState, setWindowState] = useState<string>("normal")
  const [filterQuery, setFilterQuery] = useState("")
  const [tidyGroupedMode, setTidyGroupedMode] = useState(false)
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modal states
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [spaceModalState, setSpaceModalState] = useState<{
    open: boolean
    isNew: boolean
  }>({ open: false, isNew: false })
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [folderModalState, setFolderModalState] = useState<{
    open: boolean
    folder: ArcFolder | null
  }>({ open: false, folder: null })

  // Custom Context Menu Popover state
  const contextPopoverRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  }>({ x: 0, y: 0, items: [] })

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((text: string) => {
    setToastMessage(text)
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 2000)
  }, [])

  const applySpaceThemeVariables = useCallback((theme?: ArcTheme) => {
    const root = document.documentElement
    const hue = theme?.hue ?? 256
    const accentHue = theme?.accentHue ?? 318
    const sat = theme?.saturation ?? 74
    root.style.setProperty("--space-hue", String(hue))
    root.style.setProperty("--space-accent-hue", String(accentHue))
    root.style.setProperty("--space-sat", `${sat}%`)
  }, [])

  useEffect(() => {
    if (!document.querySelector('meta[name="color-scheme"]')) {
      const meta = document.createElement("meta")
      meta.name = "color-scheme"
      meta.content = "light dark"
      document.head.appendChild(meta)
    }
  }, [])

  const reconcileAndSetSnapshot = useCallback(
    (
      nextArcState: ArcState,
      nextTabs: chrome.tabs.Tab[],
      nextWinState = "normal"
    ) => {
      const cloned = structuredClone(nextArcState)
      const openTabMap = new Map(nextTabs.map((t) => [t.id, t]))

      for (const space of cloned.spaces) {
        for (const pin of space.pinnedTabs) {
          if (pin.linkedTabId && !openTabMap.has(pin.linkedTabId)) {
            pin.linkedTabId = null
          }
          if (!pin.linkedTabId) {
            const match = nextTabs.find((t) => urlsRoughlyMatch(t.url, pin.url))
            if (match?.id) {
              pin.linkedTabId = match.id
            }
          }
        }
      }

      setArcState(cloned)
      setTabs(nextTabs)
      setWindowState(nextWinState)
    },
    []
  )

  const refreshSnapshot = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_ARC_SNAPSHOT"
      })
      if (response?.ok) {
        reconcileAndSetSnapshot(
          response.arcState,
          response.tabs || [],
          response.windowState || "normal"
        )
      } else {
        const stored = await chrome.storage.local.get("arcState")
        const queriedTabs = await chrome.tabs.query({ currentWindow: true })
        reconcileAndSetSnapshot(
          stored.arcState || DEFAULT_ARC_STATE,
          queriedTabs
        )
      }
    } catch (err) {
      console.error("Failed to refresh snapshot:", err)
    }
  }, [reconcileAndSetSnapshot])

  const updateAndPersistState = useCallback(
    async (mutator: (draft: ArcState) => void) => {
      const next = structuredClone(arcState)
      mutator(next)
      setArcState(next)
      await saveArcState(next)
    },
    [arcState]
  )

  const activeSpace: ArcSpace =
    arcState.spaces.find((s) => s.id === arcState.activeSpaceId) ||
    arcState.spaces[0] ||
    DEFAULT_ARC_STATE.spaces[0]

  const activeTab = tabs.find((t) => t.active) || null
  const audibleTab = tabs.find((t) => t.audible || t.mutedInfo?.muted)

  useEffect(() => {
    applySpaceThemeVariables(activeSpace.theme)
  }, [activeSpace.theme, applySpaceThemeVariables])

  const copyTextWithToast = useCallback(
    async (text: string) => {
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        showToast("Copied Clean URL to Clipboard")
      } catch (err) {
        console.error("Clipboard copy failed:", err)
      }
    },
    [showToast]
  )

  useEffect(() => {
    refreshSnapshot()

    const handleTabEvent = () => {
      refreshSnapshot()
    }
    const handleTabUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (
        changeInfo.status ||
        changeInfo.title ||
        changeInfo.url ||
        changeInfo.pinned !== undefined ||
        changeInfo.audible !== undefined ||
        changeInfo.mutedInfo !== undefined ||
        changeInfo.discarded !== undefined
      ) {
        refreshSnapshot()
      }
    }

    const handleStorageChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes.arcState?.newValue) {
        refreshSnapshot()
      }
    }

    const handleRuntimeMessage = (message: any) => {
      if (message?.type === "ARC_OPEN_COMMAND_BAR") {
        setIsCommandOpen(true)
      } else if (message?.type === "ARC_SIDEBAR_COPY_URL" && message.text) {
        copyTextWithToast(message.text)
      }
    }

    chrome.tabs.onCreated.addListener(handleTabEvent)
    chrome.tabs.onRemoved.addListener(handleTabEvent)
    chrome.tabs.onActivated.addListener(handleTabEvent)
    chrome.tabs.onMoved.addListener(handleTabEvent)
    chrome.tabs.onUpdated.addListener(handleTabUpdated)
    chrome.storage.onChanged.addListener(handleStorageChanged)
    chrome.runtime.onMessage.addListener(handleRuntimeMessage)

    return () => {
      chrome.tabs.onCreated.removeListener(handleTabEvent)
      chrome.tabs.onRemoved.removeListener(handleTabEvent)
      chrome.tabs.onActivated.removeListener(handleTabEvent)
      chrome.tabs.onMoved.removeListener(handleTabEvent)
      chrome.tabs.onUpdated.removeListener(handleTabUpdated)
      chrome.storage.onChanged.removeListener(handleStorageChanged)
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
    }
  }, [refreshSnapshot, copyTextWithToast])

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "t")
      ) {
        e.preventDefault()
        setIsCommandOpen(true)
      } else if (e.altKey && ["1", "2", "3", "4", "5", "6"].includes(e.key)) {
        const idx = Number(e.key) - 1
        const targetSpace = arcState.spaces[idx]
        if (targetSpace) {
          e.preventDefault()
          await updateAndPersistState((draft) => {
            draft.activeSpaceId = targetSpace.id
          })
          showToast(`Switched to ${targetSpace.icon} ${targetSpace.name}`)
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [arcState.spaces, updateAndPersistState, showToast])

  const openCustomContextMenu = useCallback(
    (clientX: number, clientY: number, items: ContextMenuItem[]) => {
      const maxLeft = Math.max(8, window.innerWidth - 200)
      const maxTop = Math.max(
        8,
        window.innerHeight - (items.length * 32 + 24)
      )
      setContextMenu({
        x: Math.min(clientX, maxLeft),
        y: Math.min(clientY, maxTop),
        items
      })
      const pop = contextPopoverRef.current as any
      if (pop && typeof pop.showPopover === "function") {
        pop.showPopover()
      }
    },
    []
  )

  const activateOrOpenUrl = useCallback(
    async (url: string, spaceId?: string) => {
      const existing = tabs.find((t) => urlsRoughlyMatch(t.url, url))
      if (existing?.id) {
        await chrome.runtime.sendMessage({
          type: "ACTIVATE_TAB",
          tabId: existing.id
        })
      } else {
        await chrome.runtime.sendMessage({
          type: "CREATE_TAB",
          url,
          spaceId: spaceId || activeSpace.id
        })
      }
    },
    [tabs, activeSpace.id]
  )

  const addItemToFavorites = useCallback(
    async (title: string, url: string, favIconUrl = "") => {
      if (!url) return
      if (arcState.favorites.some((f) => urlsRoughlyMatch(f.url, url))) {
        showToast("Already in Favorites")
        return
      }
      await updateAndPersistState((draft) => {
        draft.favorites.push({
          id: `fav-${Date.now()}`,
          title: title || formatCleanDomain(url),
          url,
          favIconUrl
        })
      })
      showToast("Added to Favorites")
    },
    [arcState.favorites, updateAndPersistState, showToast]
  )

  const pinTabToActiveSpace = useCallback(
    async (tab: chrome.tabs.Tab, folderId: string | null = null) => {
      if (!tab.url || !tab.id) return
      const tabId = tab.id
      const tabUrl = tab.url
      const exists = activeSpace.pinnedTabs.some(
        (p) => p.linkedTabId === tabId || urlsRoughlyMatch(p.url, tabUrl)
      )
      if (exists) {
        showToast(`Already pinned in ${activeSpace.name}`)
        return
      }
      await updateAndPersistState((draft) => {
        const sp = draft.spaces.find((s) => s.id === activeSpace.id)
        if (!sp) return
        sp.pinnedTabs.push({
          id: `pin-${Date.now()}`,
          title: tab.title || formatCleanDomain(tabUrl),
          url: tabUrl,
          favIconUrl: tab.favIconUrl || "",
          folderId,
          linkedTabId: tabId
        })
        draft.tabSpaceMap[tabId] = sp.id
      })
      showToast(`Pinned to ${activeSpace.name}`)
    },
    [activeSpace, updateAndPersistState, showToast]
  )

  const linkedTabIds = new Set<number>()
  for (const sp of arcState.spaces) {
    for (const p of sp.pinnedTabs) {
      if (p.linkedTabId) linkedTabIds.add(p.linkedTabId)
    }
  }

  const todayTabs = tabs.filter((tab) => {
    if (!tab.id || linkedTabIds.has(tab.id)) return false
    if (filterQuery) {
      const q = filterQuery.toLowerCase()
      const matchTitle = (tab.title || "").toLowerCase().includes(q)
      const matchUrl = (tab.url || "").toLowerCase().includes(q)
      if (!matchTitle && !matchUrl) return false
    }
    if (arcState.viewAllSpacesTabs) return true
    const assigned = arcState.tabSpaceMap[tab.id] || arcState.activeSpaceId
    return assigned === activeSpace.id
  })

  const clearTodayTabs = useCallback(async () => {
    const closable = todayTabs.filter((t) => !t.active && !t.audible && t.id)
    if (closable.length === 0) {
      showToast("No inactive Today tabs to clear")
      return
    }
    const now = Date.now()
    await updateAndPersistState((draft) => {
      for (const tab of closable) {
        if (tab.id && tab.url && !tab.url.startsWith("chrome://newtab")) {
          draft.archive.unshift({
            id: `arch-${now}-${tab.id}`,
            title: tab.title || tab.url,
            url: tab.url,
            favIconUrl: tab.favIconUrl || "",
            spaceId: activeSpace.id,
            archivedAt: now,
            reason: `Cleared from ${activeSpace.name}`
          })
        }
      }
      draft.archive = draft.archive.slice(0, 120)
    })
    const ids = closable
      .map((t) => t.id)
      .filter((id): id is number => typeof id === "number")
    if (ids.length > 0) {
      await chrome.tabs.remove(ids)
    }
    showToast(
      `Archived ${closable.length} Today tab${closable.length > 1 ? "s" : ""}`
    )
  }, [todayTabs, activeSpace, updateAndPersistState, showToast])

  const suspendInactiveTabs = useCallback(async () => {
    let count = 0
    for (const tab of tabs) {
      if (tab.id && !tab.active && !tab.audible && !tab.discarded) {
        try {
          await chrome.tabs.discard(tab.id)
          count++
        } catch {
          // Cannot discard
        }
      }
    }
    await refreshSnapshot()
    showToast(
      count > 0
        ? `Suspended ${count} inactive tab${count > 1 ? "s" : ""}`
        : "All inactive tabs already suspended"
    )
  }, [tabs, refreshSnapshot, showToast])

  const closeDuplicateTabs = useCallback(async () => {
    const seen = new Set<string>()
    const dupIds: number[] = []
    for (const tab of tabs) {
      if (!tab.id) continue
      const norm = cleanTrackingUrl(tab.url || "")
      if (!norm) continue
      if (seen.has(norm) && !tab.active) {
        dupIds.push(tab.id)
      } else {
        seen.add(norm)
      }
    }
    if (dupIds.length > 0) {
      await chrome.tabs.remove(dupIds)
      showToast(
        `Closed ${dupIds.length} duplicate tab${dupIds.length > 1 ? "s" : ""}`
      )
    } else {
      showToast("No duplicate tabs found")
    }
  }, [tabs, showToast])

  const syncChromeTabGroups = useCallback(async () => {
    const groups = await chrome.tabGroups.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT
    })
    if (groups.length === 0) {
      showToast("No Chrome Tab Groups in this window")
      return
    }
    await updateAndPersistState((draft) => {
      const sp = draft.spaces.find((s) => s.id === activeSpace.id)
      if (!sp) return
      for (const grp of groups) {
        if (grp.title === "Arc") continue
        const folderName = grp.title || `Group ${grp.id}`
        let folder = sp.folders.find((f) => f.name === folderName)
        if (!folder) {
          folder = {
            id: `folder-${Date.now()}-${grp.id}`,
            name: folderName,
            collapsed: Boolean(grp.collapsed),
            color: grp.color || "blue"
          }
          sp.folders.push(folder)
        }
        const groupTabs = tabs.filter((t) => t.groupId === grp.id)
        for (const t of groupTabs) {
          const exists = sp.pinnedTabs.some((p) =>
            urlsRoughlyMatch(p.url, t.url)
          )
          if (!exists && t.url && t.id) {
            sp.pinnedTabs.push({
              id: `pin-${Date.now()}-${t.id}`,
              title: t.title || formatCleanDomain(t.url),
              url: t.url,
              favIconUrl: t.favIconUrl || "",
              folderId: folder.id,
              linkedTabId: t.id
            })
          }
        }
      }
    })
    showToast("Synced Chrome Tab Groups to Folders")
  }, [activeSpace.id, tabs, updateAndPersistState, showToast])

  const importBookmarksBar = useCallback(async () => {
    try {
      const tree = await chrome.bookmarks.getTree()
      const bar = tree?.[0]?.children?.[0]
      if (!bar?.children?.length) {
        showToast("Bookmarks Bar is empty")
        return
      }
      let count = 0
      await updateAndPersistState((draft) => {
        const sp = draft.spaces.find((s) => s.id === activeSpace.id)
        if (!sp) return
        const folder: ArcFolder = {
          id: `folder-bm-${Date.now()}`,
          name: "Bookmarks Bar",
          collapsed: false,
          color: "purple"
        }
        sp.folders.push(folder)
        for (const node of bar.children!.slice(0, 24)) {
          if (node.url) {
            sp.pinnedTabs.push({
              id: `pin-bm-${Date.now()}-${count}`,
              title: node.title || formatCleanDomain(node.url),
              url: node.url,
              favIconUrl: "",
              folderId: folder.id,
              linkedTabId: null
            })
            count++
          }
        }
      })
      showToast(`Imported ${count} bookmarks into folder`)
    } catch (err) {
      console.error("Error importing bookmarks:", err)
      showToast("Could not import bookmarks")
    }
  }, [activeSpace.id, updateAndPersistState, showToast])

  const handleToggleChromelessMode = useCallback(async () => {
    const res = await chrome.runtime.sendMessage({
      type: "TOGGLE_CHROMELESS_MODE"
    })
    if (res?.ok) {
      await refreshSnapshot()
      showToast(
        res.chromeless
          ? "Entered Arc Chromeless Mode (Native Top Bar Hidden)"
          : "Exited Arc Chromeless Mode"
      )
    }
  }, [refreshSnapshot, showToast])

  return (
    <div className="arc-shell">
      <TopBar
        activeTab={activeTab}
        activeSpace={activeSpace}
        filterQuery={filterQuery}
        isChromeless={
          windowState === "fullscreen" || Boolean(arcState.dockedSidebarMode)
        }
        onFilterChange={setFilterQuery}
        onOpenCommandBar={() => setIsCommandOpen(true)}
        onNavigateOmnibox={async (input, newTab) => {
          await chrome.runtime.sendMessage({
            type: "NAVIGATE_ACTIVE_TAB",
            input,
            newTab
          })
          await refreshSnapshot()
        }}
        onCopyCleanUrl={async () => {
          if (activeTab?.url) {
            const clean = cleanTrackingUrl(activeTab.url)
            await copyTextWithToast(clean)
            await chrome.runtime.sendMessage({
              type: "CLEAN_URL_REQUEST",
              url: clean
            })
          }
        }}
        onPinActiveTab={async () => {
          const res = await chrome.runtime.sendMessage({
            type: "PIN_ACTIVE_TAB"
          })
          if (res?.ok) {
            showToast(
              res.pinned
                ? `Pinned to ${res.spaceName}`
                : `Unpinned from ${res.spaceName}`
            )
            await refreshSnapshot()
          }
        }}
        onToggleChromelessMode={handleToggleChromelessMode}
        onOpenArchive={() => setIsArchiveOpen(true)}
      />

      <main className="arc-main-scroll">
        {/* Top Large-Icon Spaces Switcher (Personal, Work, Research) */}
        <SpacesTopSwitcher
          spaces={arcState.spaces}
          activeSpace={activeSpace}
          dragPayload={dragPayload}
          onSwitchSpace={async (spaceId) => {
            await updateAndPersistState((draft) => {
              draft.activeSpaceId = spaceId
            })
          }}
          onMoveTabToSpace={async (tabId, spaceId) => {
            setDragPayload(null)
            const target = arcState.spaces.find((s) => s.id === spaceId)
            await updateAndPersistState((draft) => {
              draft.tabSpaceMap[tabId] = spaceId
            })
            if (target) {
              showToast(`Moved tab to ${target.name}`)
            }
          }}
          onOpenCreateSpace={() =>
            setSpaceModalState({ open: true, isNew: true })
          }
          onOpenEditSpace={() =>
            setSpaceModalState({ open: true, isNew: false })
          }
          onOpenContextMenu={openCustomContextMenu}
        />

        {arcState.showFavoritesGrid !== false && (
          <FavoritesGrid
            favorites={arcState.favorites}
            tabs={tabs}
            dragPayload={dragPayload}
            onDragStartItem={setDragPayload}
            onActivateOrOpenUrl={(url) => activateOrOpenUrl(url)}
            onRemoveFavorite={async (id) => {
              await updateAndPersistState((draft) => {
                draft.favorites = draft.favorites.filter((f) => f.id !== id)
              })
            }}
            onDropToFavorites={async (payload) => {
              setDragPayload(null)
              if (payload.url) {
                await addItemToFavorites(
                  payload.title || "",
                  payload.url,
                  payload.favIconUrl
                )
              }
            }}
            onOpenContextMenu={openCustomContextMenu}
            onCopyCleanUrl={copyTextWithToast}
          />
        )}

        <PinnedSection
          activeSpace={activeSpace}
          tabs={tabs}
          filterQuery={filterQuery}
          dragPayload={dragPayload}
          onDragStartItem={setDragPayload}
          onOpenSpaceEditor={() =>
            setSpaceModalState({ open: true, isNew: false })
          }
          onOpenNewFolder={() =>
            setFolderModalState({ open: true, folder: null })
          }
          onOpenRenameFolder={(folder) =>
            setFolderModalState({ open: true, folder })
          }
          onSyncChromeGroups={syncChromeTabGroups}
          onToggleFolderCollapse={async (folderId) => {
            await updateAndPersistState((draft) => {
              const sp = draft.spaces.find((s) => s.id === activeSpace.id)
              const folder = sp?.folders.find((f) => f.id === folderId)
              if (folder) folder.collapsed = !folder.collapsed
            })
          }}
          onDeleteFolder={async (folderId) => {
            await updateAndPersistState((draft) => {
              const sp = draft.spaces.find((s) => s.id === activeSpace.id)
              if (!sp) return
              for (const p of sp.pinnedTabs) {
                if (p.folderId === folderId) p.folderId = null
              }
              sp.folders = sp.folders.filter((f) => f.id !== folderId)
            })
          }}
          onActivatePinnedTab={async (pin, linkedTab) => {
            if (linkedTab?.id) {
              await chrome.runtime.sendMessage({
                type: "ACTIVATE_TAB",
                tabId: linkedTab.id
              })
            } else {
              const res = await chrome.runtime.sendMessage({
                type: "CREATE_TAB",
                url: pin.url,
                spaceId: activeSpace.id
              })
              if (res?.tab?.id) {
                await updateAndPersistState((draft) => {
                  const sp = draft.spaces.find((s) => s.id === activeSpace.id)
                  const target = sp?.pinnedTabs.find((p) => p.id === pin.id)
                  if (target) target.linkedTabId = res.tab.id
                })
              }
            }
          }}
          onCloseOrUnpinTab={async (pin, linkedTab) => {
            if (linkedTab?.id) {
              await updateAndPersistState((draft) => {
                const sp = draft.spaces.find((s) => s.id === activeSpace.id)
                const target = sp?.pinnedTabs.find((p) => p.id === pin.id)
                if (target) target.linkedTabId = null
              })
              await chrome.runtime.sendMessage({
                type: "CLOSE_TAB",
                tabId: linkedTab.id
              })
            } else {
              await updateAndPersistState((draft) => {
                const sp = draft.spaces.find((s) => s.id === activeSpace.id)
                if (!sp) return
                sp.pinnedTabs = sp.pinnedTabs.filter((p) => p.id !== pin.id)
              })
            }
          }}
          onUpdatePinnedTab={async (pinId, updater) => {
            await updateAndPersistState((draft) => {
              const sp = draft.spaces.find((s) => s.id === activeSpace.id)
              const target = sp?.pinnedTabs.find((p) => p.id === pinId)
              if (target) updater(target)
            })
          }}
          onAddToFavorites={addItemToFavorites}
          onDropIntoFolder={async (folderId, payload) => {
            setDragPayload(null)
            if (payload.kind === "pinned" && payload.pinId) {
              await updateAndPersistState((draft) => {
                const sp = draft.spaces.find((s) => s.id === activeSpace.id)
                const target = sp?.pinnedTabs.find(
                  (p) => p.id === payload.pinId
                )
                if (target) target.folderId = folderId
              })
            } else if (payload.kind === "today-tab" && payload.tabId) {
              const tab = tabs.find((t) => t.id === payload.tabId)
              if (tab) {
                await pinTabToActiveSpace(tab, folderId)
              }
            }
          }}
          onToggleMuteTab={async (tabId) => {
            await chrome.runtime.sendMessage({
              type: "TOGGLE_MUTE_TAB",
              tabId
            })
            await refreshSnapshot()
          }}
          onCopyCleanUrl={copyTextWithToast}
          onOpenContextMenu={openCustomContextMenu}
          onShowToast={showToast}
        />

        <TodaySection
          activeSpace={activeSpace}
          allSpaces={arcState.spaces}
          todayTabs={todayTabs}
          splitPairs={arcState.splitPairs || []}
          viewAllSpacesTabs={arcState.viewAllSpacesTabs}
          tidyGroupedMode={tidyGroupedMode}
          dragPayload={dragPayload}
          onDragStartItem={setDragPayload}
          onToggleScope={async () => {
            const nextVal = !arcState.viewAllSpacesTabs
            await updateAndPersistState((draft) => {
              draft.viewAllSpacesTabs = nextVal
            })
            showToast(
              nextVal
                ? "Showing tabs from all Spaces"
                : `Showing only ${activeSpace.name} tabs`
            )
          }}
          onToggleTidyMode={() => {
            setTidyGroupedMode((prev) => {
              const next = !prev
              showToast(
                next
                  ? "✨ Tidied Today tabs by domain"
                  : "Restored standard tab list"
              )
              return next
            })
          }}
          onClearTodayTabs={clearTodayTabs}
          onOpenCommandBar={() => setIsCommandOpen(true)}
          onPinTab={(tab) => pinTabToActiveSpace(tab, null)}
          onAddToFavorites={addItemToFavorites}
          onCreateSplitPair={async (targetTab) => {
            if (
              !activeTab?.id ||
              !targetTab.id ||
              activeTab.id === targetTab.id
            ) {
              showToast("Select a different tab to pair with the active tab")
              return
            }
            const leftId = activeTab.id
            const rightId = targetTab.id
            await updateAndPersistState((draft) => {
              draft.splitPairs = (draft.splitPairs || []).filter(
                (p) =>
                  p.leftTabId !== leftId &&
                  p.rightTabId !== leftId &&
                  p.leftTabId !== rightId &&
                  p.rightTabId !== rightId
              )
              draft.splitPairs.push({
                id: `split-${Date.now()}`,
                leftTabId: leftId,
                rightTabId: rightId,
                spaceId: activeSpace.id
              })
            })
            showToast("Paired in Arc Split View")
          }}
          onUnsplitPair={async (pairId) => {
            await updateAndPersistState((draft) => {
              draft.splitPairs = draft.splitPairs.filter((p) => p.id !== pairId)
            })
          }}
          onMoveTabToSpace={async (tabId, spaceId) => {
            const targetSpace = arcState.spaces.find((s) => s.id === spaceId)
            await updateAndPersistState((draft) => {
              draft.tabSpaceMap[tabId] = spaceId
            })
            if (targetSpace) {
              showToast(`Moved to ${targetSpace.name}`)
            }
          }}
          onToggleMuteTab={async (tabId) => {
            await chrome.runtime.sendMessage({
              type: "TOGGLE_MUTE_TAB",
              tabId
            })
            await refreshSnapshot()
          }}
          onCopyCleanUrl={copyTextWithToast}
          onOpenContextMenu={openCustomContextMenu}
          onRefresh={refreshSnapshot}
        />
      </main>

      <MediaBar
        audibleTab={audibleTab}
        onToggleMuteTab={async (tabId) => {
          await chrome.runtime.sendMessage({
            type: "TOGGLE_MUTE_TAB",
            tabId
          })
          await refreshSnapshot()
        }}
      />

      {toastMessage && (
        <div className="sidebar-toast" role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Non-Modal Popover: Quick Settings & Native Chrome Integration */}
      <div
        id="settings-popover"
        className="arc-popover settings-menu"
        {...({ popover: "auto" } as any)}>
        <div className="popover-section-title">
          Native Chrome Integration &amp; Layout
        </div>

        <button
          type="button"
          className="popover-action-item"
          onClick={handleToggleChromelessMode}>
          <span>
            ⛶{" "}
            {windowState === "fullscreen"
              ? "Exit Chromeless Fullscreen Mode"
              : "Enter Arc Chromeless Mode (Hide Native Top Bar)"}
          </span>
        </button>

        <label className="setting-row" htmlFor="toggle-collapse-native">
          <span>Auto-Collapse Inactive Tabs in Chrome Top Strip</span>
          <input
            id="toggle-collapse-native"
            type="checkbox"
            checked={Boolean(arcState.collapseNativeTabs)}
            onChange={async (e) => {
              const enabled = e.target.checked
              await chrome.runtime.sendMessage({
                type: "SET_COLLAPSE_NATIVE_TABS",
                enabled
              })
              await refreshSnapshot()
              showToast(
                enabled
                  ? "Collapsed background tabs into [Arc] pill"
                  : "Ungrouped native Chrome tab strip"
              )
            }}
          />
        </label>

        <label className="setting-row" htmlFor="toggle-docked-sidebar">
          <span>Dock In-Page Left Sidebar on Webpages</span>
          <input
            id="toggle-docked-sidebar"
            type="checkbox"
            checked={Boolean(arcState.dockedSidebarMode)}
            onChange={async (e) => {
              const checked = e.target.checked
              await updateAndPersistState((draft) => {
                draft.dockedSidebarMode = checked
              })
            }}
          />
        </label>

        <label className="setting-row" htmlFor="toggle-left-peek">
          <span>In-Page Left-Edge Hover Peek</span>
          <input
            id="toggle-left-peek"
            type="checkbox"
            checked={arcState.leftPeekEnabled !== false}
            onChange={async (e) => {
              const checked = e.target.checked
              await updateAndPersistState((draft) => {
                draft.leftPeekEnabled = checked
              })
            }}
          />
        </label>

        <label className="setting-row" htmlFor="toggle-show-favorites">
          <span>Show Suggested Favorites Icons Row</span>
          <input
            id="toggle-show-favorites"
            type="checkbox"
            checked={arcState.showFavoritesGrid !== false}
            onChange={async (e) => {
              const checked = e.target.checked
              await updateAndPersistState((draft) => {
                draft.showFavoritesGrid = checked
              })
            }}
          />
        </label>

        <label className="setting-row" htmlFor="select-auto-archive">
          <span>Auto-Archive Inactive Tabs</span>
          <select
            id="select-auto-archive"
            className="arc-select"
            value={String(arcState.autoArchiveHours ?? 12)}
            onChange={async (e) => {
              const hours = Number(e.target.value)
              await updateAndPersistState((draft) => {
                draft.autoArchiveHours = hours
              })
              showToast(
                hours > 0
                  ? `Auto-archive set to ${hours}h`
                  : "Auto-archive disabled"
              )
            }}>
            <option value="12">12 Hours (Arc)</option>
            <option value="24">24 Hours</option>
            <option value="72">3 Days</option>
            <option value="0">Never</option>
          </select>
        </label>

        <hr className="popover-hr" />

        <button
          type="button"
          className="popover-action-item"
          onClick={suspendInactiveTabs}>
          <span>💤 Suspend Inactive Tabs (Save Memory)</span>
        </button>
        <button
          type="button"
          className="popover-action-item"
          onClick={closeDuplicateTabs}>
          <span>🧹 Close Duplicate Tabs</span>
        </button>
        <button
          type="button"
          className="popover-action-item"
          onClick={importBookmarksBar}>
          <span>🔖 Import Bookmarks Bar to Folder</span>
        </button>
      </div>

      {/* Contextual Right-Click Action Menu (Popover) */}
      <div
        ref={contextPopoverRef}
        id="context-menu-popover"
        className="arc-popover context-menu"
        style={{
          insetInlineStart: `${contextMenu.x}px`,
          insetBlockStart: `${contextMenu.y}px`
        }}
        {...({ popover: "auto" } as any)}>
        <div className="context-menu-list">
          {contextMenu.items.map((item, idx) => (
            <button
              key={`${item.label}-${idx}`}
              type="button"
              className={`ctx-item-btn ${item.danger ? "is-danger" : ""}`}
              onClick={async () => {
                const pop = contextPopoverRef.current as any
                if (pop && typeof pop.hidePopover === "function") {
                  pop.hidePopover()
                }
                await item.action()
              }}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      <CommandDialog
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        arcState={arcState}
        activeSpace={activeSpace}
        tabs={tabs}
        activeTab={activeTab}
        onSwitchSpace={async (spaceId) => {
          await updateAndPersistState((draft) => {
            draft.activeSpaceId = spaceId
          })
        }}
        onActivateOrOpenUrl={activateOrOpenUrl}
        onToggleTidyMode={() => {
          setTidyGroupedMode((prev) => !prev)
        }}
        onCopyCleanUrl={copyTextWithToast}
        onClearTodayTabs={clearTodayTabs}
        onSuspendInactiveTabs={suspendInactiveTabs}
      />

      <SpaceDialog
        isOpen={spaceModalState.open}
        isNew={spaceModalState.isNew}
        activeSpace={activeSpace}
        canDelete={arcState.spaces.length > 1}
        onClose={() => setSpaceModalState({ open: false, isNew: false })}
        onPreviewTheme={applySpaceThemeVariables}
        onSaveSpace={async (data) => {
          if (data.isNew) {
            const newSpace: ArcSpace = {
              id: `space-${Date.now()}`,
              name: data.name,
              icon: data.icon,
              theme: {
                hue: data.hue,
                accentHue: data.accentHue,
                saturation: 74,
                style: "custom"
              },
              domainRules: data.domainRules,
              folders: [],
              pinnedTabs: []
            }
            await updateAndPersistState((draft) => {
              draft.spaces.push(newSpace)
              draft.activeSpaceId = newSpace.id
            })
            showToast(`Created Space "${data.name}"`)
          } else {
            await updateAndPersistState((draft) => {
              const sp = draft.spaces.find((s) => s.id === activeSpace.id)
              if (sp) {
                sp.icon = data.icon
                sp.name = data.name
                sp.theme = {
                  hue: data.hue,
                  accentHue: data.accentHue,
                  saturation: 74,
                  style: "custom"
                }
                sp.domainRules = data.domainRules
              }
            })
            showToast(`Saved "${data.name}"`)
          }
        }}
        onDeleteSpace={async () => {
          if (arcState.spaces.length <= 1) return
          const deletedName = activeSpace.name
          await updateAndPersistState((draft) => {
            draft.spaces = draft.spaces.filter((s) => s.id !== activeSpace.id)
            draft.activeSpaceId = draft.spaces[0].id
          })
          showToast(`Deleted Space "${deletedName}"`)
        }}
      />

      <ArchiveDialog
        isOpen={isArchiveOpen}
        archiveEntries={arcState.archive || []}
        onClose={() => setIsArchiveOpen(false)}
        onRestoreUrl={(url) => activateOrOpenUrl(url)}
        onClearArchive={async () => {
          await updateAndPersistState((draft) => {
            draft.archive = []
          })
          showToast("Cleared Archive history")
        }}
      />

      <FolderDialog
        isOpen={folderModalState.open}
        editingFolder={folderModalState.folder}
        onClose={() => setFolderModalState({ open: false, folder: null })}
        onSaveFolder={async (name, existingFolderId) => {
          await updateAndPersistState((draft) => {
            const sp = draft.spaces.find((s) => s.id === activeSpace.id)
            if (!sp) return
            if (existingFolderId) {
              const folder = sp.folders.find((f) => f.id === existingFolderId)
              if (folder) folder.name = name
            } else {
              sp.folders.push({
                id: `folder-${Date.now()}`,
                name,
                collapsed: false,
                color: "blue"
              })
            }
          })
        }}
      />
    </div>
  )
}
