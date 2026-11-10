// Arc Vertical Sidebar — Background Service Worker (Manifest V3)
// Strictly stateless across turns: all state lives in chrome.storage.local

const DEFAULT_ARC_STATE = {
  activeSpaceId: 'space-personal',
  viewAllSpacesTabs: false,
  autoArchiveHours: 12,
  leftPeekEnabled: true,
  favorites: [
    {
      id: 'fav-github',
      title: 'GitHub',
      url: 'https://github.com',
      favIconUrl: ''
    },
    {
      id: 'fav-google',
      title: 'Google Search',
      url: 'https://www.google.com',
      favIconUrl: ''
    },
    {
      id: 'fav-youtube',
      title: 'YouTube',
      url: 'https://www.youtube.com',
      favIconUrl: ''
    },
    {
      id: 'fav-hn',
      title: 'Hacker News',
      url: 'https://news.ycombinator.com',
      favIconUrl: ''
    }
  ],
  spaces: [
    {
      id: 'space-personal',
      name: 'Personal',
      icon: '🌿',
      theme: {
        hue: 256,
        accentHue: 318,
        saturation: 74,
        style: 'aurora'
      },
      domainRules: [],
      folders: [
        {
          id: 'folder-reading',
          name: 'Reading List',
          collapsed: false,
          color: 'purple'
        }
      ],
      pinnedTabs: [
        {
          id: 'pin-wiki',
          title: 'Wikipedia',
          url: 'https://www.wikipedia.org',
          favIconUrl: '',
          folderId: 'folder-reading',
          linkedTabId: null
        },
        {
          id: 'pin-mdn',
          title: 'MDN Web Docs',
          url: 'https://developer.mozilla.org',
          favIconUrl: '',
          folderId: null,
          linkedTabId: null
        }
      ]
    },
    {
      id: 'space-work',
      name: 'Work',
      icon: '⚡',
      theme: {
        hue: 214,
        accentHue: 182,
        saturation: 78,
        style: 'ocean'
      },
      domainRules: ['github.com', 'linear.app', 'figma.com', 'notion.so', 'slack.com'],
      folders: [
        {
          id: 'folder-dev',
          name: 'Engineering',
          collapsed: false,
          color: 'blue'
        }
      ],
      pinnedTabs: [
        {
          id: 'pin-chrome-ext',
          title: 'Chrome Extensions Docs',
          url: 'https://developer.chrome.com/docs/extensions',
          favIconUrl: '',
          folderId: 'folder-dev',
          linkedTabId: null
        }
      ]
    },
    {
      id: 'space-research',
      name: 'Research',
      icon: '🔭',
      theme: {
        hue: 24,
        accentHue: 342,
        saturation: 82,
        style: 'sunset'
      },
      domainRules: ['arxiv.org', 'scholar.google.com', 'news.ycombinator.com'],
      folders: [],
      pinnedTabs: []
    }
  ],
  tabSpaceMap: {},
  tabLastActive: {},
  splitPairs: [],
  archive: []
};

async function getArcState() {
  try {
    const data = await chrome.storage.local.get('arcState');
    if (!data.arcState) {
      await chrome.storage.local.set({ arcState: DEFAULT_ARC_STATE });
      return structuredClone(DEFAULT_ARC_STATE);
    }
    return {
      ...DEFAULT_ARC_STATE,
      ...data.arcState,
      spaces: Array.isArray(data.arcState.spaces) && data.arcState.spaces.length > 0
        ? data.arcState.spaces
        : DEFAULT_ARC_STATE.spaces,
      favorites: Array.isArray(data.arcState.favorites)
        ? data.arcState.favorites
        : DEFAULT_ARC_STATE.favorites,
      tabSpaceMap: data.arcState.tabSpaceMap || {},
      tabLastActive: data.arcState.tabLastActive || {},
      splitPairs: Array.isArray(data.arcState.splitPairs) ? data.arcState.splitPairs : [],
      archive: Array.isArray(data.arcState.archive) ? data.arcState.archive : []
    };
  } catch (err) {
    console.error('Error reading arcState:', err);
    return structuredClone(DEFAULT_ARC_STATE);
  }
}

async function saveArcState(arcState) {
  try {
    await chrome.storage.local.set({ arcState });
  } catch (err) {
    console.error('Error saving arcState:', err);
  }
}

async function flashActionBadge(text, color = '#6E56CF') {
  try {
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
    await chrome.alarms.create('arc-clear-badge', { delayInMinutes: 0.03 });
  } catch (err) {
    console.error('Failed to set badge:', err);
  }
}

function cleanUrlForCopy(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'igshid'
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function matchSpaceByDomain(url, spaces) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const space of spaces) {
      if (!Array.isArray(space.domainRules)) continue;
      for (const rule of space.domainRules) {
        const cleanRule = rule.trim().toLowerCase();
        if (cleanRule && (hostname === cleanRule || hostname.endsWith(`.${cleanRule}`))) {
          return space.id;
        }
      }
    }
  } catch {
    // Ignore non-standard URLs
  }
  return null;
}

async function setupContextMenus() {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: 'arc-pin-page',
      title: 'Pin Current Page to Arc Space',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'arc-favorite-page',
      title: 'Add Page to Arc Favorites Bar',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'arc-save-link-space',
      title: 'Pin Link to Active Arc Space',
      contexts: ['link']
    });
    chrome.contextMenus.create({
      id: 'arc-copy-clean-url',
      title: 'Copy Clean URL (Arc Style)',
      contexts: ['page', 'link']
    });
  } catch (err) {
    console.error('Context menu setup error:', err);
  }
}

async function ensureSidePanelBehavior() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (err) {
    console.error('Error setting panel behavior:', err);
  }
}

// Initialize on startup and installation
ensureSidePanelBehavior();

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSidePanelBehavior();
  await getArcState();
  await setupContextMenus();
  await chrome.alarms.create('arc-auto-archive', { periodInMinutes: 15 });
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureSidePanelBehavior();
  await chrome.alarms.create('arc-auto-archive', { periodInMinutes: 15 });
});

// Track new tabs and assign them to the active Space or opener's Space
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    const arcState = await getArcState();
    let targetSpaceId = arcState.activeSpaceId;

    if (tab.openerTabId && arcState.tabSpaceMap[tab.openerTabId]) {
      targetSpaceId = arcState.tabSpaceMap[tab.openerTabId];
    }
    const matchedByDomain = matchSpaceByDomain(tab.pendingUrl || tab.url, arcState.spaces);
    if (matchedByDomain) {
      targetSpaceId = matchedByDomain;
    }

    arcState.tabSpaceMap[tab.id] = targetSpaceId;
    arcState.tabLastActive[tab.id] = Date.now();
    await saveArcState(arcState);
  } catch (err) {
    console.error('Error handling tab creation:', err);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const arcState = await getArcState();
    arcState.tabLastActive[tabId] = Date.now();
    if (!arcState.tabSpaceMap[tabId]) {
      arcState.tabSpaceMap[tabId] = arcState.activeSpaceId;
    }
    await saveArcState(arcState);
  } catch (err) {
    console.error('Error tracking tab activation:', err);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  try {
    const arcState = await getArcState();
    let changed = false;

    if (!arcState.tabSpaceMap[tabId]) {
      arcState.tabSpaceMap[tabId] = arcState.activeSpaceId;
      changed = true;
    }

    if (changeInfo.url) {
      const matchedSpaceId = matchSpaceByDomain(changeInfo.url, arcState.spaces);
      if (matchedSpaceId && arcState.tabSpaceMap[tabId] !== matchedSpaceId) {
        arcState.tabSpaceMap[tabId] = matchedSpaceId;
        changed = true;
      }
    }

    // Update linked pinned tab metadata if needed
    for (const space of arcState.spaces) {
      for (const pin of space.pinnedTabs) {
        if (pin.linkedTabId === tabId && tab.favIconUrl && !pin.favIconUrl) {
          pin.favIconUrl = tab.favIconUrl;
          changed = true;
        }
      }
    }

    if (changed) {
      await saveArcState(arcState);
    }
  } catch (err) {
    console.error('Error on tab update:', err);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const arcState = await getArcState();
    delete arcState.tabSpaceMap[tabId];
    delete arcState.tabLastActive[tabId];

    for (const space of arcState.spaces) {
      for (const pin of space.pinnedTabs) {
        if (pin.linkedTabId === tabId) {
          pin.linkedTabId = null;
        }
      }
    }

    arcState.splitPairs = arcState.splitPairs.filter(
      (pair) => pair.leftTabId !== tabId && pair.rightTabId !== tabId
    );

    await saveArcState(arcState);
  } catch (err) {
    console.error('Error cleaning up removed tab:', err);
  }
});

// Handle alarms (Auto-Archive & Badge Reset)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === 'arc-clear-badge') {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }

    if (alarm.name === 'arc-auto-archive') {
      const arcState = await getArcState();
      const hours = Number(arcState.autoArchiveHours);
      if (!hours || hours <= 0) return;

      const thresholdMs = hours * 3600 * 1000;
      const now = Date.now();
      const allTabs = await chrome.tabs.query({});
      const linkedTabIds = new Set();

      for (const space of arcState.spaces) {
        for (const pin of space.pinnedTabs) {
          if (pin.linkedTabId) linkedTabIds.add(pin.linkedTabId);
        }
      }

      const tabsToArchive = [];
      for (const tab of allTabs) {
        if (tab.active || tab.pinned || tab.audible || linkedTabIds.has(tab.id)) continue;
        const lastActive = arcState.tabLastActive[tab.id] || now;
        if (now - lastActive > thresholdMs) {
          tabsToArchive.push(tab);
        }
      }

      if (tabsToArchive.length > 0) {
        for (const tab of tabsToArchive) {
          if (tab.url && !tab.url.startsWith('chrome://newtab')) {
            arcState.archive.unshift({
              id: `arch-${Date.now()}-${tab.id}`,
              title: tab.title || tab.url,
              url: tab.url,
              favIconUrl: tab.favIconUrl || '',
              spaceId: arcState.tabSpaceMap[tab.id] || arcState.activeSpaceId,
              archivedAt: now,
              reason: `Auto-archived (${hours}h inactive)`
            });
          }
        }
        arcState.archive = arcState.archive.slice(0, 120);
        await saveArcState(arcState);
        await chrome.tabs.remove(tabsToArchive.map((t) => t.id));
      }
    }
  } catch (err) {
    console.error('Error handling alarm:', err);
  }
});

async function pinTabToActiveSpace(tab) {
  if (!tab || !tab.url) return { pinned: false };
  const arcState = await getArcState();
  const activeSpace = arcState.spaces.find((s) => s.id === arcState.activeSpaceId) || arcState.spaces[0];
  if (!activeSpace) return { pinned: false };

  const existingIndex = activeSpace.pinnedTabs.findIndex(
    (p) => p.linkedTabId === tab.id || p.url === tab.url
  );

  if (existingIndex !== -1) {
    activeSpace.pinnedTabs.splice(existingIndex, 1);
    await saveArcState(arcState);
    await flashActionBadge('UNPIN', '#64748B');
    return { pinned: false, spaceName: activeSpace.name };
  }

  activeSpace.pinnedTabs.push({
    id: `pin-${Date.now()}`,
    title: tab.title || new URL(tab.url).hostname,
    url: tab.url,
    favIconUrl: tab.favIconUrl || '',
    folderId: null,
    linkedTabId: tab.id
  });
  arcState.tabSpaceMap[tab.id] = activeSpace.id;
  await saveArcState(arcState);
  await flashActionBadge('PIN', '#6E56CF');
  return { pinned: true, spaceName: activeSpace.name };
}

async function sendToastToTab(tabId, messageText, subtitle = '') {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'ARC_SHOW_TOAST',
      message: messageText,
      subtitle
    });
  } catch {
    // Content script not running on restricted chrome:// page; badge already provides feedback
  }
}

// Context menu click handler with explicit user confirmation
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'arc-pin-page' && tab) {
      const res = await pinTabToActiveSpace(tab);
      await sendToastToTab(
        tab.id,
        res.pinned ? `Pinned to ${res.spaceName}` : `Unpinned from ${res.spaceName}`,
        tab.title || tab.url
      );
    } else if (info.menuItemId === 'arc-favorite-page' && tab) {
      const arcState = await getArcState();
      const exists = arcState.favorites.some((f) => f.url === tab.url);
      if (!exists) {
        arcState.favorites.push({
          id: `fav-${Date.now()}`,
          title: tab.title || 'Favorite',
          url: tab.url,
          favIconUrl: tab.favIconUrl || ''
        });
        await saveArcState(arcState);
      }
      await flashActionBadge('FAV', '#E11D48');
      await sendToastToTab(tab.id, 'Added to Arc Favorites Bar', tab.title || tab.url);
    } else if (info.menuItemId === 'arc-save-link-space' && info.linkUrl) {
      const arcState = await getArcState();
      const activeSpace = arcState.spaces.find((s) => s.id === arcState.activeSpaceId) || arcState.spaces[0];
      if (activeSpace) {
        let linkTitle = info.selectionText || info.linkUrl;
        try {
          linkTitle = info.selectionText || new URL(info.linkUrl).hostname;
        } catch {
          // keep raw
        }
        activeSpace.pinnedTabs.push({
          id: `pin-${Date.now()}`,
          title: linkTitle,
          url: info.linkUrl,
          favIconUrl: '',
          folderId: null,
          linkedTabId: null
        });
        await saveArcState(arcState);
        await flashActionBadge('SAVED', '#10B981');
        if (tab?.id) {
          await sendToastToTab(tab.id, `Link Pinned to ${activeSpace.name}`, info.linkUrl);
        }
      }
    } else if (info.menuItemId === 'arc-copy-clean-url') {
      const rawUrl = info.linkUrl || tab?.url || '';
      const cleanUrl = cleanUrlForCopy(rawUrl);
      await flashActionBadge('COPY', '#10B981');
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'ARC_COPY_TEXT',
          text: cleanUrl,
          message: 'Copied Clean URL',
          subtitle: cleanUrl
        });
      }
    }
  } catch (err) {
    console.error('Context menu handler error:', err);
  }
});

// Keyboard shortcut commands handler
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return;

    if (command === 'open-command-bar') {
      // Broadcast to side panel if open, and to active tab overlay
      try {
        await chrome.runtime.sendMessage({ type: 'ARC_OPEN_COMMAND_BAR' });
      } catch {
        // Side panel may not be listening
      }
      try {
        await chrome.tabs.sendMessage(activeTab.id, { type: 'ARC_TOGGLE_COMMAND_BAR' });
      } catch {
        // If on a restricted page where content script cannot run, open side panel
        await chrome.sidePanel.open({ windowId: activeTab.windowId });
      }
    } else if (command === 'pin-current-tab') {
      const res = await pinTabToActiveSpace(activeTab);
      await sendToastToTab(
        activeTab.id,
        res.pinned ? `Pinned to ${res.spaceName}` : `Unpinned from ${res.spaceName}`,
        activeTab.title || activeTab.url
      );
    } else if (command === 'copy-current-url') {
      const cleanUrl = cleanUrlForCopy(activeTab.url || '');
      await flashActionBadge('COPY', '#10B981');
      try {
        await chrome.runtime.sendMessage({
          type: 'ARC_SIDEBAR_COPY_URL',
          text: cleanUrl
        });
      } catch {
        // Ignore if sidepanel closed
      }
      await sendToastToTab(activeTab.id, 'Copied Clean URL', cleanUrl);
      try {
        await chrome.tabs.sendMessage(activeTab.id, {
          type: 'ARC_COPY_TEXT',
          text: cleanUrl,
          message: 'Copied Clean URL',
          subtitle: cleanUrl
        });
      } catch {
        // Restricted page
      }
    }
  } catch (err) {
    console.error('Command handler error:', err);
  }
});

// Message passing hub for Side Panel and In-Page Command Bar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case 'GET_ARC_SNAPSHOT': {
          const arcState = await getArcState();
          const currentWindow = await chrome.windows.getLastFocused({ populate: true });
          const tabs = currentWindow?.tabs || (await chrome.tabs.query({ currentWindow: true }));
          let groups = [];
          try {
            groups = await chrome.tabGroups.query({ windowId: currentWindow?.id });
          } catch {
            groups = [];
          }
          sendResponse({ ok: true, arcState, tabs, groups });
          break;
        }

        case 'ACTIVATE_TAB': {
          const tab = await chrome.tabs.update(message.tabId, { active: true });
          if (tab?.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
          }
          sendResponse({ ok: true });
          break;
        }

        case 'CLOSE_TAB': {
          await chrome.tabs.remove(message.tabId);
          sendResponse({ ok: true });
          break;
        }

        case 'CREATE_TAB': {
          const arcState = await getArcState();
          const newTab = await chrome.tabs.create({
            url: message.url || 'chrome://newtab',
            active: message.active !== false
          });
          if (newTab?.id) {
            arcState.tabSpaceMap[newTab.id] = message.spaceId || arcState.activeSpaceId;
            arcState.tabLastActive[newTab.id] = Date.now();
            await saveArcState(arcState);
          }
          sendResponse({ ok: true, tab: newTab });
          break;
        }

        case 'PIN_ACTIVE_TAB': {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const result = await pinTabToActiveSpace(activeTab);
          sendResponse({ ok: true, ...result });
          break;
        }

        case 'SWITCH_SPACE': {
          const arcState = await getArcState();
          if (arcState.spaces.some((s) => s.id === message.spaceId)) {
            arcState.activeSpaceId = message.spaceId;
            await saveArcState(arcState);
          }
          sendResponse({ ok: true, activeSpaceId: arcState.activeSpaceId });
          break;
        }

        case 'TOGGLE_MUTE_TAB': {
          const tab = await chrome.tabs.get(message.tabId);
          const nextMuted = !tab.mutedInfo?.muted;
          await chrome.tabs.update(message.tabId, { muted: nextMuted });
          sendResponse({ ok: true, muted: nextMuted });
          break;
        }

        case 'DISCARD_TAB': {
          if (message.tabId) {
            await chrome.tabs.discard(message.tabId);
          }
          sendResponse({ ok: true });
          break;
        }

        case 'CLEAN_URL_REQUEST': {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const cleanUrl = cleanUrlForCopy(message.url || activeTab?.url || '');
          await flashActionBadge('COPY', '#10B981');
          sendResponse({ ok: true, cleanUrl });
          break;
        }

        default:
          sendResponse({ ok: false, error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('Runtime message error:', err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true;
});
