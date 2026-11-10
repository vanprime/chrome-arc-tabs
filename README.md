# Arc Vertical Sidebar for Chrome (Plasmo + React + TypeScript)

A native Manifest V3 Chrome Extension built with **[Plasmo](https://docs.plasmo.com/)**, **React 18**, and **TypeScript** that brings **Arc Browser's Vertical Sidebar** workflow to Google Chrome — complete with **Spaces**, **Atmospheric Mesh Themes**, **Top Favorites Tiles**, **Persistent Pinned Tabs & Folders**, **Today Tabs with Smart Tidy & Auto-Archive**, **Split View Pairing**, **Live Audio Controller**, **Command Bar (`⌘K`)**, and an **In-Page Left-Edge Peek Sidebar**.

---

## Development & Build Commands

```bash
# Install dependencies
pnpm install

# Start live-reload development server (outputs to build/chrome-mv3-dev)
pnpm dev

# Build optimized unpacked extension (outputs to build/chrome-mv3-prod)
pnpm build

# Run TypeScript typechecking
pnpm typecheck
```

---

## Loading in Chrome (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select:
   - `/Users/dustin/www/chrome-arc-tabs/build/chrome-mv3-prod` (after running `pnpm build`), **or**
   - `/Users/dustin/www/chrome-arc-tabs/build/chrome-mv3-dev` (while running `pnpm dev` for instant HMR).
4. **Dock the Side Panel on the Left (Arc Layout)**:
   - Open `chrome://settings/appearance` in Chrome.
   - Under **Side panel**, select **Show on left side**.
5. Click the **Arc Vertical Sidebar** extension icon in the toolbar (or press `⌘⇧S` on macOS / `Alt+S` on Windows & Linux) to open the sidebar.

---

## Project Architecture (`src/`)

- `src/background/index.ts` — Stateless Manifest V3 Service Worker (`chrome.sidePanel.setPanelBehavior`, tab-to-Space domain routing, context menus, `chrome.alarms` auto-archive, and message hub).
- `src/sidepanel/index.tsx` & `src/sidepanel/style.css` — Main Side Panel React entrypoint and CSS Cascade Layer (`@layer`) design system.
- `src/contents/arc-overlay.tsx` — Plasmo Content Script UI (CSUI) rendered inside an isolated Shadow DOM for the in-page **Left-Edge Hover Peek Sidebar**, **In-Page Command Bar (`⌘⇧K`)**, and **Arc Toast Notifications**.
- `src/components/` — Modular React components:
  - `TopBar.tsx` — Navigation toolbar, Pin/Copy actions, `⌘K` URL Pill, and inline `<search>` tab filter.
  - `FavoritesGrid.tsx` — Top 4-column squircle Favorites grid with drag-and-drop and live indicators.
  - `PinnedSection.tsx` — Space Header, collapsible Folders, Chrome Tab Group sync, and Pinned Tabs with drifted-URL reset (`↩`).
  - `TodaySection.tsx` — Arc Divider (`Today`, count badge, `Space`/`All` scope toggle, `✨ Tidy`, `Clear`), `+ New Tab` button, Split View rows, and Today Tab list.
  - `MediaBar.tsx` — Floating live audio mini-player when any tab is playing sound.
  - `SpacesFooter.tsx` — Bottom Space Switcher dock, Archive trigger, and Settings popover.
  - `modals/` — Native `<dialog closedby="any">` modals (`CommandDialog.tsx`, `SpaceDialog.tsx`, `ArchiveDialog.tsx`, `FolderDialog.tsx`).
- `src/types/arc.ts`, `src/lib/storage.ts`, & `src/lib/url-utils.ts` — Shared TypeScript interfaces, `chrome.storage.local` persistence helpers, and URL/favicon utilities.
