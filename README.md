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

## Replacing Chrome's Native Tabs & Navigation

Chrome normally enforces its horizontal top tab bar and omnibox in standard windows. This extension provides **three complementary integration layers** to replace Chrome's native UI:

1. **Arc Chromeless Mode (`⛶` Button in Top Bar or Right-Click Menu)**:
   - One click switches the Chrome window into **Fullscreen Chromeless Mode** (hiding Chrome's native horizontal tab strip and native address bar completely) and docks the **In-Page Arc Sidebar** (`260px`) on the left edge of the page, shifting page content cleanly so nothing is covered.
   - Click `«` inside the docked sidebar to fold it into a 6px left-edge hover peek whenever you want full-bleed reading or video.
2. **Inline Editable Omnibox & Navigation Controls**:
   - Click the URL pill at the top of the sidebar to type any URL or Google search query directly inline (`Enter` navigates the current tab; `⌘Enter` opens in a new tab), alongside Back (`←`), Forward (`→`), Reload (`↻`), Copy Clean URL (`🔗`), and Pin (`📌`).
3. **Auto-Collapse Inactive Tabs in Chrome's Top Strip (Windowed Mode)**:
   - In **Settings (`⚙️`) → Auto-Collapse Inactive Tabs in Chrome Top Strip**, the extension automatically groups all background tabs into a single collapsed `[Arc]` badge in Chrome's horizontal tab bar so only your active tab is shown at the top.
