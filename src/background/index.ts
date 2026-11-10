import { getArcState, saveArcState } from "~lib/storage"
import { cleanTrackingUrl, matchSpaceByDomain } from "~lib/url-utils"

export {}

async function flashActionBadge(text: string, color = "#6E56CF"): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor({ color })
    await chrome.action.setBadgeText({ text })
    await chrome.alarms.create("arc-clear-badge", { delayInMinutes: 0.03 })
  } catch (err) {
    console.error("Failed to set badge:", err)
  }
}

async function setupContextMenus(): Promise<void> {
  try {
    await chrome.contextMenus.removeAll()
    chrome.contextMenus.create({
      id: "arc-pin-page",
      title: "Pin Current Page to Arc Space",
      contexts: ["page"]
    })
    chrome.contextMenus.create({
      id: "arc-favorite-page",
      title: "Add Page to Arc Favorites Bar",
      contexts: ["page"]
    })
    chrome.contextMenus.create({
      id: "arc-save-link-space",
      title: "Pin Link to Active Arc Space",
      contexts: ["link"]
    })
    chrome.contextMenus.create({
      id: "arc-copy-clean-url",
      title: "Copy Clean URL (Arc Style)",
      contexts: ["page", "link"]
    })
  } catch (err) {
    console.error("Context menu setup error:", err)
  }
}

async function ensureSidePanelBehavior(): Promise<void> {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  } catch (err) {
    console.error("Error setting panel behavior:", err)
  }
}

ensureSidePanelBehavior()

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSidePanelBehavior()
  await getArcState()
  await setupContextMenus()
  await chrome.alarms.create("arc-auto-archive", { periodInMinutes: 15 })
})

chrome.runtime.onStartup.addListener(async () => {
  await ensureSidePanelBehavior()
  await chrome.alarms.create("arc-auto-archive", { periodInMinutes: 15 })
})

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.id) return
  try {
    const arcState = await getArcState()
    let targetSpaceId = arcState.activeSpaceId

    if (tab.openerTabId && arcState.tabSpaceMap[tab.openerTabId]) {
      targetSpaceId = arcState.tabSpaceMap[tab.openerTabId]
    }
    const matchedByDomain = matchSpaceByDomain(
      tab.pendingUrl || tab.url,
      arcState.spaces
    )
    if (matchedByDomain) {
      targetSpaceId = matchedByDomain
    }

    arcState.tabSpaceMap[tab.id] = targetSpaceId
    arcState.tabLastActive[tab.id] = Date.now()
    await saveArcState(arcState)
  } catch (err) {
    console.error("Error handling tab creation:", err)
  }
})

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const arcState = await getArcState()
    arcState.tabLastActive[tabId] = Date.now()
    if (!arcState.tabSpaceMap[tabId]) {
      arcState.tabSpaceMap[tabId] = arcState.activeSpaceId
    }
    await saveArcState(arcState)
  } catch (err) {
    console.error("Error tracking tab activation:", err)
  }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return
  try {
    const arcState = await getArcState()
    let changed = false

    if (!arcState.tabSpaceMap[tabId]) {
      arcState.tabSpaceMap[tabId] = arcState.activeSpaceId
      changed = true
    }

    if (changeInfo.url) {
      const matchedSpaceId = matchSpaceByDomain(changeInfo.url, arcState.spaces)
      if (matchedSpaceId && arcState.tabSpaceMap[tabId] !== matchedSpaceId) {
        arcState.tabSpaceMap[tabId] = matchedSpaceId
        changed = true
      }
    }

    for (const space of arcState.spaces) {
      for (const pin of space.pinnedTabs) {
        if (pin.linkedTabId === tabId && tab.favIconUrl && !pin.favIconUrl) {
          pin.favIconUrl = tab.favIconUrl
          changed = true
        }
      }
    }

    if (changed) {
      await saveArcState(arcState)
    }
  } catch (err) {
    console.error("Error on tab update:", err)
  }
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const arcState = await getArcState()
    delete arcState.tabSpaceMap[tabId]
    delete arcState.tabLastActive[tabId]

    for (const space of arcState.spaces) {
      for (const pin of space.pinnedTabs) {
        if (pin.linkedTabId === tabId) {
          pin.linkedTabId = null
        }
      }
    }

    arcState.splitPairs = arcState.splitPairs.filter(
      (pair) => pair.leftTabId !== tabId && pair.rightTabId !== tabId
    )

    await saveArcState(arcState)
  } catch (err) {
    console.error("Error cleaning up removed tab:", err)
  }
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === "arc-clear-badge") {
      await chrome.action.setBadgeText({ text: "" })
      return
    }

    if (alarm.name === "arc-auto-archive") {
      const arcState = await getArcState()
      const hours = Number(arcState.autoArchiveHours)
      if (!hours || hours <= 0) return

      const thresholdMs = hours * 3600 * 1000
      const now = Date.now()
      const allTabs = await chrome.tabs.query({})
      const linkedTabIds = new Set<number>()

      for (const space of arcState.spaces) {
        for (const pin of space.pinnedTabs) {
          if (pin.linkedTabId) linkedTabIds.add(pin.linkedTabId)
        }
      }

      const tabsToArchive: chrome.tabs.Tab[] = []
      for (const tab of allTabs) {
        if (
          !tab.id ||
          tab.active ||
          tab.pinned ||
          tab.audible ||
          linkedTabIds.has(tab.id)
        ) {
          continue
        }
        const lastActive = arcState.tabLastActive[tab.id] || now
        if (now - lastActive > thresholdMs) {
          tabsToArchive.push(tab)
        }
      }

      if (tabsToArchive.length > 0) {
        for (const tab of tabsToArchive) {
          if (tab.id && tab.url && !tab.url.startsWith("chrome://newtab")) {
            arcState.archive.unshift({
              id: `arch-${Date.now()}-${tab.id}`,
              title: tab.title || tab.url,
              url: tab.url,
              favIconUrl: tab.favIconUrl || "",
              spaceId: arcState.tabSpaceMap[tab.id] || arcState.activeSpaceId,
              archivedAt: now,
              reason: `Auto-archived (${hours}h inactive)`
            })
          }
        }
        arcState.archive = arcState.archive.slice(0, 120)
        await saveArcState(arcState)
        const idsToRemove = tabsToArchive
          .map((t) => t.id)
          .filter((id): id is number => typeof id === "number")
        if (idsToRemove.length > 0) {
          await chrome.tabs.remove(idsToRemove)
        }
      }
    }
  } catch (err) {
    console.error("Error handling alarm:", err)
  }
})

async function pinTabToActiveSpace(
  tab?: chrome.tabs.Tab
): Promise<{ pinned: boolean; spaceName?: string }> {
  if (!tab || !tab.url || !tab.id) return { pinned: false }
  const arcState = await getArcState()
  const activeSpace =
    arcState.spaces.find((s) => s.id === arcState.activeSpaceId) ||
    arcState.spaces[0]
  if (!activeSpace) return { pinned: false }

  const existingIndex = activeSpace.pinnedTabs.findIndex(
    (p) => p.linkedTabId === tab.id || p.url === tab.url
  )

  if (existingIndex !== -1) {
    activeSpace.pinnedTabs.splice(existingIndex, 1)
    await saveArcState(arcState)
    await flashActionBadge("UNPIN", "#64748B")
    return { pinned: false, spaceName: activeSpace.name }
  }

  let fallbackTitle = tab.title || tab.url
  try {
    fallbackTitle = tab.title || new URL(tab.url).hostname
  } catch {
    // keep raw
  }

  activeSpace.pinnedTabs.push({
    id: `pin-${Date.now()}`,
    title: fallbackTitle,
    url: tab.url,
    favIconUrl: tab.favIconUrl || "",
    folderId: null,
    linkedTabId: tab.id
  })
  arcState.tabSpaceMap[tab.id] = activeSpace.id
  await saveArcState(arcState)
  await flashActionBadge("PIN", "#6E56CF")
  return { pinned: true, spaceName: activeSpace.name }
}

async function sendToastToTab(
  tabId: number | undefined,
  messageText: string,
  subtitle = ""
): Promise<void> {
  if (!tabId) return
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "ARC_SHOW_TOAST",
      message: messageText,
      subtitle
    })
  } catch {
    // Restricted page
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "arc-pin-page" && tab) {
      const res = await pinTabToActiveSpace(tab)
      await sendToastToTab(
        tab.id,
        res.pinned
          ? `Pinned to ${res.spaceName}`
          : `Unpinned from ${res.spaceName}`,
        tab.title || tab.url || ""
      )
    } else if (info.menuItemId === "arc-favorite-page" && tab?.url) {
      const arcState = await getArcState()
      const exists = arcState.favorites.some((f) => f.url === tab.url)
      if (!exists) {
        arcState.favorites.push({
          id: `fav-${Date.now()}`,
          title: tab.title || "Favorite",
          url: tab.url,
          favIconUrl: tab.favIconUrl || ""
        })
        await saveArcState(arcState)
      }
      await flashActionBadge("FAV", "#E11D48")
      await sendToastToTab(
        tab.id,
        "Added to Arc Favorites Bar",
        tab.title || tab.url
      )
    } else if (info.menuItemId === "arc-save-link-space" && info.linkUrl) {
      const arcState = await getArcState()
      const activeSpace =
        arcState.spaces.find((s) => s.id === arcState.activeSpaceId) ||
        arcState.spaces[0]
      if (activeSpace) {
        let linkTitle = info.selectionText || info.linkUrl
        try {
          linkTitle = info.selectionText || new URL(info.linkUrl).hostname
        } catch {
          // keep raw
        }
        activeSpace.pinnedTabs.push({
          id: `pin-${Date.now()}`,
          title: linkTitle,
          url: info.linkUrl,
          favIconUrl: "",
          folderId: null,
          linkedTabId: null
        })
        await saveArcState(arcState)
        await flashActionBadge("SAVED", "#10B981")
        await sendToastToTab(
          tab?.id,
          `Link Pinned to ${activeSpace.name}`,
          info.linkUrl
        )
      }
    } else if (info.menuItemId === "arc-copy-clean-url") {
      const rawUrl = info.linkUrl || tab?.url || ""
      const cleanUrl = cleanTrackingUrl(rawUrl)
      await flashActionBadge("COPY", "#10B981")
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "ARC_COPY_TEXT",
          text: cleanUrl,
          message: "Copied Clean URL",
          subtitle: cleanUrl
        })
      }
    }
  } catch (err) {
    console.error("Context menu handler error:", err)
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })
    if (!activeTab?.id) return

    if (command === "open-command-bar") {
      try {
        await chrome.runtime.sendMessage({ type: "ARC_OPEN_COMMAND_BAR" })
      } catch {
        // Side panel may not be open
      }
      try {
        await chrome.tabs.sendMessage(activeTab.id, {
          type: "ARC_TOGGLE_COMMAND_BAR"
        })
      } catch {
        await chrome.sidePanel.open({ windowId: activeTab.windowId })
      }
    } else if (command === "pin-current-tab") {
      const res = await pinTabToActiveSpace(activeTab)
      await sendToastToTab(
        activeTab.id,
        res.pinned
          ? `Pinned to ${res.spaceName}`
          : `Unpinned from ${res.spaceName}`,
        activeTab.title || activeTab.url || ""
      )
    } else if (command === "copy-current-url") {
      const cleanUrl = cleanTrackingUrl(activeTab.url || "")
      await flashActionBadge("COPY", "#10B981")
      try {
        await chrome.runtime.sendMessage({
          type: "ARC_SIDEBAR_COPY_URL",
          text: cleanUrl
        })
      } catch {
        // Ignore if sidepanel closed
      }
      try {
        await chrome.tabs.sendMessage(activeTab.id, {
          type: "ARC_COPY_TEXT",
          text: cleanUrl,
          message: "Copied Clean URL",
          subtitle: cleanUrl
        })
      } catch {
        // Restricted page
      }
    }
  } catch (err) {
    console.error("Command handler error:", err)
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  ;(async () => {
    try {
      switch (message?.type) {
        case "GET_ARC_SNAPSHOT": {
          const arcState = await getArcState()
          const currentWindow = await chrome.windows.getLastFocused({
            populate: true
          })
          const tabs =
            currentWindow?.tabs ||
            (await chrome.tabs.query({ currentWindow: true }))
          let groups: chrome.tabGroups.TabGroup[] = []
          try {
            groups = await chrome.tabGroups.query({
              windowId: currentWindow?.id
            })
          } catch {
            groups = []
          }
          sendResponse({ ok: true, arcState, tabs, groups })
          break
        }

        case "ACTIVATE_TAB": {
          const tab = await chrome.tabs.update(message.tabId, { active: true })
          if (tab?.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true })
          }
          sendResponse({ ok: true })
          break
        }

        case "CLOSE_TAB": {
          await chrome.tabs.remove(message.tabId)
          sendResponse({ ok: true })
          break
        }

        case "CREATE_TAB": {
          const arcState = await getArcState()
          const newTab = await chrome.tabs.create({
            url: message.url || "chrome://newtab",
            active: message.active !== false
          })
          if (newTab?.id) {
            arcState.tabSpaceMap[newTab.id] =
              message.spaceId || arcState.activeSpaceId
            arcState.tabLastActive[newTab.id] = Date.now()
            await saveArcState(arcState)
          }
          sendResponse({ ok: true, tab: newTab })
          break
        }

        case "PIN_ACTIVE_TAB": {
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          const result = await pinTabToActiveSpace(activeTab)
          sendResponse({ ok: true, ...result })
          break
        }

        case "SWITCH_SPACE": {
          const arcState = await getArcState()
          if (arcState.spaces.some((s) => s.id === message.spaceId)) {
            arcState.activeSpaceId = message.spaceId
            await saveArcState(arcState)
          }
          sendResponse({ ok: true, activeSpaceId: arcState.activeSpaceId })
          break
        }

        case "TOGGLE_MUTE_TAB": {
          const tab = await chrome.tabs.get(message.tabId)
          const nextMuted = !tab.mutedInfo?.muted
          await chrome.tabs.update(message.tabId, { muted: nextMuted })
          sendResponse({ ok: true, muted: nextMuted })
          break
        }

        case "DISCARD_TAB": {
          if (message.tabId) {
            await chrome.tabs.discard(message.tabId)
          }
          sendResponse({ ok: true })
          break
        }

        case "CLEAN_URL_REQUEST": {
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          const cleanUrl = cleanTrackingUrl(message.url || activeTab?.url || "")
          await flashActionBadge("COPY", "#10B981")
          sendResponse({ ok: true, cleanUrl })
          break
        }

        default:
          sendResponse({ ok: false, error: "Unknown message type" })
      }
    } catch (err) {
      console.error("Runtime message error:", err)
      sendResponse({ ok: false, error: String(err) })
    }
  })()
  return true
})
