import { getArcState, saveArcState } from "~lib/storage"
import {
  chromeGroupColorToHue,
  cleanTrackingUrl,
  doesGroupMatchSpace,
  formatSpaceGroupTitle,
  hueToChromeGroupColor,
  matchSpaceByDomain,
  urlsRoughlyMatch
} from "~lib/url-utils"

export {}

let isSyncingTabGroups = false

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
    chrome.contextMenus.create({
      id: "arc-toggle-tabless",
      title: "Toggle Tabless Arc Window (Hide Native Chrome Bar)",
      contexts: ["page"]
    })
    chrome.contextMenus.create({
      id: "arc-toggle-chromeless",
      title: "Toggle Arc Fullscreen Mode",
      contexts: ["page"]
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

/**
 * Clean up any duplicate background tabs with identical URLs (e.g. from earlier sync loops).
 */
async function cleanupDuplicateTabs(): Promise<void> {
  try {
    const win = await chrome.windows.getLastFocused({ populate: true })
    if (!win?.tabs) return
    const seenUrls = new Set<string>()
    const dupIds: number[] = []

    // First record active and audible tabs so they are never closed
    for (const t of win.tabs) {
      if ((t.active || t.audible || t.pinned) && t.url) {
        seenUrls.add(cleanTrackingUrl(t.url))
      }
    }

    for (const t of win.tabs) {
      if (!t.id || t.active || t.audible || t.pinned) continue
      const norm = cleanTrackingUrl(t.url || t.pendingUrl || "")
      if (!norm || norm.startsWith("chrome://newtab")) {
        if (seenUrls.has("chrome://newtab")) {
          dupIds.push(t.id)
        } else {
          seenUrls.add("chrome://newtab")
        }
        continue
      }
      if (seenUrls.has(norm)) {
        dupIds.push(t.id)
      } else {
        seenUrls.add(norm)
      }
    }

    if (dupIds.length > 0) {
      await chrome.tabs.remove(dupIds)
    }
  } catch {
    // Ignore if tabs already closed
  }
}

/**
 * Bidirectional Native Chrome Tab Group Engine:
 * - Represents every Arc Space (`🌿 Personal`, `⚡ Work`, `🔭 Research`, + user-created Spaces)
 *   as a real native Chrome Tab Group (`chrome.tabGroups`) with matching title, emoji, and color.
 * - Strictly groups existing open tabs without ever auto-spawning background tabs.
 * - When `collapseNativeTabs` is enabled (default), automatically collapses inactive Spaces'
 *   Tab Groups into compact colored pills in Chrome's horizontal tab bar.
 */
async function syncSpacesWithNativeTabGroups(options?: {
  windowId?: number
}): Promise<void> {
  if (isSyncingTabGroups) return
  isSyncingTabGroups = true
  try {
    const arcState = await getArcState()
    let targetWindow = options?.windowId
      ? await chrome.windows.get(options.windowId, { populate: true })
      : await chrome.windows.getLastFocused({ populate: true })

    if (!targetWindow || targetWindow.type !== "normal") {
      const normalWins = await chrome.windows.getAll({
        populate: true,
        windowTypes: ["normal"]
      })
      targetWindow = normalWins[0]
    }
    if (!targetWindow?.id || !targetWindow.tabs) {
      return
    }

    const windowTabs = [...targetWindow.tabs]
    const groups = await chrome.tabGroups.query({ windowId: targetWindow.id })
    let stateChanged = false

    // 1. Adopt any custom named Chrome Tab Groups created natively by the user in Chrome's top bar
    for (const grp of groups) {
      const rawTitle = (grp.title || "").trim()
      if (!rawTitle || rawTitle === "Arc") continue
      const alreadyMatched = arcState.spaces.some((sp) =>
        doesGroupMatchSpace(grp, sp)
      )
      if (!alreadyMatched) {
        const emojiMatch = rawTitle.match(
          /^(\p{Extended_Pictographic})\s*(.+)$/u
        )
        const icon = emojiMatch ? emojiMatch[1] : "🗂️"
        const name = emojiMatch ? emojiMatch[2].trim() : rawTitle
        const hues = chromeGroupColorToHue(grp.color)
        const newSpaceId = `space-native-${grp.id}-${Date.now()}`
        arcState.spaces.push({
          id: newSpaceId,
          name,
          icon,
          theme: {
            hue: hues.hue,
            accentHue: hues.accentHue,
            saturation: 74,
            style: "custom"
          },
          domainRules: [],
          folders: [],
          pinnedTabs: [],
          chromeGroupId: grp.id
        })
        for (const t of windowTabs) {
          if (t.id && t.groupId === grp.id) {
            arcState.tabSpaceMap[t.id] = newSpaceId
          }
        }
        stateChanged = true
      }
    }

    const activeTab = windowTabs.find((t) => t.active)

    // 2. Group open tabs into their respective Space's Native Chrome Tab Group
    for (const space of arcState.spaces) {
      const matchedGroup = groups.find((g) => doesGroupMatchSpace(g, space))

      // Reconcile pinnedTabs with currently open tabs
      for (const pin of space.pinnedTabs) {
        if (
          pin.linkedTabId &&
          !windowTabs.some((t) => t.id === pin.linkedTabId)
        ) {
          pin.linkedTabId = null
          stateChanged = true
        }
        if (!pin.linkedTabId) {
          const matchingOpenTab = windowTabs.find((t) =>
            urlsRoughlyMatch(t.url || t.pendingUrl, pin.url)
          )
          if (matchingOpenTab?.id) {
            pin.linkedTabId = matchingOpenTab.id
            arcState.tabSpaceMap[matchingOpenTab.id] = space.id
            stateChanged = true
          }
        }
      }

      // Collect all open unpinned tabs belonging to this Space
      const spaceTabIds: number[] = []
      for (const t of windowTabs) {
        if (typeof t.id !== "number" || t.pinned) continue
        const assignedSpaceId = arcState.tabSpaceMap[t.id]
        const isLinkedPin = space.pinnedTabs.some((p) => p.linkedTabId === t.id)
        const isInMatchedGroup =
          !assignedSpaceId && matchedGroup && t.groupId === matchedGroup.id
        const isUnassignedInActiveSpace =
          !assignedSpaceId &&
          space.id === arcState.activeSpaceId &&
          (t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ||
            groups.find((g) => g.id === t.groupId)?.title === "Arc")

        if (
          assignedSpaceId === space.id ||
          isLinkedPin ||
          isInMatchedGroup ||
          isUnassignedInActiveSpace
        ) {
          spaceTabIds.push(t.id)
          if (arcState.tabSpaceMap[t.id] !== space.id) {
            arcState.tabSpaceMap[t.id] = space.id
            stateChanged = true
          }
        }
      }

      if (spaceTabIds.length > 0) {
        try {
          const groupId = await chrome.tabs.group({
            tabIds: spaceTabIds,
            ...(matchedGroup && matchedGroup.windowId === targetWindow.id
              ? { groupId: matchedGroup.id }
              : { createProperties: { windowId: targetWindow.id } })
          })
          if (space.chromeGroupId !== groupId) {
            space.chromeGroupId = groupId
            stateChanged = true
          }

          const containsActiveTab = Boolean(
            activeTab?.id && spaceTabIds.includes(activeTab.id)
          )
          const shouldCollapse = Boolean(
            arcState.collapseNativeTabs &&
              !containsActiveTab &&
              space.id !== arcState.activeSpaceId
          )

          await chrome.tabGroups.update(groupId, {
            title: formatSpaceGroupTitle(space),
            color: hueToChromeGroupColor(space.theme?.hue),
            collapsed: shouldCollapse
          })
        } catch {
          // Tab strip may be mid-drag
        }
      }
    }

    if (stateChanged) {
      await saveArcState(arcState)
    }
  } catch (err) {
    console.error("Error syncing Spaces with native Chrome Tab Groups:", err)
  } finally {
    isSyncingTabGroups = false
  }
}

async function toggleChromelessMode(forceState?: boolean): Promise<{
  chromeless: boolean
  dockedSidebarMode: boolean
}> {
  const arcState = await getArcState()
  const win = await chrome.windows.getLastFocused()
  const isCurrentlyFullscreen = win?.state === "fullscreen"
  const nextChromeless =
    typeof forceState === "boolean" ? forceState : !isCurrentlyFullscreen

  if (win?.id) {
    await chrome.windows.update(win.id, {
      state: nextChromeless ? "fullscreen" : "normal"
    })
  }

  arcState.dockedSidebarMode = nextChromeless
  await saveArcState(arcState)
  return {
    chromeless: nextChromeless,
    dockedSidebarMode: arcState.dockedSidebarMode
  }
}

/**
 * Converts the active tab into a windowed `type: "popup"` Chrome App Window
 * (which has NO horizontal tab bar and NO Chrome address bar even when not fullscreen!)
 * or restores a popup window back into a normal window.
 */
async function toggleTablessWindow(): Promise<{ tablessWindow: boolean }> {
  const currentWin = await chrome.windows.getLastFocused({ populate: true })
  const activeTab = currentWin?.tabs?.find((t) => t.active)
  if (!currentWin || !activeTab?.id) {
    return { tablessWindow: false }
  }

  if (currentWin.type === "popup") {
    const allWins = await chrome.windows.getAll({ windowTypes: ["normal"] })
    const targetNormal = allWins[0]
    if (targetNormal?.id) {
      await chrome.tabs.move(activeTab.id, {
        windowId: targetNormal.id,
        index: -1
      })
      await chrome.tabs.update(activeTab.id, { active: true })
      await chrome.windows.update(targetNormal.id, { focused: true })
    } else {
      await chrome.windows.create({
        tabId: activeTab.id,
        type: "normal",
        focused: true
      })
    }
    return { tablessWindow: false }
  }

  // Convert active tab into a chromeless `popup` window with same bounds
  await chrome.windows.create({
    tabId: activeTab.id,
    type: "popup",
    left: currentWin.left,
    top: currentWin.top,
    width: currentWin.width || 1280,
    height: currentWin.height || 860,
    focused: true
  })
  return { tablessWindow: true }
}

// Run immediately on service worker boot
;(async () => {
  await ensureSidePanelBehavior()
  await getArcState()
  await cleanupDuplicateTabs()
  await syncSpacesWithNativeTabGroups()
})()

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSidePanelBehavior()
  await getArcState()
  await setupContextMenus()
  await cleanupDuplicateTabs()
  await syncSpacesWithNativeTabGroups()
  await chrome.alarms.create("arc-auto-archive", { periodInMinutes: 15 })
})

chrome.runtime.onStartup.addListener(async () => {
  await ensureSidePanelBehavior()
  await syncSpacesWithNativeTabGroups()
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
    await syncSpacesWithNativeTabGroups({ windowId: tab.windowId })
  } catch (err) {
    console.error("Error handling tab creation:", err)
  }
})

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  try {
    const arcState = await getArcState()
    arcState.tabLastActive[tabId] = Date.now()
    if (!arcState.tabSpaceMap[tabId]) {
      arcState.tabSpaceMap[tabId] = arcState.activeSpaceId
    } else if (arcState.tabSpaceMap[tabId] !== arcState.activeSpaceId) {
      // When the user clicks a tab belonging to another Space in Chrome's native tab bar,
      // automatically switch the active Space in the sidebar to match!
      arcState.activeSpaceId = arcState.tabSpaceMap[tabId]
    }
    await saveArcState(arcState)
    await syncSpacesWithNativeTabGroups({ windowId })
  } catch (err) {
    console.error("Error tracking tab activation:", err)
  }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    !changeInfo.url &&
    changeInfo.status !== "complete" &&
    changeInfo.groupId === undefined
  ) {
    return
  }
  try {
    const arcState = await getArcState()
    let changed = false
    let needsGroupSync = false

    // If user manually dragged a tab into a different native Chrome Tab Group
    if (
      !isSyncingTabGroups &&
      changeInfo.groupId !== undefined &&
      changeInfo.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
    ) {
      const matchedSpace = arcState.spaces.find(
        (s) => s.chromeGroupId === changeInfo.groupId
      )
      if (matchedSpace && arcState.tabSpaceMap[tabId] !== matchedSpace.id) {
        arcState.tabSpaceMap[tabId] = matchedSpace.id
        changed = true
      }
    }

    if (!arcState.tabSpaceMap[tabId]) {
      arcState.tabSpaceMap[tabId] = arcState.activeSpaceId
      changed = true
      needsGroupSync = true
    }

    if (changeInfo.url) {
      const matchedSpaceId = matchSpaceByDomain(changeInfo.url, arcState.spaces)
      if (matchedSpaceId && arcState.tabSpaceMap[tabId] !== matchedSpaceId) {
        arcState.tabSpaceMap[tabId] = matchedSpaceId
        changed = true
        needsGroupSync = true
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
    if (needsGroupSync) {
      await syncSpacesWithNativeTabGroups({ windowId: tab.windowId })
    }
  } catch (err) {
    console.error("Error on tab update:", err)
  }
})

// Bidirectional sync: if the user renames or recolors a Tab Group directly in Chrome's native tab bar,
// update the corresponding Arc Space automatically!
chrome.tabGroups.onUpdated.addListener(async (group) => {
  if (isSyncingTabGroups) return
  try {
    const arcState = await getArcState()
    const space = arcState.spaces.find(
      (s) => s.chromeGroupId === group.id || doesGroupMatchSpace(group, s)
    )
    if (!space) return

    let changed = false
    if (space.chromeGroupId !== group.id) {
      space.chromeGroupId = group.id
      changed = true
    }

    const rawTitle = (group.title || "").trim()
    if (rawTitle && rawTitle !== formatSpaceGroupTitle(space)) {
      const emojiMatch = rawTitle.match(/^(\p{Extended_Pictographic})\s*(.+)$/u)
      if (emojiMatch) {
        space.icon = emojiMatch[1]
        space.name = emojiMatch[2].trim()
      } else {
        space.name = rawTitle
      }
      changed = true
    }

    const expectedColor = hueToChromeGroupColor(space.theme?.hue)
    if (group.color && group.color !== expectedColor) {
      const hues = chromeGroupColorToHue(group.color)
      space.theme = {
        ...space.theme,
        hue: hues.hue,
        accentHue: hues.accentHue
      }
      changed = true
    }

    if (changed) {
      await saveArcState(arcState)
    }
  } catch (err) {
    console.error("Error syncing native tabGroup update to Space:", err)
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

function resolveInputToUrl(rawInput: string): string {
  const q = rawInput.trim()
  if (!q) return "chrome://newtab"
  if (/^(https?:\/\/|chrome:\/\/|file:\/\/|about:)/i.test(q)) {
    return q
  }
  const looksLikeDomain = /^(localhost(:\d+)?|[\w-]+\.[a-z]{2,})(\/.*)?$/i.test(
    q
  )
  if (looksLikeDomain && !q.includes(" ")) {
    return `https://${q}`
  }
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
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
    } else if (info.menuItemId === "arc-toggle-tabless") {
      await toggleTablessWindow()
    } else if (info.menuItemId === "arc-toggle-chromeless") {
      await toggleChromelessMode()
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    try {
      switch (message?.type) {
        case "GET_ARC_SNAPSHOT": {
          const arcState = await getArcState()
          const currentWindow = await chrome.windows.getLastFocused({
            populate: true
          })
          // If inside a single-tab Tabless Window (popup), include all open tabs across windows
          const tabs =
            currentWindow?.type === "popup"
              ? await chrome.tabs.query({})
              : currentWindow?.tabs ||
                (await chrome.tabs.query({ currentWindow: true }))
          let groups: chrome.tabGroups.TabGroup[] = []
          try {
            groups = await chrome.tabGroups.query({
              windowId: currentWindow?.id
            })
          } catch {
            groups = []
          }
          sendResponse({
            ok: true,
            arcState,
            tabs,
            groups,
            windowState: currentWindow?.state || "normal",
            windowType: currentWindow?.type || "normal"
          })
          break
        }

        case "ACTIVATE_TAB": {
          // If user clicked a tab from inside a Tabless Window (`type: "popup"`),
          // swap the URL with the clicked background tab so they stay in the Tabless Window!
          if (sender.tab?.windowId && sender.tab.id) {
            const senderWin = await chrome.windows.get(sender.tab.windowId)
            if (senderWin.type === "popup" && sender.tab.id !== message.tabId) {
              const clickedTab = await chrome.tabs.get(message.tabId)
              if (clickedTab?.url) {
                const prevUrl = sender.tab.url
                const targetUrl = clickedTab.url
                if (prevUrl && !prevUrl.startsWith("chrome://newtab")) {
                  await chrome.tabs.update(clickedTab.id!, { url: prevUrl })
                }
                await chrome.tabs.update(sender.tab.id, { url: targetUrl })
                sendResponse({ ok: true })
                break
              }
            }
          }

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
          const targetUrl = message.rawQuery
            ? resolveInputToUrl(message.rawQuery)
            : message.url || "chrome://newtab"

          // If inside a Tabless popup window, preserve current page in background and navigate popup
          if (sender.tab?.windowId && sender.tab.id) {
            const senderWin = await chrome.windows.get(sender.tab.windowId)
            if (senderWin.type === "popup") {
              const allNormalWins = await chrome.windows.getAll({
                windowTypes: ["normal"]
              })
              if (
                allNormalWins[0]?.id &&
                sender.tab.url &&
                !sender.tab.url.startsWith("chrome://newtab")
              ) {
                const bgTab = await chrome.tabs.create({
                  windowId: allNormalWins[0].id,
                  url: sender.tab.url,
                  active: false
                })
                if (bgTab.id) {
                  arcState.tabSpaceMap[bgTab.id] =
                    message.spaceId || arcState.activeSpaceId
                }
              }
              const updated = await chrome.tabs.update(sender.tab.id, {
                url: targetUrl
              })
              await saveArcState(arcState)
              sendResponse({ ok: true, tab: updated })
              break
            }
          }

          const newTab = await chrome.tabs.create({
            url: targetUrl,
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

        case "NAVIGATE_ACTIVE_TAB": {
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          const targetUrl = resolveInputToUrl(
            message.input || message.url || ""
          )
          if (activeTab?.id && !message.newTab) {
            await chrome.tabs.update(activeTab.id, { url: targetUrl })
          } else {
            await chrome.tabs.create({ url: targetUrl, active: true })
          }
          sendResponse({ ok: true, url: targetUrl })
          break
        }

        case "BROWSER_NAV_ACTION": {
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (activeTab?.id) {
            if (message.action === "back") {
              try {
                await chrome.tabs.goBack(activeTab.id)
              } catch {
                // Already at start of history
              }
            } else if (message.action === "forward") {
              try {
                await chrome.tabs.goForward(activeTab.id)
              } catch {
                // Already at end of history
              }
            } else if (message.action === "reload") {
              await chrome.tabs.reload(activeTab.id)
            }
          }
          sendResponse({ ok: true })
          break
        }

        case "TOGGLE_CHROMELESS_MODE": {
          const res = await toggleChromelessMode(message.forceState)
          sendResponse({ ok: true, ...res })
          break
        }

        case "TOGGLE_TABLESS_WINDOW": {
          const res = await toggleTablessWindow()
          sendResponse({ ok: true, ...res })
          break
        }

        case "SET_COLLAPSE_NATIVE_TABS": {
          const arcState = await getArcState()
          arcState.collapseNativeTabs = Boolean(message.enabled)
          await saveArcState(arcState)
          await syncSpacesWithNativeTabGroups()
          sendResponse({
            ok: true,
            collapseNativeTabs: arcState.collapseNativeTabs
          })
          break
        }

        case "SYNC_SPACE_TAB_GROUPS": {
          await syncSpacesWithNativeTabGroups()
          sendResponse({ ok: true })
          break
        }

        case "DELETE_SPACE_TAB_GROUP": {
          if (typeof message.groupId === "number") {
            try {
              const groupTabs = await chrome.tabs.query({
                groupId: message.groupId
              })
              const ids = groupTabs
                .map((t) => t.id)
                .filter((id): id is number => typeof id === "number")
              if (ids.length > 0) {
                await chrome.tabs.ungroup(ids)
              }
            } catch {
              // Group may already be gone
            }
          }
          await syncSpacesWithNativeTabGroups()
          sendResponse({ ok: true })
          break
        }

        case "PIN_ACTIVE_TAB": {
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          const result = await pinTabToActiveSpace(activeTab)
          await syncSpacesWithNativeTabGroups()
          sendResponse({ ok: true, ...result })
          break
        }

        case "SWITCH_SPACE": {
          const arcState = await getArcState()
          const targetSpace = arcState.spaces.find(
            (s) => s.id === message.spaceId
          )
          if (targetSpace) {
            arcState.activeSpaceId = targetSpace.id
            await saveArcState(arcState)
            await syncSpacesWithNativeTabGroups()

            if (message.activateSpaceTab !== false) {
              const currentWindow = await chrome.windows.getLastFocused({
                populate: true
              })
              const candidateTabs = (currentWindow?.tabs || []).filter(
                (t) =>
                  t.id &&
                  (arcState.tabSpaceMap[t.id] === targetSpace.id ||
                    (targetSpace.chromeGroupId &&
                      t.groupId === targetSpace.chromeGroupId))
              )
              if (candidateTabs.length > 0) {
                candidateTabs.sort(
                  (a, b) =>
                    (arcState.tabLastActive[b.id!] || 0) -
                    (arcState.tabLastActive[a.id!] || 0)
                )
                const bestTab = candidateTabs[0]
                if (bestTab?.id && !bestTab.active) {
                  await chrome.tabs.update(bestTab.id, { active: true })
                }
              }
            }
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
