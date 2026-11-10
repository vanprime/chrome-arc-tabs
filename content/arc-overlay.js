// Arc Vertical Sidebar — In-Page Command Bar, Left-Edge Peek Sidebar & Toast Overlay
// Isolated in Shadow DOM; uses async/await and requestAnimationFrame batching

(() => {
  if (window.__arcOverlayInitialized) return;
  window.__arcOverlayInitialized = true;

  let hostEl = null;
  let shadow = null;
  let peekDrawerEl = null;
  let cmdModalEl = null;
  let cmdInputEl = null;
  let cmdListEl = null;
  let toastEl = null;
  let toastTimer = null;
  let peekHoverTimer = null;
  let snapshotCache = null;
  let leftPeekEnabled = true;
  let cmdItems = [];
  let cmdIndex = 0;

  function ensureShadowHost() {
    if (hostEl && shadow) return;
    hostEl = document.createElement('div');
    hostEl.id = 'arc-chrome-overlay-host';
    hostEl.style.cssText = 'all: initial; position: fixed; z-index: 2147483646; pointer-events: none; inset: 0;';
    shadow = hostEl.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        --arc-hue: 256;
        --arc-accent: 318;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
        color-scheme: light dark;
      }
      :where(div, button, input, ul, li, span, kbd) {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font: inherit;
      }
      .peek-edge-sensor {
        position: fixed;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 5px;
        pointer-events: auto;
        z-index: 2147483645;
      }
      .peek-drawer {
        position: fixed;
        inset-block: 10px;
        inset-inline-start: 10px;
        inline-size: 265px;
        border-radius: 14px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background:
          radial-gradient(120% 90% at 0% 0%, hsl(var(--arc-hue) 70% 24% / 0.92), transparent 65%),
          linear-gradient(165deg, hsl(var(--arc-hue) 34% 13% / 0.95), hsl(var(--arc-accent) 28% 10% / 0.95));
        color: #f8fafc;
        border: 1px solid rgb(255 255 255 / 0.16);
        box-shadow: 0 20px 50px rgb(0 0 0 / 0.45);
        backdrop-filter: blur(20px);
        transform: translateX(-290px);
        opacity: 0;
        pointer-events: none;
        transition: transform 200ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 160ms ease;
      }
      .peek-drawer.is-open {
        transform: translateX(0);
        opacity: 1;
        pointer-events: auto;
      }
      .peek-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-inline: 4px;
        font-size: 12.5px;
        font-weight: 700;
      }
      .peek-cmd-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        inline-size: 100%;
        padding: 7px 10px;
        border-radius: 9px;
        border: 1px solid rgb(255 255 255 / 0.12);
        background: rgb(255 255 255 / 0.08);
        color: #e2e8f0;
        font-size: 12px;
        cursor: pointer;
      }
      .peek-cmd-btn:hover {
        background: rgb(255 255 255 / 0.14);
      }
      .peek-list {
        list-style: none;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .peek-tab-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        inline-size: 100%;
        padding: 6px 8px;
        border-radius: 7px;
        border: none;
        background: transparent;
        color: #cbd5e1;
        font-size: 12px;
        text-align: start;
        cursor: pointer;
      }
      .peek-tab-btn:hover {
        background: rgb(255 255 255 / 0.1);
        color: #fff;
      }
      .peek-tab-btn.is-active {
        background: rgb(255 255 255 / 0.18);
        color: #fff;
        font-weight: 600;
      }
      .peek-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .peek-section-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        padding: 6px 6px 2px;
      }
      .peek-spaces-row {
        display: flex;
        gap: 4px;
        padding-block-start: 6px;
        border-block-start: 1px solid rgb(255 255 255 / 0.1);
        overflow-x: auto;
      }
      .peek-space-pill {
        padding: 4px 8px;
        border-radius: 99px;
        border: none;
        background: rgb(255 255 255 / 0.07);
        color: #cbd5e1;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
      }
      .peek-space-pill.is-active {
        background: rgb(255 255 255 / 0.22);
        color: #fff;
        font-weight: 600;
      }

      /* In-Page Arc Command Bar Overlay */
      .cmd-backdrop {
        position: fixed;
        inset: 0;
        background: rgb(0 0 0 / 0.42);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-block-start: 12vh;
        opacity: 0;
        pointer-events: none;
        transition: opacity 130ms ease;
      }
      .cmd-backdrop.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      .cmd-box {
        inline-size: min(560px, calc(100vw - 32px));
        border-radius: 16px;
        padding: 12px;
        background: hsl(var(--arc-hue) 30% 13% / 0.96);
        color: #f8fafc;
        border: 1px solid rgb(255 255 255 / 0.18);
        box-shadow: 0 24px 60px rgb(0 0 0 / 0.55);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .cmd-input-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 6px 10px;
        border-block-end: 1px solid rgb(255 255 255 / 0.12);
      }
      .cmd-input {
        flex: 1;
        background: transparent;
        border: none;
        color: #fff;
        font-size: 16px;
        font-weight: 500;
        outline: none;
      }
      .cmd-input::placeholder {
        color: #94a3b8;
      }
      .cmd-results {
        list-style: none;
        max-block-size: 320px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .cmd-row-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        inline-size: 100%;
        padding: 8px 10px;
        border-radius: 9px;
        border: none;
        background: transparent;
        color: #e2e8f0;
        text-align: start;
        cursor: pointer;
        font-size: 13px;
      }
      .cmd-row-btn:hover,
      .cmd-row-btn.is-selected {
        background: rgb(255 255 255 / 0.15);
        color: #fff;
      }
      .cmd-row-meta {
        font-size: 11px;
        color: #94a3b8;
        padding: 2px 6px;
        border-radius: 5px;
        background: rgb(255 255 255 / 0.08);
      }

      /* Arc Floating Toast Pill */
      .arc-toast {
        position: fixed;
        inset-block-start: 16px;
        inset-inline-end: 16px;
        padding: 10px 14px;
        border-radius: 12px;
        background: hsl(var(--arc-hue) 35% 14% / 0.95);
        color: #fff;
        border: 1px solid rgb(255 255 255 / 0.18);
        box-shadow: 0 12px 30px rgb(0 0 0 / 0.35);
        backdrop-filter: blur(14px);
        display: flex;
        flex-direction: column;
        gap: 2px;
        transform: translateY(-16px);
        opacity: 0;
        transition: transform 180ms ease, opacity 180ms ease;
      }
      .arc-toast.is-visible {
        transform: translateY(0);
        opacity: 1;
      }
      .arc-toast-title {
        font-size: 12.5px;
        font-weight: 600;
      }
      .arc-toast-sub {
        font-size: 11px;
        color: #94a3b8;
        max-inline-size: 260px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;

    // Left-edge Peek Sensor & Drawer
    const edgeSensor = document.createElement('div');
    edgeSensor.className = 'peek-edge-sensor';

    peekDrawerEl = document.createElement('aside');
    peekDrawerEl.className = 'peek-drawer';

    edgeSensor.addEventListener('mouseenter', () => {
      if (!leftPeekEnabled) return;
      clearTimeout(peekHoverTimer);
      peekHoverTimer = setTimeout(async () => {
        await refreshAndRenderPeekDrawer();
        peekDrawerEl.classList.add('is-open');
      }, 170);
    });

    edgeSensor.addEventListener('mouseleave', () => {
      clearTimeout(peekHoverTimer);
    });

    peekDrawerEl.addEventListener('mouseleave', () => {
      peekDrawerEl.classList.remove('is-open');
    });

    // Command Bar Backdrop & Box
    cmdModalEl = document.createElement('div');
    cmdModalEl.className = 'cmd-backdrop';
    cmdModalEl.innerHTML = `
      <div class="cmd-box" role="dialog" aria-label="Arc Command Bar">
        <div class="cmd-input-row">
          <span>✨</span>
          <input type="text" class="cmd-input" placeholder="Arc Command Bar — Search tabs, spaces, or type a URL..." autocomplete="off">
        </div>
        <ul class="cmd-results"></ul>
      </div>
    `;
    cmdInputEl = cmdModalEl.querySelector('.cmd-input');
    cmdListEl = cmdModalEl.querySelector('.cmd-results');

    cmdModalEl.addEventListener('mousedown', (e) => {
      if (e.target === cmdModalEl) {
        closeInPageCommandBar();
      }
    });

    cmdInputEl.addEventListener('input', () => {
      cmdIndex = 0;
      buildCommandItems(cmdInputEl.value);
    });

    cmdInputEl.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeInPageCommandBar();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (cmdItems.length) {
          cmdIndex = (cmdIndex + 1) % cmdItems.length;
          renderCommandItemsDOM();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (cmdItems.length) {
          cmdIndex = (cmdIndex - 1 + cmdItems.length) % cmdItems.length;
          renderCommandItemsDOM();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = cmdItems[cmdIndex];
        if (item) {
          closeInPageCommandBar();
          await item.run();
        }
      }
    });

    // Toast
    toastEl = document.createElement('div');
    toastEl.className = 'arc-toast';
    toastEl.innerHTML = `<span class="arc-toast-title"></span><span class="arc-toast-sub"></span>`;

    shadow.append(style, edgeSensor, peekDrawerEl, cmdModalEl, toastEl);
    document.documentElement.appendChild(hostEl);
  }

  async function fetchSnapshot() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_ARC_SNAPSHOT' });
      if (res?.ok) {
        snapshotCache = res;
        leftPeekEnabled = res.arcState?.leftPeekEnabled !== false;
        const activeSpace =
          res.arcState.spaces.find((s) => s.id === res.arcState.activeSpaceId) || res.arcState.spaces[0];
        if (activeSpace?.theme && hostEl) {
          hostEl.style.setProperty('--arc-hue', String(activeSpace.theme.hue ?? 256));
          hostEl.style.setProperty('--arc-accent', String(activeSpace.theme.accentHue ?? 318));
        }
      }
    } catch {
      // Extension context invalidated or background asleep
    }
  }

  async function refreshAndRenderPeekDrawer() {
    ensureShadowHost();
    await fetchSnapshot();
    if (!snapshotCache?.arcState) return;

    const { arcState, tabs } = snapshotCache;
    const activeSpace =
      arcState.spaces.find((s) => s.id === arcState.activeSpaceId) || arcState.spaces[0];

    await new Promise((resolve) =>
      requestAnimationFrame(() => {
        peekDrawerEl.replaceChildren();

        const header = document.createElement('div');
        header.className = 'peek-header';
        header.innerHTML = `<span>${activeSpace.icon || '🌿'} ${activeSpace.name}</span><span style="font-size:10px;opacity:0.65;">Arc Peek</span>`;

        const cmdBtn = document.createElement('button');
        cmdBtn.type = 'button';
        cmdBtn.className = 'peek-cmd-btn';
        cmdBtn.innerHTML = `<span>Search or enter URL...</span><kbd style="font-size:10px;opacity:0.7;">⌘⇧K</kbd>`;
        cmdBtn.addEventListener('click', () => {
          peekDrawerEl.classList.remove('is-open');
          openInPageCommandBar();
        });

        const list = document.createElement('ul');
        list.className = 'peek-list';

        if (activeSpace.pinnedTabs?.length) {
          const pinHeader = document.createElement('li');
          pinHeader.className = 'peek-section-label';
          pinHeader.textContent = 'Pinned';
          list.appendChild(pinHeader);

          for (const pin of activeSpace.pinnedTabs) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'peek-tab-btn';
            btn.innerHTML = `<span>📌</span><span class="peek-title"></span>`;
            btn.querySelector('.peek-title').textContent = pin.title || pin.url;
            btn.addEventListener('click', async () => {
              peekDrawerEl.classList.remove('is-open');
              await chrome.runtime.sendMessage({
                type: 'CREATE_TAB',
                url: pin.url,
                spaceId: activeSpace.id
              });
            });
            li.appendChild(btn);
            list.appendChild(li);
          }
        }

        const todayHeader = document.createElement('li');
        todayHeader.className = 'peek-section-label';
        todayHeader.textContent = 'Today Tabs';
        list.appendChild(todayHeader);

        for (const tab of tabs) {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'peek-tab-btn';
          if (tab.active) btn.classList.add('is-active');
          btn.innerHTML = `<span>${tab.audible ? '🔊' : '•'}</span><span class="peek-title"></span>`;
          btn.querySelector('.peek-title').textContent = tab.title || tab.url;
          btn.addEventListener('click', async () => {
            peekDrawerEl.classList.remove('is-open');
            await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: tab.id });
          });
          li.appendChild(btn);
          list.appendChild(li);
        }

        const spacesRow = document.createElement('div');
        spacesRow.className = 'peek-spaces-row';
        for (const sp of arcState.spaces) {
          const spBtn = document.createElement('button');
          spBtn.type = 'button';
          spBtn.className = 'peek-space-pill';
          if (sp.id === activeSpace.id) spBtn.classList.add('is-active');
          spBtn.textContent = `${sp.icon} ${sp.name}`;
          spBtn.addEventListener('click', async () => {
            await chrome.runtime.sendMessage({ type: 'SWITCH_SPACE', spaceId: sp.id });
            await refreshAndRenderPeekDrawer();
          });
          spacesRow.appendChild(spBtn);
        }

        peekDrawerEl.append(header, cmdBtn, list, spacesRow);
        resolve();
      })
    );
  }

  async function openInPageCommandBar() {
    ensureShadowHost();
    await fetchSnapshot();
    cmdInputEl.value = '';
    cmdIndex = 0;
    buildCommandItems('');
    cmdModalEl.classList.add('is-open');
    cmdInputEl.focus();
  }

  function closeInPageCommandBar() {
    if (cmdModalEl) {
      cmdModalEl.classList.remove('is-open');
    }
  }

  function buildCommandItems(rawQuery) {
    const q = rawQuery.trim().toLowerCase();
    const list = [];
    const tabs = snapshotCache?.tabs || [];
    const arcState = snapshotCache?.arcState;

    if (q) {
      const isUrl = /^(https?:\/\/|localhost|\w+\.\w{2,})/.test(q) && !q.includes(' ');
      if (isUrl) {
        const target = q.startsWith('http') ? rawQuery.trim() : `https://${rawQuery.trim()}`;
        list.push({
          title: `Open URL: ${target}`,
          meta: 'Navigate',
          run: async () => {
            await chrome.runtime.sendMessage({ type: 'CREATE_TAB', url: target });
          }
        });
      }
      list.push({
        title: `Search Google for "${rawQuery.trim()}"`,
        meta: 'Google Search',
        run: async () => {
          const url = `https://www.google.com/search?q=${encodeURIComponent(rawQuery.trim())}`;
          await chrome.runtime.sendMessage({ type: 'CREATE_TAB', url });
        }
      });
    }

    for (const tab of tabs) {
      const title = tab.title || tab.url || 'Tab';
      if (!q || title.toLowerCase().includes(q) || (tab.url && tab.url.toLowerCase().includes(q))) {
        list.push({
          title,
          meta: tab.active ? 'Current Tab' : 'Switch to Tab',
          run: async () => {
            await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: tab.id });
          }
        });
      }
    }

    if (arcState?.spaces) {
      for (const sp of arcState.spaces) {
        if (!q || sp.name.toLowerCase().includes(q)) {
          list.push({
            title: `Switch Space to ${sp.icon} ${sp.name}`,
            meta: 'Arc Space',
            run: async () => {
              await chrome.runtime.sendMessage({ type: 'SWITCH_SPACE', spaceId: sp.id });
              showInPageToast(`Switched to ${sp.icon} ${sp.name}`);
            }
          });
        }
      }
    }

    cmdItems = list.slice(0, 14);
    renderCommandItemsDOM();
  }

  function renderCommandItemsDOM() {
    requestAnimationFrame(() => {
      if (!cmdListEl) return;
      cmdListEl.replaceChildren();
      cmdItems.forEach((item, index) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cmd-row-btn';
        if (index === cmdIndex) btn.classList.add('is-selected');

        const titleSpan = document.createElement('span');
        titleSpan.className = 'peek-title';
        titleSpan.textContent = item.title;

        const metaSpan = document.createElement('span');
        metaSpan.className = 'cmd-row-meta';
        metaSpan.textContent = item.meta;

        btn.append(titleSpan, metaSpan);
        btn.addEventListener('click', async () => {
          closeInPageCommandBar();
          await item.run();
        });
        li.appendChild(btn);
        cmdListEl.appendChild(li);
      });
    });
  }

  function showInPageToast(title, subtitle = '') {
    ensureShadowHost();
    requestAnimationFrame(() => {
      toastEl.querySelector('.arc-toast-title').textContent = `✓ ${title}`;
      const subEl = toastEl.querySelector('.arc-toast-sub');
      subEl.textContent = subtitle;
      subEl.hidden = !subtitle;
      toastEl.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastEl.classList.remove('is-visible');
      }, 2200);
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      try {
        if (message?.type === 'ARC_TOGGLE_COMMAND_BAR') {
          ensureShadowHost();
          if (cmdModalEl.classList.contains('is-open')) {
            closeInPageCommandBar();
          } else {
            await openInPageCommandBar();
          }
          sendResponse({ ok: true });
        } else if (message?.type === 'ARC_SHOW_TOAST') {
          showInPageToast(message.message, message.subtitle || '');
          sendResponse({ ok: true });
        } else if (message?.type === 'ARC_COPY_TEXT') {
          if (message.text) {
            await navigator.clipboard.writeText(message.text);
          }
          showInPageToast(message.message || 'Copied Clean URL', message.subtitle || '');
          sendResponse({ ok: true });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  });

  // Initialize passive left-edge peek sensor once idle
  (async () => {
    await fetchSnapshot();
    if (leftPeekEnabled) {
      ensureShadowHost();
    }
  })();
})();
