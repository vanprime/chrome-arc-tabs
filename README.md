# Arc Vertical Sidebar for Chrome (Plasmo + React + TypeScript)

A native Manifest V3 Chrome Extension built with **[Plasmo](https://docs.plasmo.com/)**, **React 18**, and **TypeScript** that brings **Arc Browser's Vertical Sidebar** workflow to Google Chrome — complete with **Top Large-Icon Spaces (`Personal`, `Work`, `Research`)**, **Inline Editable Omnibox Navigation**, **Arc Chromeless Mode (Hides Native Top Bar)**, **Auto-Collapsing Native Chrome Tab Strip**, **Persistent Pinned Tabs & Folders**, **Today Tabs with Smart Tidy & Auto-Archive**, **Split View Pairing**, **Live Audio Controller**, and **Command Bar (`⌘K`)**.

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

---

## Replacing Chrome's Native Tabs & Navigation (Default + 1-Click Top Controls)

Right at the top of the sidebar (`TopBar`), you have a **1-Click Chrome UI Mode Bar** with three instant controls:

1. **`✓ Collapse Top Tabs` & Bidirectional Native Chrome Tab Groups (Enabled by Default)**:
   - Every Space at the top of the sidebar (`🌿 Personal`, `⚡ Work`, `🔭 Research`, plus any custom Space you create) is represented as a **real Native Chrome Tab Group (`chrome.tabGroups`)** in the browser window with matching title, emoji, and color (`purple`, `blue`, `green`, etc.).
   - Each Space's Pinned Tabs and Today Tabs are automatically placed inside that Space's native Chrome Tab Group — so **even if you disable or delete the extension, all your Spaces and tabs remain intact as native Chrome Tab Groups in Chrome!**
   - Inactive Spaces' native Chrome Tab Groups are automatically collapsed into compact colored pills in Chrome's horizontal tab bar so only your active Space is expanded.
   - Bidirectional sync: renaming or recoloring a Tab Group in Chrome's top bar updates the Space in Arc, and creating a named Tab Group in Chrome automatically adds it to the top Spaces switcher.
2. **`❐ Tabless Win` (Chromeless Desktop Window — No Chrome Tab Bar or URL Bar)**:
   - Converts the current tab into a regular resizable desktop window (`type: "popup"`) where Chrome completely omits the horizontal tab strip, native address bar, and bookmarks bar, while automatically docking the **In-Page Left Arc Sidebar** (`260px`) for full Spaces, tabs, and URL navigation.
   - Click `❐` in the docked sidebar (or right-click anywhere on the page) to restore a normal Chrome window in one click.
3. **`⛶ Fullscreen` (Edge-to-Edge Chromeless Arc Mode)**:
   - Enters fullscreen chromeless mode and docks the **In-Page Left Arc Sidebar** (`260px`) on the left edge of the page. Click `«` in the docked sidebar to fold it into a 6px left-edge hover peek.
