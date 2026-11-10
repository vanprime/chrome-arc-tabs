# Arc Vertical Sidebar for Chrome

A native Manifest V3 Chrome Extension that brings **Arc Browser's Vertical Sidebar** workflow to Google Chrome — complete with **Spaces**, **Atmospheric Mesh Themes**, **Top Favorites Tiles**, **Persistent Pinned Tabs & Folders**, **Today Tabs with Smart Tidy & Auto-Archive**, **Split View Pairing**, **Live Audio Controller**, **Command Bar (`⌘K`)**, and an **In-Page Left-Edge Peek Sidebar**.

---

## Quick Setup (Developer Mode / Unpacked Extension)

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select this repository folder (`/Users/dustin/www/chrome-arc-tabs`).
4. **Dock the Side Panel on the Left (Arc Layout)**:
   - Open `chrome://settings/appearance` in Chrome.
   - Under **Side panel**, select **Show on left side**.
5. Click the **Arc Vertical Sidebar** extension icon in the toolbar (or press `⌘⇧S` on macOS / `Alt+S` on Windows & Linux) to open the sidebar.

---

## Core Features

- **URL Pill & Navigation Bar**:
  - Back, Forward, Reload, Pin/Unpin Current Tab (`⌥P`), and **Copy Clean URL (`⌘⇧C`)** which automatically strips `utm_*`, `fbclid`, `gclid`, and other tracking parameters.
  - Clicking the URL Pill opens the **Arc Command Bar (`⌘K`)**.
- **Favorites Bar (Top Grid)**:
  - Global 4-column icon tile grid persisted across all Spaces with active-tab indicators, live audio dots, and drag-and-drop support.
- **Spaces & Atmospheric Theme Studio**:
  - Switch between Spaces (`Personal`, `Work`, `Research`, or create custom Spaces) from the bottom dock or with `⌥1`–`⌥6`.
  - Customize each Space's **Primary & Secondary Mesh Gradient Hue**, **Icon**, **Name**, and **Domain Auto-Routing Rules** (e.g. automatically route `github.com` and `linear.app` tabs to your *Work* Space).
- **Pinned Tabs & Collapsible Folders**:
  - Pinned tabs persist even when closed. When a pinned tab navigates away from its root URL, click `↩` on hover to snap back to its pinned URL.
  - Organize pins into nested **Folders** via drag-and-drop, or click **Sync Chrome Tab Groups** to import native Chrome Tab Groups.
- **Today Tabs, Smart Tidy (`✨ Tidy`), & Auto-Archive**:
  - **Smart Tidy** groups open Today tabs into clean domain/topic cards with one click.
  - **Clear** moves inactive Today tabs into the **Archive & Recently Closed** drawer (`🕘`).
  - **Auto-Archive** (`chrome.alarms`) automatically archives inactive unpinned tabs after 12h, 24h, or 3d.
- **Arc Split View (`◫`)**:
  - Pair any tab with your active tab into a unified dual-column `[ Tab A | Tab B ]` row in the sidebar.
- **In-Page Left-Edge Hover Peek & Command Bar**:
  - Even when Chrome's native Side Panel is closed, hovering the left 5px edge of any webpage slides out the Shadow DOM **Arc Peek Sidebar**, and pressing `⌘⇧K` (`Alt+K`) opens the centered **In-Page Arc Command Bar**.

---

## Keyboard Shortcuts

| Action | macOS | Windows / Linux |
| :--- | :--- | :--- |
| Toggle Arc Vertical Sidebar | `⌘ + Shift + S` | `Alt + S` |
| Open Arc Command Bar | `⌘ + Shift + K` (or `⌘K` / `⌘T` in sidebar) | `Alt + K` |
| Pin / Unpin Active Tab | `Alt + P` | `Alt + P` |
| Copy Clean URL (Arc Style) | `⌘ + Shift + C` | `Alt + C` |
| Switch Spaces `1`–`6` (in sidebar) | `Alt + 1` … `Alt + 6` | `Alt + 1` … `Alt + 6` |
