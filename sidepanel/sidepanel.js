// Arc Vertical Sidebar — Side Panel Controller (Manifest V3)
// Uses async/await exclusively and syncs with chrome.storage.local

const DEFAULT_FALLBACK_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%238b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
  );

const uiState = {
  arcState: null,
  tabs: [],
  groups: [],
  activeTab: null,
  filterQuery: '',
  tidyGroupedMode: false,
  editingSpaceIsNew: false,
  editingFolderId: null,
  commandItems: [],
  commandSelectedIndex: 0,
  dragPayload: null,
  toastTimerId: null
};

// DOM Elements
const els = {
  btnBack: document.getElementById('btn-back'),
  btnForward: document.getElementById('btn-forward'),
  btnReload: document.getElementById('btn-reload'),
  btnCopyUrl: document.getElementById('btn-copy-url'),
  btnPinCurrent: document.getElementById('btn-pin-current'),
  btnUrlPill: document.getElementById('btn-url-pill'),
  activeDomainLabel: document.getElementById('active-domain-label'),
  filterInput: document.getElementById('sidebar-filter-input'),
  btnClearFilter: document.getElementById('btn-clear-filter'),
  favoritesGrid: document.getElementById('favorites-grid'),
  activeSpaceIcon: document.getElementById('active-space-icon'),
  activeSpaceHeading: document.getElementById('active-space-heading'),
  btnSpaceMenu: document.getElementById('btn-space-Menu'),
  btnNewFolder: document.getElementById('btn-new-folder'),
  btnSyncGroups: document.getElementById('btn-sync-groups'),
  btnEditSpace: document.getElementById('btn-edit-space'),
  pinnedFoldersContainer: document.getElementById('pinned-folders-container'),
  pinnedTabsList: document.getElementById('pinned-tabs-list'),
  pinnedEmptyHint: document.getElementById('pinned-empty-hint'),
  todayCountBadge: document.getElementById('today-count-badge'),
  btnToggleScope: document.getElementById('btn-toggle-scope'),
  btnTidyTabs: document.getElementById('btn-tidy-tabs'),
  btnClearToday: document.getElementById('btn-clear-today'),
  btnNewTab: document.getElementById('btn-new-tab'),
  tidyGroupsContainer: document.getElementById('tidy-groups-container'),
  todayTabsList: document.getElementById('today-tabs-list'),
  nowPlayingBar: document.getElementById('now-playing-bar'),
  mediaJumpTab: document.getElementById('media-jump-tab'),
  mediaFavicon: document.getElementById('media-favicon'),
  mediaTitle: document.getElementById('media-title'),
  btnMediaMute: document.getElementById('btn-media-mute'),
  sidebarToast: document.getElementById('sidebar-toast'),
  sidebarToastText: document.getElementById('sidebar-toast-text'),
  btnOpenArchive: document.getElementById('btn-open-archive'),
  spacesDock: document.getElementById('spaces-dock'),
  btnCreateSpace: document.getElementById('btn-create-space'),
  selectAutoArchive: document.getElementById('select-auto-archive'),
  toggleAllTabs: document.getElementById('toggle-all-tabs'),
  toggleLeftPeek: document.getElementById('toggle-left-peek'),
  btnSuspendInactive: document.getElementById('btn-suspend-inactive'),
  btnCloseDuplicates: document.getElementById('btn-close-duplicates'),
  btnImportBookmarks: document.getElementById('btn-import-bookmarks'),
  contextMenuPopover: document.getElementById('context-menu-popover'),
  contextMenuItems: document.getElementById('context-menu-items'),
  commandDialog: document.getElementById('command-dialog'),
  commandInput: document.getElementById('command-input'),
  btnCloseCommand: document.getElementById('btn-close-command'),
  commandResults: document.getElementById('command-results'),
  spaceDialog: document.getElementById('space-dialog'),
  spaceForm: document.getElementById('space-form'),
  spaceDialogTitle: document.getElementById('space-dialog-title'),
  spaceIconInput: document.getElementById('space-icon-input'),
  spaceNameInput: document.getElementById('space-name-input'),
  spaceHueSlider: document.getElementById('space-hue-slider'),
  spaceHueOutput: document.getElementById('space-hue-output'),
  spaceAccentSlider: document.getElementById('space-accent-slider'),
  spaceAccentOutput: document.getElementById('space-accent-output'),
  spaceDomainsInput: document.getElementById('space-domains-input'),
  themePresetsRow: document.getElementById('theme-presets-row'),
  btnDeleteSpace: document.getElementById('btn-delete-space'),
  archiveDialog: document.getElementById('archive-dialog'),
  archiveFilterInput: document.getElementById('archive-filter-input'),
  archiveList: document.getElementById('archive-list'),
  btnClearArchive: document.getElementById('btn-clear-archive'),
  btnCloseArchive: document.getElementById('btn-close-archive'),
  folderDialog: document.getElementById('folder-dialog'),
  folderForm: document.getElementById('folder-form'),
  folderDialogTitle: document.getElementById('folder-dialog-title'),
  folderNameInput: document.getElementById('folder-name-input')
};

function getFaviconUrl(pageUrl, rawFavIconUrl = '') {
  if (rawFavIconUrl && (rawFavIconUrl.startsWith('http') || rawFavIconUrl.startsWith('data:'))) {
    return rawFavIconUrl;
  }
  if (pageUrl && (pageUrl.startsWith('http://') || pageUrl.startsWith('https://'))) {
    const base = chrome.runtime.getURL('/_favicon/');
    return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
  }
  return DEFAULT_FALLBACK_ICON;
}

function formatCleanDomain(url) {
  if (!url) return 'New Tab';
  if (url.startsWith('chrome://newtab')) return 'New Tab';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') || parsed.protocol.replace(':', '');
  } catch {
    return url;
  }
}

function cleanTrackingUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    const tracking = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'igshid'
    ];
    for (const key of tracking) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function showToast(text) {
  if (!els.sidebarToast || !els.sidebarToastText) return;
  els.sidebarToastText.textContent = text;
  els.sidebarToast.hidden = false;
  if (uiState.toastTimerId) {
    clearTimeout(uiState.toastTimerId);
  }
  uiState.toastTimerId = setTimeout(() => {
    els.sidebarToast.hidden = true;
  }, 2000);
}

function getActiveSpace() {
  if (!uiState.arcState?.spaces?.length) return null;
  return (
    uiState.arcState.spaces.find((s) => s.id === uiState.arcState.activeSpaceId) ||
    uiState.arcState.spaces[0]
  );
}

function applySpaceThemeVariables(theme) {
  const root = document.documentElement;
  const hue = theme?.hue ?? 256;
  const accentHue = theme?.accentHue ?? 318;
  const sat = theme?.saturation ?? 74;
  root.style.setProperty('--space-hue', String(hue));
  root.style.setProperty('--space-accent-hue', String(accentHue));
  root.style.setProperty('--space-sat', `${sat}%`);
}

async function persistArcState() {
  if (!uiState.arcState) return;
  try {
    await chrome.storage.local.set({ arcState: uiState.arcState });
  } catch (err) {
    console.error('Failed to persist arcState:', err);
  }
}

async function refreshSnapshot() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ARC_SNAPSHOT' });
    if (response?.ok) {
      uiState.arcState = response.arcState;
      uiState.tabs = response.tabs || [];
      uiState.groups = response.groups || [];
    } else {
      const stored = await chrome.storage.local.get('arcState');
      uiState.arcState = stored.arcState;
      uiState.tabs = await chrome.tabs.query({ currentWindow: true });
    }
    uiState.activeTab = uiState.tabs.find((t) => t.active) || null;
    reconcileLinkedTabs();
    renderAll();
  } catch (err) {
    console.error('Error refreshing snapshot:', err);
  }
}

function urlsRoughlyMatch(urlA, urlB) {
  if (!urlA || !urlB) return false;
  if (urlA === urlB) return true;
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
}

function reconcileLinkedTabs() {
  if (!uiState.arcState) return;
  const openTabMap = new Map(uiState.tabs.map((t) => [t.id, t]));

  for (const space of uiState.arcState.spaces) {
    for (const pin of space.pinnedTabs) {
      if (pin.linkedTabId && !openTabMap.has(pin.linkedTabId)) {
        pin.linkedTabId = null;
      }
      if (!pin.linkedTabId) {
        const match = uiState.tabs.find((t) => urlsRoughlyMatch(t.url, pin.url));
        if (match) {
          pin.linkedTabId = match.id;
        }
      }
    }
  }
}

function renderAll() {
  if (!uiState.arcState) return;
  const activeSpace = getActiveSpace();
  if (!activeSpace) return;

  applySpaceThemeVariables(activeSpace.theme);

  renderTopBar(activeSpace);
  renderFavorites();
  renderSpaceHeader(activeSpace);
  renderPinnedSection(activeSpace);
  renderTodaySection(activeSpace);
  renderMediaController();
  renderSpacesDock(activeSpace);
  syncSettingsControls();
}

function renderTopBar(activeSpace) {
  const tab = uiState.activeTab;
  els.activeDomainLabel.textContent = tab ? formatCleanDomain(tab.url) : 'New Tab';
  els.btnUrlPill.title = tab?.url || 'Open Arc Command Bar (⌘K)';

  const isPinned = Boolean(
    tab &&
    activeSpace.pinnedTabs.some((p) => p.linkedTabId === tab.id || urlsRoughlyMatch(p.url, tab.url))
  );
  els.btnPinCurrent.classList.toggle('is-pinned-active', isPinned);
}

function renderFavorites() {
  els.favoritesGrid.replaceChildren();
  const favorites = uiState.arcState.favorites || [];

  for (const fav of favorites) {
    const matchingTab = uiState.tabs.find((t) => urlsRoughlyMatch(t.url, fav.url) || (fav.url && t.url?.startsWith(fav.url)));
    const isActive = Boolean(matchingTab && matchingTab.active);
    const isOpen = Boolean(matchingTab);
    const isAudible = Boolean(matchingTab && matchingTab.audible);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'favorite-tile';
    if (isActive) btn.classList.add('is-active');
    if (isOpen) btn.classList.add('is-open');
    btn.title = `${fav.title}\n${fav.url}`;
    btn.setAttribute('aria-label', fav.title || 'Favorite site');
    btn.draggable = true;

    const img = document.createElement('img');
    img.className = 'fav-icon-img';
    img.width = 18;
    img.height = 18;
    img.alt = '';
    img.src = getFaviconUrl(fav.url, matchingTab?.favIconUrl || fav.favIconUrl);
    img.addEventListener('error', () => {
      img.src = DEFAULT_FALLBACK_ICON;
    }, { once: true });
    btn.appendChild(img);

    if (isAudible) {
      const dot = document.createElement('span');
      dot.className = 'fav-audio-dot';
      dot.setAttribute('aria-hidden', 'true');
      btn.appendChild(dot);
    }

    btn.addEventListener('click', async () => {
      await openOrActivateUrl(fav.url);
    });

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openCustomContextMenu(e.clientX, e.clientY, [
        {
          label: 'Open in New Tab',
          action: async () => {
            await chrome.runtime.sendMessage({ type: 'CREATE_TAB', url: fav.url });
          }
        },
        {
          label: 'Copy Clean URL',
          action: async () => {
            await copyTextWithToast(cleanTrackingUrl(fav.url));
          }
        },
        {
          label: 'Remove from Favorites',
          danger: true,
          action: async () => {
            uiState.arcState.favorites = uiState.arcState.favorites.filter((f) => f.id !== fav.id);
            await persistArcState();
            renderFavorites();
          }
        }
      ]);
    });

    btn.addEventListener('dragstart', (e) => {
      uiState.dragPayload = { kind: 'favorite', id: fav.id };
      e.dataTransfer.effectAllowed = 'move';
    });

    els.favoritesGrid.appendChild(btn);
  }
}

function renderSpaceHeader(activeSpace) {
  els.activeSpaceIcon.textContent = activeSpace.icon || '🌿';
  els.activeSpaceHeading.textContent = activeSpace.name || 'Space';
  els.btnToggleScope.textContent = uiState.arcState.viewAllSpacesTabs ? 'All' : 'Space';
}

function matchesFilter(title = '', url = '') {
  if (!uiState.filterQuery) return true;
  const q = uiState.filterQuery.toLowerCase();
  return title.toLowerCase().includes(q) || url.toLowerCase().includes(q);
}

function createPinnedRowElement(pin, activeSpace) {
  const linkedTab = pin.linkedTabId
    ? uiState.tabs.find((t) => t.id === pin.linkedTabId)
    : uiState.tabs.find((t) => urlsRoughlyMatch(t.url, pin.url));

  const displayTitle = linkedTab?.title || pin.title || formatCleanDomain(pin.url);
  const displayUrl = linkedTab?.url || pin.url;
  if (!matchesFilter(displayTitle, displayUrl)) return null;

  const li = document.createElement('li');
  li.className = 'tab-row pinned-tab-row';
  if (linkedTab?.active) li.classList.add('is-active');
  li.draggable = true;

  const mainBtn = document.createElement('button');
  mainBtn.type = 'button';
  mainBtn.className = 'tab-main-click';
  mainBtn.title = `${displayTitle}\n${displayUrl}`;

  const fav = document.createElement('img');
  fav.className = 'tab-favicon';
  fav.width = 16;
  fav.height = 16;
  fav.alt = '';
  fav.src = getFaviconUrl(displayUrl, linkedTab?.favIconUrl || pin.favIconUrl);
  fav.addEventListener('error', () => {
    fav.src = DEFAULT_FALLBACK_ICON;
  }, { once: true });

  const titleSpan = document.createElement('span');
  titleSpan.className = 'tab-title';
  titleSpan.textContent = displayTitle;

  mainBtn.append(fav, titleSpan);

  if (linkedTab) {
    const liveDot = document.createElement('span');
    liveDot.className = 'tab-live-dot';
    liveDot.title = 'Open in current window';
    mainBtn.appendChild(liveDot);
  }

  mainBtn.addEventListener('click', async () => {
    if (linkedTab) {
      await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: linkedTab.id });
    } else {
      const res = await chrome.runtime.sendMessage({
        type: 'CREATE_TAB',
        url: pin.url,
        spaceId: activeSpace.id
      });
      if (res?.tab?.id) {
        pin.linkedTabId = res.tab.id;
        await persistArcState();
        renderAll();
      }
    }
  });

  li.appendChild(mainBtn);

  // Audio button if linked tab is audible/muted
  if (linkedTab && (linkedTab.audible || linkedTab.mutedInfo?.muted)) {
    li.appendChild(createAudioToggleButton(linkedTab));
  }

  // Hover/Focus Actions
  const actions = document.createElement('div');
  actions.className = 'tab-row-actions';

  // If linked tab drifted from pinned URL, offer "Reset to Pinned URL"
  if (linkedTab && !urlsRoughlyMatch(linkedTab.url, pin.url)) {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'row-action-btn';
    resetBtn.textContent = '↩';
    resetBtn.title = `Reset to pinned URL (${pin.url})`;
    resetBtn.setAttribute('aria-label', 'Reset to pinned URL');
    resetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.tabs.update(linkedTab.id, { url: pin.url });
      showToast('Reset to pinned URL');
    });
    actions.appendChild(resetBtn);
  }

  const unpinBtn = document.createElement('button');
  unpinBtn.type = 'button';
  unpinBtn.className = 'row-action-btn';
  unpinBtn.textContent = '×';
  unpinBtn.title = linkedTab ? 'Close tab (Keep pinned)' : 'Remove pinned tab';
  unpinBtn.setAttribute('aria-label', unpinBtn.title);
  unpinBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (linkedTab) {
      pin.linkedTabId = null;
      await persistArcState();
      await chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: linkedTab.id });
    } else {
      activeSpace.pinnedTabs = activeSpace.pinnedTabs.filter((p) => p.id !== pin.id);
      await persistArcState();
      renderAll();
    }
  });
  actions.appendChild(unpinBtn);
  li.appendChild(actions);

  li.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const folderMoveItems = activeSpace.folders.map((folder) => ({
      label: `Move to Folder: ${folder.name}`,
      action: async () => {
        pin.folderId = folder.id;
        await persistArcState();
        renderAll();
      }
    }));

    openCustomContextMenu(e.clientX, e.clientY, [
      ...(linkedTab && !urlsRoughlyMatch(linkedTab.url, pin.url)
        ? [
            {
              label: 'Reset to Pinned URL',
              action: async () => {
                await chrome.tabs.update(linkedTab.id, { url: pin.url });
              }
            },
            {
              label: 'Replace Pinned URL with Current',
              action: async () => {
                pin.url = linkedTab.url;
                pin.title = linkedTab.title || pin.title;
                await persistArcState();
                showToast('Updated pinned URL');
                renderAll();
              }
            }
          ]
        : []),
      {
        label: 'Add to Top Favorites',
        action: async () => {
          await addItemToFavorites(displayTitle, pin.url, linkedTab?.favIconUrl || pin.favIconUrl);
        }
      },
      ...folderMoveItems,
      ...(pin.folderId
        ? [
            {
              label: 'Remove from Folder',
              action: async () => {
                pin.folderId = null;
                await persistArcState();
                renderAll();
              }
            }
          ]
        : []),
      {
        label: 'Copy Clean URL',
        action: async () => {
          await copyTextWithToast(cleanTrackingUrl(displayUrl));
        }
      },
      {
        label: 'Unpin from Space',
        danger: true,
        action: async () => {
          activeSpace.pinnedTabs = activeSpace.pinnedTabs.filter((p) => p.id !== pin.id);
          await persistArcState();
          renderAll();
        }
      }
    ]);
  });

  li.addEventListener('dragstart', (e) => {
    uiState.dragPayload = {
      kind: 'pinned',
      pinId: pin.id,
      title: displayTitle,
      url: pin.url,
      favIconUrl: pin.favIconUrl
    };
    e.dataTransfer.effectAllowed = 'move';
  });

  return li;
}

function renderPinnedSection(activeSpace) {
  els.pinnedFoldersContainer.replaceChildren();
  els.pinnedTabsList.replaceChildren();

  const folders = activeSpace.folders || [];
  const pinnedTabs = activeSpace.pinnedTabs || [];

  for (const folder of folders) {
    const folderPins = pinnedTabs.filter((p) => p.folderId === folder.id);
    const folderEl = document.createElement('div');
    folderEl.className = 'folder-group';
    if (folder.collapsed && !uiState.filterQuery) {
      folderEl.classList.add('is-collapsed');
    }

    const headerRow = document.createElement('div');
    headerRow.className = 'folder-header-row';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'folder-toggle-btn';
    toggleBtn.setAttribute('aria-expanded', String(!folder.collapsed));

    toggleBtn.innerHTML = `
      <svg class="folder-chevron" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      <svg class="folder-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
      </svg>
    `;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'folder-name';
    nameSpan.textContent = folder.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'folder-count';
    countSpan.textContent = String(folderPins.length);

    toggleBtn.append(nameSpan, countSpan);
    toggleBtn.addEventListener('click', async () => {
      folder.collapsed = !folder.collapsed;
      await persistArcState();
      renderPinnedSection(activeSpace);
    });

    headerRow.appendChild(toggleBtn);

    headerRow.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openCustomContextMenu(e.clientX, e.clientY, [
        {
          label: 'Open All Folder Tabs',
          action: async () => {
            for (const p of folderPins) {
              await openOrActivateUrl(p.url);
            }
          }
        },
        {
          label: 'Rename Folder',
          action: () => {
            openFolderModal(folder);
          }
        },
        {
          label: 'Delete Folder (Keep Tabs)',
          danger: true,
          action: async () => {
            for (const p of folderPins) {
              p.folderId = null;
            }
            activeSpace.folders = activeSpace.folders.filter((f) => f.id !== folder.id);
            await persistArcState();
            renderAll();
          }
        }
      ]);
    });

    // Allow dropping tabs or pins into this folder
    setupDropZoneEvents(headerRow, async (payload) => {
      await handleDropIntoFolder(folder.id, payload, activeSpace);
    });

    const childrenUl = document.createElement('ul');
    childrenUl.className = 'folder-children';
    for (const pin of folderPins) {
      const row = createPinnedRowElement(pin, activeSpace);
      if (row) childrenUl.appendChild(row);
    }

    folderEl.append(headerRow, childrenUl);
    els.pinnedFoldersContainer.appendChild(folderEl);
  }

  // Root-level pinned tabs (not inside any folder)
  const rootPins = pinnedTabs.filter((p) => !p.folderId);
  for (const pin of rootPins) {
    const row = createPinnedRowElement(pin, activeSpace);
    if (row) els.pinnedTabsList.appendChild(row);
  }

  els.pinnedEmptyHint.hidden = folders.length > 0 || rootPins.length > 0;
}

function getTodayTabsForSpace(activeSpace) {
  const linkedTabIds = new Set();
  for (const space of uiState.arcState.spaces) {
    for (const pin of space.pinnedTabs) {
      if (pin.linkedTabId) linkedTabIds.add(pin.linkedTabId);
    }
  }

  return uiState.tabs.filter((tab) => {
    if (linkedTabIds.has(tab.id)) return false;
    if (!matchesFilter(tab.title || '', tab.url || '')) return false;
    if (uiState.arcState.viewAllSpacesTabs) return true;
    const assignedSpace = uiState.arcState.tabSpaceMap[tab.id] || uiState.arcState.activeSpaceId;
    return assignedSpace === activeSpace.id;
  });
}

function createAudioToggleButton(tab) {
  const isMuted = Boolean(tab.mutedInfo?.muted);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tab-audio-btn';
  if (isMuted) btn.classList.add('is-muted');
  btn.title = isMuted ? 'Unmute tab' : 'Mute tab';
  btn.setAttribute('aria-label', btn.title);
  btn.textContent = isMuted ? '🔇' : '🔊';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ type: 'TOGGLE_MUTE_TAB', tabId: tab.id });
    await refreshSnapshot();
  });
  return btn;
}

function createTodayTabRowElement(tab, activeSpace) {
  const li = document.createElement('li');
  li.className = 'tab-row today-tab-row';
  if (tab.active) li.classList.add('is-active');
  if (tab.discarded) li.classList.add('is-discarded');
  li.draggable = true;

  const mainBtn = document.createElement('button');
  mainBtn.type = 'button';
  mainBtn.className = 'tab-main-click';
  mainBtn.title = `${tab.title || 'Tab'}\n${tab.url || ''}`;

  const fav = document.createElement('img');
  fav.className = 'tab-favicon';
  fav.width = 16;
  fav.height = 16;
  fav.alt = '';
  fav.src = getFaviconUrl(tab.url, tab.favIconUrl);
  fav.addEventListener('error', () => {
    fav.src = DEFAULT_FALLBACK_ICON;
  }, { once: true });

  const titleSpan = document.createElement('span');
  titleSpan.className = 'tab-title';
  titleSpan.textContent = (tab.discarded ? '💤 ' : '') + (tab.title || formatCleanDomain(tab.url));

  mainBtn.append(fav, titleSpan);
  mainBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: tab.id });
  });
  li.appendChild(mainBtn);

  if (tab.audible || tab.mutedInfo?.muted) {
    li.appendChild(createAudioToggleButton(tab));
  }

  const actions = document.createElement('div');
  actions.className = 'tab-row-actions';

  const pinBtn = document.createElement('button');
  pinBtn.type = 'button';
  pinBtn.className = 'row-action-btn';
  pinBtn.textContent = '📌';
  pinBtn.title = `Pin to ${activeSpace.name}`;
  pinBtn.setAttribute('aria-label', pinBtn.title);
  pinBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await pinTabToSpace(tab, activeSpace);
  });

  const splitBtn = document.createElement('button');
  splitBtn.type = 'button';
  splitBtn.className = 'row-action-btn';
  splitBtn.textContent = '◫';
  splitBtn.title = 'Pair in Arc Split View with active tab';
  splitBtn.setAttribute('aria-label', splitBtn.title);
  splitBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await createSplitPairWithActive(tab, activeSpace);
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'row-action-btn';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close tab';
  closeBtn.setAttribute('aria-label', 'Close tab');
  closeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: tab.id });
  });

  actions.append(pinBtn, splitBtn, closeBtn);
  li.appendChild(actions);

  li.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const moveSpaceItems = uiState.arcState.spaces
      .filter((s) => s.id !== activeSpace.id)
      .map((s) => ({
        label: `Move to ${s.icon} ${s.name}`,
        action: async () => {
          uiState.arcState.tabSpaceMap[tab.id] = s.id;
          await persistArcState();
          showToast(`Moved to ${s.name}`);
          renderAll();
        }
      }));

    openCustomContextMenu(e.clientX, e.clientY, [
      {
        label: `Pin to ${activeSpace.name}`,
        action: async () => {
          await pinTabToSpace(tab, activeSpace);
        }
      },
      {
        label: 'Add to Top Favorites',
        action: async () => {
          await addItemToFavorites(tab.title, tab.url, tab.favIconUrl);
        }
      },
      {
        label: 'Pair in Split View with Active Tab',
        action: async () => {
          await createSplitPairWithActive(tab, activeSpace);
        }
      },
      {
        label: 'Copy Clean URL',
        action: async () => {
          await copyTextWithToast(cleanTrackingUrl(tab.url));
        }
      },
      {
        label: 'Duplicate Tab',
        action: async () => {
          await chrome.tabs.duplicate(tab.id);
        }
      },
      ...(!tab.active && !tab.discarded
        ? [
            {
              label: '💤 Suspend Tab (Save Memory)',
              action: async () => {
                await chrome.runtime.sendMessage({ type: 'DISCARD_TAB', tabId: tab.id });
                await refreshSnapshot();
              }
            }
          ]
        : []),
      ...moveSpaceItems,
      {
        label: 'Close Tab',
        danger: true,
        action: async () => {
          await chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: tab.id });
        }
      }
    ]);
  });

  li.addEventListener('dragstart', (e) => {
    uiState.dragPayload = {
      kind: 'today-tab',
      tabId: tab.id,
      index: tab.index,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl
    };
    e.dataTransfer.effectAllowed = 'move';
  });

  li.addEventListener('dragover', (e) => {
    if (uiState.dragPayload?.kind === 'today-tab') {
      e.preventDefault();
      li.classList.add('is-drag-over');
    }
  });

  li.addEventListener('dragleave', () => {
    li.classList.remove('is-drag-over');
  });

  li.addEventListener('drop', async (e) => {
    e.preventDefault();
    li.classList.remove('is-drag-over');
    if (uiState.dragPayload?.kind === 'today-tab' && uiState.dragPayload.tabId !== tab.id) {
      await chrome.tabs.move(uiState.dragPayload.tabId, { index: tab.index });
      await refreshSnapshot();
    }
  });

  return li;
}

function renderSplitPairRow(pair, tabA, tabB) {
  const li = document.createElement('li');
  li.className = 'split-pair-row';

  const createHalf = (t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'split-half-btn';
    if (t.active) btn.classList.add('is-active');
    btn.title = `${t.title}\n${t.url}`;

    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.width = 14;
    img.height = 14;
    img.alt = '';
    img.src = getFaviconUrl(t.url, t.favIconUrl);

    const span = document.createElement('span');
    span.className = 'tab-title';
    span.textContent = t.title || formatCleanDomain(t.url);

    btn.append(img, span);
    btn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: t.id });
    });
    return btn;
  };

  const vDivider = document.createElement('span');
  vDivider.className = 'split-divider-v';

  const unsplitBtn = document.createElement('button');
  unsplitBtn.type = 'button';
  unsplitBtn.className = 'row-action-btn';
  unsplitBtn.textContent = '×';
  unsplitBtn.title = 'Unsplit tabs';
  unsplitBtn.setAttribute('aria-label', 'Unsplit tabs');
  unsplitBtn.addEventListener('click', async () => {
    uiState.arcState.splitPairs = uiState.arcState.splitPairs.filter((p) => p.id !== pair.id);
    await persistArcState();
    renderAll();
  });

  li.append(createHalf(tabA), vDivider, createHalf(tabB), unsplitBtn);
  return li;
}

function categorizeTabDomain(url) {
  const host = formatCleanDomain(url).toLowerCase();
  if (/github|gitlab|stackoverflow|localhost|vercel|netlify|linear|jira/.test(host)) {
    return '⚡ Engineering & Dev';
  }
  if (/docs|wikipedia|arxiv|developer|mdn|notion|medium|substack/.test(host)) {
    return '📚 Docs & Knowledge';
  }
  if (/youtube|spotify|netflix|twitch|soundcloud|vimeo/.test(host)) {
    return '🎧 Media & Video';
  }
  if (/mail|slack|discord|x\.com|twitter|reddit|linkedin|news\.ycombinator/.test(host)) {
    return '💬 Social & Comms';
  }
  return `🌐 ${host || 'General'}`;
}

function renderTodaySection(activeSpace) {
  els.tidyGroupsContainer.replaceChildren();
  els.todayTabsList.replaceChildren();

  const todayTabs = getTodayTabsForSpace(activeSpace);
  els.todayCountBadge.textContent = String(todayTabs.length);

  const pairedTabIds = new Set();
  for (const pair of uiState.arcState.splitPairs || []) {
    const tabA = todayTabs.find((t) => t.id === pair.leftTabId);
    const tabB = todayTabs.find((t) => t.id === pair.rightTabId);
    if (tabA && tabB) {
      pairedTabIds.add(tabA.id);
      pairedTabIds.add(tabB.id);
      els.todayTabsList.appendChild(renderSplitPairRow(pair, tabA, tabB));
    }
  }

  const remainingTabs = todayTabs.filter((t) => !pairedTabIds.has(t.id));

  if (uiState.tidyGroupedMode && remainingTabs.length > 1) {
    const buckets = new Map();
    for (const tab of remainingTabs) {
      const cat = categorizeTabDomain(tab.url);
      if (!buckets.has(cat)) buckets.set(cat, []);
      buckets.get(cat).push(tab);
    }

    for (const [category, groupTabs] of buckets.entries()) {
      const card = document.createElement('div');
      card.className = 'tidy-domain-card';

      const header = document.createElement('div');
      header.className = 'tidy-card-header';
      header.innerHTML = `<span>${category}</span><span>${groupTabs.length}</span>`;
      card.appendChild(header);

      const ul = document.createElement('ul');
      ul.className = 'tab-list';
      for (const tab of groupTabs) {
        ul.appendChild(createTodayTabRowElement(tab, activeSpace));
      }
      card.appendChild(ul);
      els.tidyGroupsContainer.appendChild(card);
    }
  } else {
    for (const tab of remainingTabs) {
      els.todayTabsList.appendChild(createTodayTabRowElement(tab, activeSpace));
    }
  }
}

function renderMediaController() {
  const audibleTab = uiState.tabs.find((t) => t.audible || t.mutedInfo?.muted);
  if (!audibleTab) {
    els.nowPlayingBar.hidden = true;
    return;
  }

  els.nowPlayingBar.hidden = false;
  els.mediaFavicon.src = getFaviconUrl(audibleTab.url, audibleTab.favIconUrl);
  els.mediaTitle.textContent = audibleTab.title || formatCleanDomain(audibleTab.url);
  els.mediaJumpTab.onclick = async () => {
    await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: audibleTab.id });
  };
  els.btnMediaMute.onclick = async () => {
    await chrome.runtime.sendMessage({ type: 'TOGGLE_MUTE_TAB', tabId: audibleTab.id });
    await refreshSnapshot();
  };
}

function renderSpacesDock(activeSpace) {
  els.spacesDock.replaceChildren();

  for (const space of uiState.arcState.spaces) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'space-dock-btn';
    if (space.id === activeSpace.id) btn.classList.add('is-active');
    btn.title = `Switch to ${space.name}`;

    const iconSpan = document.createElement('span');
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = space.icon || '🌿';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = space.name;

    btn.append(iconSpan, nameSpan);
    btn.addEventListener('click', async () => {
      uiState.arcState.activeSpaceId = space.id;
      await persistArcState();
      renderAll();
    });

    // Drop target: drag any tab onto a Space button to move it to that Space
    setupDropZoneEvents(btn, async (payload) => {
      if (payload?.kind === 'today-tab' && payload.tabId) {
        uiState.arcState.tabSpaceMap[payload.tabId] = space.id;
        await persistArcState();
        showToast(`Moved tab to ${space.name}`);
        renderAll();
      }
    });

    els.spacesDock.appendChild(btn);
  }
}

function syncSettingsControls() {
  if (!uiState.arcState) return;
  els.selectAutoArchive.value = String(uiState.arcState.autoArchiveHours ?? 12);
  els.toggleAllTabs.checked = Boolean(uiState.arcState.viewAllSpacesTabs);
  els.toggleLeftPeek.checked = uiState.arcState.leftPeekEnabled !== false;
}

// Actions & Helpers
async function openOrActivateUrl(url) {
  const existing = uiState.tabs.find((t) => urlsRoughlyMatch(t.url, url));
  if (existing) {
    await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: existing.id });
  } else {
    const activeSpace = getActiveSpace();
    await chrome.runtime.sendMessage({
      type: 'CREATE_TAB',
      url,
      spaceId: activeSpace?.id
    });
  }
}

async function copyTextWithToast(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied Clean URL to Clipboard');
  } catch (err) {
    console.error('Clipboard copy failed:', err);
  }
}

async function pinTabToSpace(tab, space, folderId = null) {
  if (!tab?.url || !space) return;
  const exists = space.pinnedTabs.some(
    (p) => p.linkedTabId === tab.id || urlsRoughlyMatch(p.url, tab.url)
  );
  if (exists) {
    showToast(`Already pinned in ${space.name}`);
    return;
  }
  space.pinnedTabs.push({
    id: `pin-${Date.now()}`,
    title: tab.title || formatCleanDomain(tab.url),
    url: tab.url,
    favIconUrl: tab.favIconUrl || '',
    folderId,
    linkedTabId: tab.id
  });
  uiState.arcState.tabSpaceMap[tab.id] = space.id;
  await persistArcState();
  showToast(`Pinned to ${space.name}`);
  renderAll();
}

async function addItemToFavorites(title, url, favIconUrl = '') {
  if (!url) return;
  if (uiState.arcState.favorites.some((f) => urlsRoughlyMatch(f.url, url))) {
    showToast('Already in Favorites');
    return;
  }
  uiState.arcState.favorites.push({
    id: `fav-${Date.now()}`,
    title: title || formatCleanDomain(url),
    url,
    favIconUrl
  });
  await persistArcState();
  showToast('Added to Favorites');
  renderFavorites();
}

async function createSplitPairWithActive(targetTab, activeSpace) {
  const activeTab = uiState.activeTab;
  if (!activeTab || activeTab.id === targetTab.id) {
    showToast('Select a different tab to pair with the active tab');
    return;
  }
  uiState.arcState.splitPairs = (uiState.arcState.splitPairs || []).filter(
    (p) =>
      p.leftTabId !== activeTab.id &&
      p.rightTabId !== activeTab.id &&
      p.leftTabId !== targetTab.id &&
      p.rightTabId !== targetTab.id
  );
  uiState.arcState.splitPairs.push({
    id: `split-${Date.now()}`,
    leftTabId: activeTab.id,
    rightTabId: targetTab.id,
    spaceId: activeSpace.id
  });
  await persistArcState();
  showToast('Paired in Arc Split View');
  renderAll();
}

// Custom Right-Click Context Menu using Popover API
function openCustomContextMenu(clientX, clientY, items) {
  els.contextMenuItems.replaceChildren();
  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ctx-item-btn';
    if (item.danger) btn.classList.add('is-danger');
    btn.textContent = item.label;
    btn.addEventListener('click', async () => {
      els.contextMenuPopover.hidePopover();
      await item.action();
    });
    els.contextMenuItems.appendChild(btn);
  }

  const maxLeft = Math.max(8, window.innerWidth - 200);
  const maxTop = Math.max(8, window.innerHeight - (items.length * 32 + 24));
  els.contextMenuPopover.style.insetInlineStart = `${Math.min(clientX, maxLeft)}px`;
  els.contextMenuPopover.style.insetBlockStart = `${Math.min(clientY, maxTop)}px`;
  els.contextMenuPopover.showPopover();
}

// Drag & Drop Helpers
function setupDropZoneEvents(element, onDropCallback) {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    element.classList.add('is-drag-over');
  });
  element.addEventListener('dragleave', () => {
    element.classList.remove('is-drag-over');
  });
  element.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('is-drag-over');
    if (uiState.dragPayload) {
      const payload = uiState.dragPayload;
      uiState.dragPayload = null;
      await onDropCallback(payload);
    }
  });
}

async function handleDropIntoFolder(folderId, payload, activeSpace) {
  if (payload.kind === 'pinned') {
    const pin = activeSpace.pinnedTabs.find((p) => p.id === payload.pinId);
    if (pin) {
      pin.folderId = folderId;
      await persistArcState();
      renderAll();
    }
  } else if (payload.kind === 'today-tab') {
    const tab = uiState.tabs.find((t) => t.id === payload.tabId);
    if (tab) {
      await pinTabToSpace(tab, activeSpace, folderId);
    }
  }
}

// Command Bar Modal (⌘K)
async function openCommandBarModal(initialQuery = '') {
  els.commandInput.value = initialQuery;
  uiState.commandSelectedIndex = 0;
  await updateCommandBarSuggestions(initialQuery);
  if (!els.commandDialog.open) {
    els.commandDialog.showModal();
  }
  els.commandInput.focus();
  els.commandInput.select();
}

async function updateCommandBarSuggestions(rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  const activeSpace = getActiveSpace();
  const suggestions = [];

  // 1. Direct URL or Search option if user typed text
  if (q.length > 0) {
    const looksLikeUrl = /^(https?:\/\/|localhost|\w+\.\w{2,})/.test(q) && !q.includes(' ');
    if (looksLikeUrl) {
      const targetUrl = q.startsWith('http') ? rawQuery.trim() : `https://${rawQuery.trim()}`;
      suggestions.push({
        title: `Open URL: ${targetUrl}`,
        subtitle: `Navigate in ${activeSpace?.name || 'Space'}`,
        badge: 'Open URL',
        iconUrl: DEFAULT_FALLBACK_ICON,
        run: async () => {
          await chrome.runtime.sendMessage({
            type: 'CREATE_TAB',
            url: targetUrl,
            spaceId: activeSpace?.id
          });
        }
      });
    }
    suggestions.push({
      title: `Search Google for "${rawQuery.trim()}"`,
      subtitle: 'google.com',
      badge: 'Web Search',
      iconUrl: getFaviconUrl('https://www.google.com'),
      run: async () => {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(rawQuery.trim())}`;
        await chrome.runtime.sendMessage({
          type: 'CREATE_TAB',
          url: searchUrl,
          spaceId: activeSpace?.id
        });
      }
    });
  }

  // 2. Open Tabs
  for (const tab of uiState.tabs) {
    const tTitle = tab.title || formatCleanDomain(tab.url);
    const tUrl = tab.url || '';
    if (!q || tTitle.toLowerCase().includes(q) || tUrl.toLowerCase().includes(q)) {
      suggestions.push({
        title: tTitle,
        subtitle: formatCleanDomain(tUrl),
        badge: tab.active ? 'Active Tab' : 'Switch to Tab',
        iconUrl: getFaviconUrl(tUrl, tab.favIconUrl),
        run: async () => {
          await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: tab.id });
        }
      });
    }
  }

  // 3. Pinned Tabs across Spaces
  for (const space of uiState.arcState.spaces) {
    for (const pin of space.pinnedTabs) {
      if (!q || pin.title.toLowerCase().includes(q) || pin.url.toLowerCase().includes(q)) {
        suggestions.push({
          title: pin.title,
          subtitle: `${space.icon} ${space.name} • ${formatCleanDomain(pin.url)}`,
          badge: 'Pinned',
          iconUrl: getFaviconUrl(pin.url, pin.favIconUrl),
          run: async () => {
            uiState.arcState.activeSpaceId = space.id;
            await persistArcState();
            await openOrActivateUrl(pin.url);
            renderAll();
          }
        });
      }
    }
  }

  // 4. Built-in Arc Quick Actions
  const quickCommands = [
    {
      title: 'Tidy Today Tabs by Domain Category',
      subtitle: 'Arc Max Smart Tidy',
      badge: 'Command',
      run: async () => {
        uiState.tidyGroupedMode = !uiState.tidyGroupedMode;
        renderAll();
        showToast(uiState.tidyGroupedMode ? 'Tidied Today tabs' : 'Restored flat tab list');
      }
    },
    {
      title: 'Copy Clean URL of Current Tab',
      subtitle: 'Strips tracking parameters (⌘⇧C)',
      badge: 'Command',
      run: async () => {
        if (uiState.activeTab?.url) {
          await copyTextWithToast(cleanTrackingUrl(uiState.activeTab.url));
        }
      }
    },
    {
      title: 'Clear & Archive Inactive Today Tabs',
      subtitle: 'Moves unpinned Today tabs to Archive',
      badge: 'Command',
      run: async () => {
        await clearTodayTabs(activeSpace);
      }
    },
    {
      title: 'Suspend Inactive Tabs (Memory Saver)',
      subtitle: 'Discards background tabs to free RAM',
      badge: 'Command',
      run: async () => {
        await suspendInactiveTabs();
      }
    }
  ];

  for (const cmd of quickCommands) {
    if (!q || cmd.title.toLowerCase().includes(q) || cmd.subtitle.toLowerCase().includes(q)) {
      suggestions.push({
        ...cmd,
        iconUrl: DEFAULT_FALLBACK_ICON
      });
    }
  }

  uiState.commandItems = suggestions.slice(0, 18);
  uiState.commandSelectedIndex = Math.min(
    uiState.commandSelectedIndex,
    Math.max(0, uiState.commandItems.length - 1)
  );
  renderCommandResultsList();
}

function renderCommandResultsList() {
  els.commandResults.replaceChildren();
  uiState.commandItems.forEach((item, idx) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmd-result-item';
    if (idx === uiState.commandSelectedIndex) btn.classList.add('is-selected');

    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.width = 16;
    img.height = 16;
    img.alt = '';
    img.src = item.iconUrl || DEFAULT_FALLBACK_ICON;
    img.addEventListener('error', () => {
      img.src = DEFAULT_FALLBACK_ICON;
    }, { once: true });

    const textWrap = document.createElement('div');
    textWrap.className = 'cmd-item-text';

    const titleEl = document.createElement('span');
    titleEl.className = 'cmd-item-title';
    titleEl.textContent = item.title;

    const subEl = document.createElement('span');
    subEl.className = 'cmd-item-sub';
    subEl.textContent = item.subtitle;

    textWrap.append(titleEl, subEl);

    const badgeEl = document.createElement('span');
    badgeEl.className = 'cmd-badge';
    badgeEl.textContent = item.badge;

    btn.append(img, textWrap, badgeEl);
    btn.addEventListener('click', async () => {
      els.commandDialog.close('execute');
      await item.run();
    });

    li.appendChild(btn);
    els.commandResults.appendChild(li);
  });
}

// Space Customization Modal
function openSpaceModal(isNew = false) {
  uiState.editingSpaceIsNew = isNew;
  const activeSpace = getActiveSpace();

  if (isNew) {
    els.spaceDialogTitle.textContent = 'Create New Space';
    els.spaceIconInput.value = '🚀';
    els.spaceNameInput.value = '';
    els.spaceHueSlider.value = '188';
    els.spaceHueOutput.value = '188';
    els.spaceAccentSlider.value = '245';
    els.spaceAccentOutput.value = '245';
    els.spaceDomainsInput.value = '';
    els.btnDeleteSpace.hidden = true;
  } else if (activeSpace) {
    els.spaceDialogTitle.textContent = `Customize ${activeSpace.name}`;
    els.spaceIconInput.value = activeSpace.icon || '🌿';
    els.spaceNameInput.value = activeSpace.name || '';
    const h1 = activeSpace.theme?.hue ?? 256;
    const h2 = activeSpace.theme?.accentHue ?? 318;
    els.spaceHueSlider.value = String(h1);
    els.spaceHueOutput.value = String(h1);
    els.spaceAccentSlider.value = String(h2);
    els.spaceAccentOutput.value = String(h2);
    els.spaceDomainsInput.value = (activeSpace.domainRules || []).join(', ');
    els.btnDeleteSpace.hidden = uiState.arcState.spaces.length <= 1;
  }

  els.spaceDialog.showModal();
}

function openFolderModal(existingFolder = null) {
  uiState.editingFolderId = existingFolder?.id || null;
  els.folderDialogTitle.textContent = existingFolder ? 'Rename Folder' : 'New Folder';
  els.folderNameInput.value = existingFolder?.name || '';
  els.folderDialog.showModal();
}

// Archive & Recently Closed Modal
async function openArchiveModal() {
  els.archiveFilterInput.value = '';
  await renderArchiveItems('');
  els.archiveDialog.showModal();
}

async function renderArchiveItems(query = '') {
  els.archiveList.replaceChildren();
  const q = query.trim().toLowerCase();

  const items = [];
  for (const entry of uiState.arcState.archive || []) {
    items.push({
      title: entry.title || entry.url,
      url: entry.url,
      subtitle: `${entry.reason || 'Archived'} • ${formatCleanDomain(entry.url)}`,
      favIconUrl: entry.favIconUrl
    });
  }

  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 15 });
    for (const s of sessions) {
      if (s.tab?.url && !s.tab.url.startsWith('chrome://newtab')) {
        items.push({
          title: s.tab.title || s.tab.url,
          url: s.tab.url,
          subtitle: `Recently Closed • ${formatCleanDomain(s.tab.url)}`,
          favIconUrl: s.tab.favIconUrl || ''
        });
      }
    }
  } catch {
    // Ignore if sessions unavailable
  }

  const filtered = items.filter(
    (item) => !q || item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'pinned-empty-drop';
    emptyLi.textContent = 'No archived or recently closed tabs found.';
    els.archiveList.appendChild(emptyLi);
    return;
  }

  for (const item of filtered) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmd-result-item';

    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.width = 16;
    img.height = 16;
    img.alt = '';
    img.src = getFaviconUrl(item.url, item.favIconUrl);

    const textWrap = document.createElement('div');
    textWrap.className = 'cmd-item-text';

    const tSpan = document.createElement('span');
    tSpan.className = 'cmd-item-title';
    tSpan.textContent = item.title;

    const sSpan = document.createElement('span');
    sSpan.className = 'cmd-item-sub';
    sSpan.textContent = item.subtitle;

    textWrap.append(tSpan, sSpan);

    const restoreBadge = document.createElement('span');
    restoreBadge.className = 'cmd-badge';
    restoreBadge.textContent = 'Restore';

    btn.append(img, textWrap, restoreBadge);
    btn.addEventListener('click', async () => {
      els.archiveDialog.close();
      await openOrActivateUrl(item.url);
    });

    li.appendChild(btn);
    els.archiveList.appendChild(li);
  }
}

// Today Tab Utilities
async function clearTodayTabs(activeSpace) {
  const todayTabs = getTodayTabsForSpace(activeSpace).filter((t) => !t.active && !t.audible);
  if (todayTabs.length === 0) {
    showToast('No inactive Today tabs to clear');
    return;
  }

  const now = Date.now();
  for (const tab of todayTabs) {
    if (tab.url && !tab.url.startsWith('chrome://newtab')) {
      uiState.arcState.archive.unshift({
        id: `arch-${now}-${tab.id}`,
        title: tab.title || tab.url,
        url: tab.url,
        favIconUrl: tab.favIconUrl || '',
        spaceId: activeSpace.id,
        archivedAt: now,
        reason: `Cleared from ${activeSpace.name}`
      });
    }
  }
  uiState.arcState.archive = uiState.arcState.archive.slice(0, 120);
  await persistArcState();
  await chrome.tabs.remove(todayTabs.map((t) => t.id));
  showToast(`Archived ${todayTabs.length} Today tab${todayTabs.length > 1 ? 's' : ''}`);
}

async function suspendInactiveTabs() {
  let count = 0;
  for (const tab of uiState.tabs) {
    if (!tab.active && !tab.audible && !tab.discarded) {
      try {
        await chrome.tabs.discard(tab.id);
        count++;
      } catch {
        // Tab cannot be discarded
      }
    }
  }
  await refreshSnapshot();
  showToast(count > 0 ? `Suspended ${count} inactive tab${count > 1 ? 's' : ''}` : 'All inactive tabs already suspended');
}

async function closeDuplicateTabs() {
  const seenUrls = new Set();
  const dupIds = [];
  for (const tab of uiState.tabs) {
    const normalized = cleanTrackingUrl(tab.url || '');
    if (!normalized) continue;
    if (seenUrls.has(normalized) && !tab.active) {
      dupIds.push(tab.id);
    } else {
      seenUrls.add(normalized);
    }
  }
  if (dupIds.length > 0) {
    await chrome.tabs.remove(dupIds);
    showToast(`Closed ${dupIds.length} duplicate tab${dupIds.length > 1 ? 's' : ''}`);
  } else {
    showToast('No duplicate tabs found');
  }
}

async function syncChromeTabGroupsToFolders() {
  const activeSpace = getActiveSpace();
  if (!activeSpace) return;

  const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  if (groups.length === 0) {
    showToast('No Chrome Tab Groups in this window');
    return;
  }

  let imported = 0;
  for (const grp of groups) {
    const folderName = grp.title || `Group ${grp.id}`;
    let folder = activeSpace.folders.find((f) => f.name === folderName);
    if (!folder) {
      folder = {
        id: `folder-${Date.now()}-${grp.id}`,
        name: folderName,
        collapsed: Boolean(grp.collapsed),
        color: grp.color || 'blue'
      };
      activeSpace.folders.push(folder);
      imported++;
    }

    const groupTabs = uiState.tabs.filter((t) => t.groupId === grp.id);
    for (const t of groupTabs) {
      const exists = activeSpace.pinnedTabs.some((p) => urlsRoughlyMatch(p.url, t.url));
      if (!exists && t.url) {
        activeSpace.pinnedTabs.push({
          id: `pin-${Date.now()}-${t.id}`,
          title: t.title || formatCleanDomain(t.url),
          url: t.url,
          favIconUrl: t.favIconUrl || '',
          folderId: folder.id,
          linkedTabId: t.id
        });
      }
    }
  }

  await persistArcState();
  renderAll();
  showToast(`Synced ${groups.length} Chrome Tab Group${groups.length > 1 ? 's' : ''}`);
}

async function importBookmarksBarToSpace() {
  const activeSpace = getActiveSpace();
  if (!activeSpace) return;
  try {
    const tree = await chrome.bookmarks.getTree();
    const bar = tree?.[0]?.children?.[0];
    if (!bar?.children?.length) {
      showToast('Bookmarks Bar is empty');
      return;
    }

    const folder = {
      id: `folder-bm-${Date.now()}`,
      name: 'Bookmarks Bar',
      collapsed: false,
      color: 'purple'
    };
    activeSpace.folders.push(folder);

    let count = 0;
    for (const node of bar.children.slice(0, 24)) {
      if (node.url) {
        activeSpace.pinnedTabs.push({
          id: `pin-bm-${Date.now()}-${count}`,
          title: node.title || formatCleanDomain(node.url),
          url: node.url,
          favIconUrl: '',
          folderId: folder.id,
          linkedTabId: null
        });
        count++;
      }
    }

    await persistArcState();
    renderAll();
    showToast(`Imported ${count} bookmarks into folder`);
  } catch (err) {
    console.error('Error importing bookmarks:', err);
    showToast('Could not import bookmarks');
  }
}

// Setup Light-Dismiss Fallback for <dialog closedby="any">
function setupDialogFallbacks() {
  const dialogs = document.querySelectorAll('dialog[closedby="any"]');

  for (const dialog of dialogs) {
    dialog.addEventListener('close', () => {
      dialog.returnValue = '';
    });
  }

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of dialogs) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    }
  }
}

function bindEvents() {
  setupDialogFallbacks();

  // Topbar Navigation
  els.btnBack.addEventListener('click', async () => {
    if (uiState.activeTab?.id) {
      try {
        await chrome.tabs.goBack(uiState.activeTab.id);
      } catch {
        // Cannot go back
      }
    }
  });

  els.btnForward.addEventListener('click', async () => {
    if (uiState.activeTab?.id) {
      try {
        await chrome.tabs.goForward(uiState.activeTab.id);
      } catch {
        // Cannot go forward
      }
    }
  });

  els.btnReload.addEventListener('click', async () => {
    if (uiState.activeTab?.id) {
      await chrome.tabs.reload(uiState.activeTab.id);
    }
  });

  els.btnCopyUrl.addEventListener('click', async () => {
    if (uiState.activeTab?.url) {
      const clean = cleanTrackingUrl(uiState.activeTab.url);
      await copyTextWithToast(clean);
      await chrome.runtime.sendMessage({ type: 'CLEAN_URL_REQUEST', url: clean });
    }
  });

  els.btnPinCurrent.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ type: 'PIN_ACTIVE_TAB' });
    if (res?.ok) {
      showToast(res.pinned ? `Pinned to ${res.spaceName}` : `Unpinned from ${res.spaceName}`);
      await refreshSnapshot();
    }
  });

  els.btnUrlPill.addEventListener('click', async () => {
    await openCommandBarModal('');
  });

  // Inline Filter
  els.filterInput.addEventListener('input', () => {
    uiState.filterQuery = els.filterInput.value.trim();
    els.btnClearFilter.hidden = !uiState.filterQuery;
    renderAll();
  });

  els.btnClearFilter.addEventListener('click', () => {
    els.filterInput.value = '';
    uiState.filterQuery = '';
    els.btnClearFilter.hidden = true;
    renderAll();
  });

  // Space Header Actions
  els.btnSpaceMenu.addEventListener('click', () => openSpaceModal(false));
  els.btnEditSpace.addEventListener('click', () => openSpaceModal(false));
  els.btnCreateSpace.addEventListener('click', () => openSpaceModal(true));
  els.btnNewFolder.addEventListener('click', () => openFolderModal(null));
  els.btnSyncGroups.addEventListener('click', syncChromeTabGroupsToFolders);

  // Today Divider Actions
  els.btnToggleScope.addEventListener('click', async () => {
    uiState.arcState.viewAllSpacesTabs = !uiState.arcState.viewAllSpacesTabs;
    await persistArcState();
    renderAll();
    showToast(
      uiState.arcState.viewAllSpacesTabs
        ? 'Showing tabs from all Spaces'
        : `Showing only ${getActiveSpace()?.name} tabs`
    );
  });

  els.btnTidyTabs.addEventListener('click', () => {
    uiState.tidyGroupedMode = !uiState.tidyGroupedMode;
    renderAll();
    showToast(uiState.tidyGroupedMode ? '✨ Tidied Today tabs by domain' : 'Restored standard tab list');
  });

  els.btnClearToday.addEventListener('click', async () => {
    const activeSpace = getActiveSpace();
    if (activeSpace) {
      await clearTodayTabs(activeSpace);
    }
  });

  els.btnNewTab.addEventListener('click', async () => {
    await openCommandBarModal('');
  });

  // Drop Zones for Favorites, Pinned Root, Today
  setupDropZoneEvents(els.favoritesGrid, async (payload) => {
    if (payload.url) {
      await addItemToFavorites(payload.title, payload.url, payload.favIconUrl);
    }
  });

  const pinnedSection = document.querySelector('.arc-pinned-section');
  setupDropZoneEvents(pinnedSection, async (payload) => {
    const activeSpace = getActiveSpace();
    if (!activeSpace) return;
    if (payload.kind === 'today-tab') {
      const tab = uiState.tabs.find((t) => t.id === payload.tabId);
      if (tab) await pinTabToSpace(tab, activeSpace, null);
    } else if (payload.kind === 'pinned') {
      const pin = activeSpace.pinnedTabs.find((p) => p.id === payload.pinId);
      if (pin) {
        pin.folderId = null;
        await persistArcState();
        renderAll();
      }
    }
  });

  // Command Bar Events
  els.btnCloseCommand.addEventListener('click', () => els.commandDialog.close());

  els.commandInput.addEventListener('input', async () => {
    uiState.commandSelectedIndex = 0;
    await updateCommandBarSuggestions(els.commandInput.value);
  });

  els.commandInput.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (uiState.commandItems.length > 0) {
        uiState.commandSelectedIndex = (uiState.commandSelectedIndex + 1) % uiState.commandItems.length;
        renderCommandResultsList();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (uiState.commandItems.length > 0) {
        uiState.commandSelectedIndex =
          (uiState.commandSelectedIndex - 1 + uiState.commandItems.length) % uiState.commandItems.length;
        renderCommandResultsList();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = uiState.commandItems[uiState.commandSelectedIndex];
      if (chosen) {
        els.commandDialog.close('execute');
        await chosen.run();
      }
    }
  });

  // Global Keyboard Shortcuts inside Sidepanel
  window.addEventListener('keydown', async (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 't')) {
      e.preventDefault();
      await openCommandBarModal('');
    } else if (e.altKey && ['1', '2', '3', '4', '5', '6'].includes(e.key)) {
      const idx = Number(e.key) - 1;
      const targetSpace = uiState.arcState?.spaces?.[idx];
      if (targetSpace) {
        e.preventDefault();
        uiState.arcState.activeSpaceId = targetSpace.id;
        await persistArcState();
        renderAll();
        showToast(`Switched to ${targetSpace.icon} ${targetSpace.name}`);
      }
    }
  });

  // Space Editor Form & Live Theme Preview
  els.spaceHueSlider.addEventListener('input', () => {
    els.spaceHueOutput.value = els.spaceHueSlider.value;
    applySpaceThemeVariables({
      hue: Number(els.spaceHueSlider.value),
      accentHue: Number(els.spaceAccentSlider.value),
      saturation: 75
    });
  });

  els.spaceAccentSlider.addEventListener('input', () => {
    els.spaceAccentOutput.value = els.spaceAccentSlider.value;
    applySpaceThemeVariables({
      hue: Number(els.spaceHueSlider.value),
      accentHue: Number(els.spaceAccentSlider.value),
      saturation: 75
    });
  });

  els.themePresetsRow.querySelectorAll('.theme-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const h1 = Number(swatch.dataset.hue);
      const h2 = Number(swatch.dataset.accent);
      const sat = Number(swatch.dataset.sat || 74);
      els.spaceHueSlider.value = String(h1);
      els.spaceHueOutput.value = String(h1);
      els.spaceAccentSlider.value = String(h2);
      els.spaceAccentOutput.value = String(h2);
      applySpaceThemeVariables({ hue: h1, accentHue: h2, saturation: sat });
    });
  });

  els.spaceDialog.addEventListener('close', async () => {
    const action = els.spaceDialog.returnValue;
    els.spaceDialog.returnValue = '';
    if (action !== 'save') {
      renderAll();
      return;
    }

    const icon = els.spaceIconInput.value.trim() || '🌿';
    const name = els.spaceNameInput.value.trim() || 'Space';
    const hue = Number(els.spaceHueSlider.value);
    const accentHue = Number(els.spaceAccentSlider.value);
    const domainRules = els.spaceDomainsInput.value
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    if (uiState.editingSpaceIsNew) {
      const newSpace = {
        id: `space-${Date.now()}`,
        name,
        icon,
        theme: { hue, accentHue, saturation: 74, style: 'custom' },
        domainRules,
        folders: [],
        pinnedTabs: []
      };
      uiState.arcState.spaces.push(newSpace);
      uiState.arcState.activeSpaceId = newSpace.id;
      showToast(`Created Space "${name}"`);
    } else {
      const activeSpace = getActiveSpace();
      if (activeSpace) {
        activeSpace.icon = icon;
        activeSpace.name = name;
        activeSpace.theme = { hue, accentHue, saturation: 74, style: 'custom' };
        activeSpace.domainRules = domainRules;
        showToast(`Saved "${name}"`);
      }
    }

    await persistArcState();
    renderAll();
  });

  els.btnDeleteSpace.addEventListener('click', async () => {
    if (uiState.arcState.spaces.length <= 1) return;
    const activeSpace = getActiveSpace();
    if (!activeSpace) return;
    uiState.arcState.spaces = uiState.arcState.spaces.filter((s) => s.id !== activeSpace.id);
    uiState.arcState.activeSpaceId = uiState.arcState.spaces[0].id;
    els.spaceDialog.close('delete');
    await persistArcState();
    renderAll();
    showToast(`Deleted Space "${activeSpace.name}"`);
  });

  // Folder Modal Save
  els.folderDialog.addEventListener('close', async () => {
    const action = els.folderDialog.returnValue;
    els.folderDialog.returnValue = '';
    if (action !== 'save') return;

    const folderName = els.folderNameInput.value.trim();
    if (!folderName) return;
    const activeSpace = getActiveSpace();
    if (!activeSpace) return;

    if (uiState.editingFolderId) {
      const folder = activeSpace.folders.find((f) => f.id === uiState.editingFolderId);
      if (folder) folder.name = folderName;
    } else {
      activeSpace.folders.push({
        id: `folder-${Date.now()}`,
        name: folderName,
        collapsed: false,
        color: 'blue'
      });
    }
    await persistArcState();
    renderAll();
  });

  // Archive Modal Events
  els.btnOpenArchive.addEventListener('click', openArchiveModal);
  els.btnCloseArchive.addEventListener('click', () => els.archiveDialog.close());
  els.archiveFilterInput.addEventListener('input', async () => {
    await renderArchiveItems(els.archiveFilterInput.value);
  });
  els.btnClearArchive.addEventListener('click', async () => {
    uiState.arcState.archive = [];
    await persistArcState();
    await renderArchiveItems('');
    showToast('Cleared Archive history');
  });

  // Settings Popover Events
  els.selectAutoArchive.addEventListener('change', async () => {
    uiState.arcState.autoArchiveHours = Number(els.selectAutoArchive.value);
    await persistArcState();
    showToast(
      uiState.arcState.autoArchiveHours > 0
        ? `Auto-archive set to ${uiState.arcState.autoArchiveHours}h`
        : 'Auto-archive disabled'
    );
  });

  els.toggleAllTabs.addEventListener('change', async () => {
    uiState.arcState.viewAllSpacesTabs = els.toggleAllTabs.checked;
    await persistArcState();
    renderAll();
  });

  els.toggleLeftPeek.addEventListener('change', async () => {
    uiState.arcState.leftPeekEnabled = els.toggleLeftPeek.checked;
    await persistArcState();
  });

  els.btnSuspendInactive.addEventListener('click', suspendInactiveTabs);
  els.btnCloseDuplicates.addEventListener('click', closeDuplicateTabs);
  els.btnImportBookmarks.addEventListener('click', importBookmarksBarToSpace);

  // Chrome Tab & Storage Real-Time Listeners
  chrome.tabs.onCreated.addListener(refreshSnapshot);
  chrome.tabs.onRemoved.addListener(refreshSnapshot);
  chrome.tabs.onActivated.addListener(refreshSnapshot);
  chrome.tabs.onMoved.addListener(refreshSnapshot);
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (
      changeInfo.status ||
      changeInfo.title ||
      changeInfo.url ||
      changeInfo.pinned !== undefined ||
      changeInfo.audible !== undefined ||
      changeInfo.mutedInfo !== undefined ||
      changeInfo.discarded !== undefined
    ) {
      refreshSnapshot();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.arcState?.newValue) {
      uiState.arcState = changes.arcState.newValue;
      reconcileLinkedTabs();
      renderAll();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'ARC_OPEN_COMMAND_BAR') {
      openCommandBarModal('');
    } else if (message?.type === 'ARC_SIDEBAR_COPY_URL' && message.text) {
      copyTextWithToast(message.text);
    }
  });
}

// Initialize Side Panel
bindEvents();
refreshSnapshot();
