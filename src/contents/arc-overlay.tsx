import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DEFAULT_ARC_STATE } from "~lib/storage"
import { formatCleanDomain } from "~lib/url-utils"
import type { ArcState } from "~types/arc"

export const config: PlasmoCSConfig = {
  matches: ["https://*/*", "http://*/*"],
  run_at: "document_idle"
}

const OVERLAY_CSS = `
  :host {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
    color-scheme: light dark;
  }
  :where(div, aside, header, nav, button, input, form, ul, li, span, kbd) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font: inherit;
  }
  .arc-csui-root {
    --arc-hue: 256;
    --arc-accent: 318;
  }
  .peek-edge-sensor {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: 6px;
    pointer-events: auto;
    z-index: 2147483645;
  }
  .peek-drawer {
    position: fixed;
    inset-block: 10px;
    inset-inline-start: 10px;
    inline-size: 266px;
    border-radius: 14px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background:
      radial-gradient(120% 90% at 0% 0%, hsl(var(--arc-hue) 70% 24% / 0.94), transparent 65%),
      linear-gradient(165deg, hsl(var(--arc-hue) 34% 13% / 0.97), hsl(var(--arc-accent) 28% 10% / 0.97));
    color: #f8fafc;
    border: 1px solid rgb(255 255 255 / 0.16);
    box-shadow: 0 20px 50px rgb(0 0 0 / 0.45);
    backdrop-filter: blur(20px);
    transform: translateX(-290px);
    opacity: 0;
    pointer-events: none;
    transition: transform 200ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 160ms ease;
    z-index: 2147483646;
  }
  .peek-drawer.is-open {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
  }
  .peek-drawer.is-docked {
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: 260px;
    border-radius: 0;
    border-inline-start: none;
    border-block: none;
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
    box-shadow: 4px 0 24px rgb(0 0 0 / 0.3);
  }
  .csui-nav-row {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .csui-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 26px;
    block-size: 25px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #cbd5e1;
    cursor: pointer;
    font-size: 13px;
  }
  .csui-icon-btn:hover {
    background: rgb(255 255 255 / 0.12);
    color: #fff;
  }
  .csui-spacer {
    flex: 1;
  }
  .csui-omnibox-input {
    inline-size: 100%;
    block-size: 30px;
    padding-inline: 10px;
    border-radius: 8px;
    border: 1px solid rgb(255 255 255 / 0.14);
    background: rgb(255 255 255 / 0.09);
    color: #f8fafc;
    font-size: 12px;
    outline: none;
  }
  .csui-omnibox-input:focus {
    background: rgb(255 255 255 / 0.16);
    border-color: hsl(var(--arc-hue) 80% 70%);
  }
  /* Top Large-Icon Space Cards inside CSUI */
  .csui-spaces-top-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
  }
  .csui-space-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 6px 4px;
    border-radius: 9px;
    border: 1px solid rgb(255 255 255 / 0.1);
    background: rgb(255 255 255 / 0.06);
    color: #cbd5e1;
    cursor: pointer;
    text-align: center;
  }
  .csui-space-card:hover {
    background: rgb(255 255 255 / 0.14);
    color: #fff;
  }
  .csui-space-card.is-active {
    background: rgb(255 255 255 / 0.22);
    border-color: hsl(var(--arc-hue) 85% 72%);
    color: #fff;
    font-weight: 600;
  }
  .csui-space-emoji {
    font-size: 18px;
    line-height: 1;
  }
  .csui-space-label {
    font-size: 10.5px;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .peek-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .peek-tab-row {
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 7px;
    padding-inline-end: 4px;
  }
  .peek-tab-row:hover {
    background: rgb(255 255 255 / 0.1);
  }
  .peek-tab-row.is-active {
    background: rgb(255 255 255 / 0.18);
  }
  .peek-tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-inline-size: 0;
    padding: 6px 8px;
    border: none;
    background: transparent;
    color: #e2e8f0;
    font-size: 12px;
    text-align: start;
    cursor: pointer;
  }
  .peek-tab-row.is-active .peek-tab-btn {
    color: #fff;
    font-weight: 600;
  }
  .peek-close-btn {
    border: none;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 12px;
  }
  .peek-close-btn:hover {
    color: #fff;
    background: rgb(255 255 255 / 0.15);
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
    z-index: 2147483647;
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
    pointer-events: none;
    transition: transform 180ms ease, opacity 180ms ease;
    z-index: 2147483647;
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
`

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = OVERLAY_CSS
  return style
}

export default function ArcOverlayCSUI() {
  const [arcState, setArcState] = useState<ArcState>(DEFAULT_ARC_STATE)
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([])
  const [windowState, setWindowState] = useState<string>("normal")
  const [windowType, setWindowType] = useState<string>("normal")
  const [peekOpen, setPeekOpen] = useState(false)
  const [dockCollapsed, setDockCollapsed] = useState(false)
  const [omniboxText, setOmniboxText] = useState("")
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState("")
  const [cmdIndex, setCmdIndex] = useState(0)
  const [toast, setToast] = useState<{
    visible: boolean
    title: string
    subtitle: string
  }>({ visible: false, title: "", subtitle: "" })

  const cmdInputRef = useRef<HTMLInputElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((title: string, subtitle = "") => {
    setToast({ visible: true, title, subtitle })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }))
    }, 2200)
  }, [])

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: "GET_ARC_SNAPSHOT" })
      if (res?.ok) {
        setArcState(res.arcState)
        setTabs(res.tabs || [])
        setWindowState(res.windowState || "normal")
        setWindowType(res.windowType || "normal")
        const active = (res.tabs || []).find((t: chrome.tabs.Tab) => t.active)
        if (active?.url) {
          setOmniboxText(formatCleanDomain(active.url))
        }
      }
    } catch {
      // Extension context asleep
    }
  }, [])

  const shouldDockSidebar = Boolean(
    arcState.dockedSidebarMode ||
      windowType === "popup" ||
      windowState === "fullscreen"
  )
  const isDockedActive = Boolean(shouldDockSidebar && !dockCollapsed)

  // Shift page layout smoothly when Docked Chromeless Sidebar is active
  useEffect(() => {
    const htmlEl = document.documentElement
    if (isDockedActive) {
      htmlEl.style.transition = "margin-inline-start 180ms ease"
      htmlEl.style.marginInlineStart = "260px"
    } else {
      htmlEl.style.marginInlineStart = ""
    }
    return () => {
      htmlEl.style.marginInlineStart = ""
    }
  }, [isDockedActive])

  useEffect(() => {
    fetchSnapshot()

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes.arcState?.newValue) {
        setArcState(changes.arcState.newValue)
      }
    }

    const handleMessage = (
      message: any,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      ;(async () => {
        try {
          if (message?.type === "ARC_TOGGLE_COMMAND_BAR") {
            await fetchSnapshot()
            setCmdQuery("")
            setCmdIndex(0)
            setCmdOpen((prev) => {
              const next = !prev
              if (next) {
                setTimeout(() => cmdInputRef.current?.focus(), 20)
              }
              return next
            })
            sendResponse({ ok: true })
          } else if (message?.type === "ARC_SHOW_TOAST") {
            showToast(message.message, message.subtitle || "")
            sendResponse({ ok: true })
          } else if (message?.type === "ARC_COPY_TEXT") {
            if (message.text) {
              await navigator.clipboard.writeText(message.text)
            }
            showToast(
              message.message || "Copied Clean URL",
              message.subtitle || ""
            )
            sendResponse({ ok: true })
          }
        } catch (err) {
          sendResponse({ ok: false, error: String(err) })
        }
      })()
      return true
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [fetchSnapshot, showToast])

  const activeSpace =
    arcState.spaces.find((s) => s.id === arcState.activeSpaceId) ||
    arcState.spaces[0] ||
    DEFAULT_ARC_STATE.spaces[0]

  const cmdItems = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase()
    const list: {
      title: string
      meta: string
      run: () => Promise<void>
    }[] = []

    if (q) {
      const isUrl =
        /^(https?:\/\/|localhost|\w+\.\w{2,})/.test(q) && !q.includes(" ")
      if (isUrl) {
        const target = q.startsWith("http")
          ? cmdQuery.trim()
          : `https://${cmdQuery.trim()}`
        list.push({
          title: `Open URL: ${target}`,
          meta: "Navigate",
          run: async () => {
            await chrome.runtime.sendMessage({
              type: "CREATE_TAB",
              url: target
            })
          }
        })
      }
      list.push({
        title: `Search Google for "${cmdQuery.trim()}"`,
        meta: "Google Search",
        run: async () => {
          const url = `https://www.google.com/search?q=${encodeURIComponent(cmdQuery.trim())}`
          await chrome.runtime.sendMessage({ type: "CREATE_TAB", url })
        }
      })
    }

    for (const tab of tabs) {
      const title = tab.title || tab.url || "Tab"
      if (
        !q ||
        title.toLowerCase().includes(q) ||
        (tab.url && tab.url.toLowerCase().includes(q))
      ) {
        list.push({
          title,
          meta: tab.active ? "Current Tab" : "Switch to Tab",
          run: async () => {
            if (tab.id) {
              await chrome.runtime.sendMessage({
                type: "ACTIVATE_TAB",
                tabId: tab.id
              })
            }
          }
        })
      }
    }

    for (const sp of arcState.spaces) {
      if (!q || sp.name.toLowerCase().includes(q)) {
        list.push({
          title: `Switch Space to ${sp.icon} ${sp.name}`,
          meta: "Arc Space",
          run: async () => {
            await chrome.runtime.sendMessage({
              type: "SWITCH_SPACE",
              spaceId: sp.id
            })
            await fetchSnapshot()
            showToast(`Switched to ${sp.icon} ${sp.name}`)
          }
        })
      }
    }

    return list.slice(0, 14)
  }, [cmdQuery, tabs, arcState.spaces, fetchSnapshot, showToast])

  const clampedIndex = Math.min(cmdIndex, Math.max(0, cmdItems.length - 1))

  return (
    <div
      className="arc-csui-root"
      style={
        {
          "--arc-hue": activeSpace.theme?.hue ?? 256,
          "--arc-accent": activeSpace.theme?.accentHue ?? 318
        } as React.CSSProperties
      }>
      {(arcState.leftPeekEnabled !== false || shouldDockSidebar) &&
        !isDockedActive && (
          <div
            className="peek-edge-sensor"
            onMouseEnter={() => {
              if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
              hoverTimerRef.current = setTimeout(async () => {
                await fetchSnapshot()
                setPeekOpen(true)
              }, 140)
            }}
            onMouseLeave={() => {
              if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
            }}
          />
        )}

      <aside
        className={`peek-drawer ${peekOpen ? "is-open" : ""} ${isDockedActive ? "is-docked" : ""}`}
        onMouseLeave={() => {
          if (!isDockedActive) setPeekOpen(false)
        }}>
        {/* Top Browser Navigation Replacement Row */}
        <div className="csui-nav-row">
          <button
            type="button"
            className="csui-icon-btn"
            title="Back"
            onClick={async () => {
              await chrome.runtime.sendMessage({
                type: "BROWSER_NAV_ACTION",
                action: "back"
              })
            }}>
            ←
          </button>
          <button
            type="button"
            className="csui-icon-btn"
            title="Forward"
            onClick={async () => {
              await chrome.runtime.sendMessage({
                type: "BROWSER_NAV_ACTION",
                action: "forward"
              })
            }}>
            →
          </button>
          <button
            type="button"
            className="csui-icon-btn"
            title="Reload"
            onClick={async () => {
              await chrome.runtime.sendMessage({
                type: "BROWSER_NAV_ACTION",
                action: "reload"
              })
            }}>
            ↻
          </button>
          <div className="csui-spacer" />
          <button
            type="button"
            className="csui-icon-btn"
            title="Pin/Unpin Current Tab"
            onClick={async () => {
              await chrome.runtime.sendMessage({ type: "PIN_ACTIVE_TAB" })
              await fetchSnapshot()
            }}>
            📌
          </button>
          <button
            type="button"
            className="csui-icon-btn"
            title={
              windowType === "popup"
                ? "Restore Normal Chrome Window"
                : "Open Tabless Window (Hides Chrome Tab & URL Bar)"
            }
            onClick={async () => {
              await chrome.runtime.sendMessage({
                type: "TOGGLE_TABLESS_WINDOW"
              })
              await fetchSnapshot()
            }}>
            ❐
          </button>
          <button
            type="button"
            className="csui-icon-btn"
            title="Toggle Arc Chromeless Fullscreen"
            onClick={async () => {
              await chrome.runtime.sendMessage({
                type: "TOGGLE_CHROMELESS_MODE"
              })
              await fetchSnapshot()
            }}>
            ⛶
          </button>
          {shouldDockSidebar && (
            <button
              type="button"
              className="csui-icon-btn"
              title={
                dockCollapsed
                  ? "Pin Sidebar Open"
                  : "Collapse Sidebar to Left-Edge Peek"
              }
              onClick={() => {
                setDockCollapsed((prev) => !prev)
                setPeekOpen(false)
              }}>
              {dockCollapsed ? "»" : "«"}
            </button>
          )}
        </div>

        {/* Inline URL / Search Omnibox */}
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!omniboxText.trim()) return
            await chrome.runtime.sendMessage({
              type: "NAVIGATE_ACTIVE_TAB",
              input: omniboxText.trim(),
              newTab: false
            })
            await fetchSnapshot()
          }}>
          <input
            type="text"
            className="csui-omnibox-input"
            placeholder="Enter URL or search..."
            value={omniboxText}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setOmniboxText(e.target.value)}
          />
        </form>

        {/* Top Large-Icon Spaces Switcher (Personal, Work, Research) */}
        <div className="csui-spaces-top-grid">
          {arcState.spaces.map((sp) => (
            <button
              key={sp.id}
              type="button"
              className={`csui-space-card ${sp.id === activeSpace.id ? "is-active" : ""}`}
              onClick={async () => {
                await chrome.runtime.sendMessage({
                  type: "SWITCH_SPACE",
                  spaceId: sp.id
                })
                await fetchSnapshot()
              }}>
              <span className="csui-space-emoji">{sp.icon || "🌿"}</span>
              <span className="csui-space-label">{sp.name}</span>
            </button>
          ))}
        </div>

        <ul className="peek-list">
          {activeSpace.pinnedTabs?.length > 0 && (
            <>
              <li className="peek-section-label">
                {activeSpace.name} Pinned
              </li>
              {activeSpace.pinnedTabs.map((pin) => (
                <li key={pin.id} className="peek-tab-row">
                  <button
                    type="button"
                    className="peek-tab-btn"
                    onClick={async () => {
                      if (!isDockedActive) setPeekOpen(false)
                      await chrome.runtime.sendMessage({
                        type: "CREATE_TAB",
                        url: pin.url,
                        spaceId: activeSpace.id
                      })
                      await fetchSnapshot()
                    }}>
                    <span>📌</span>
                    <span className="peek-title">{pin.title || pin.url}</span>
                  </button>
                </li>
              ))}
            </>
          )}

          <li className="peek-section-label">Today Tabs ({tabs.length})</li>
          {tabs.map((tab) => (
            <li
              key={tab.id}
              className={`peek-tab-row ${tab.active ? "is-active" : ""}`}>
              <button
                type="button"
                className="peek-tab-btn"
                onClick={async () => {
                  if (!isDockedActive) setPeekOpen(false)
                  if (tab.id) {
                    await chrome.runtime.sendMessage({
                      type: "ACTIVATE_TAB",
                      tabId: tab.id
                    })
                    await fetchSnapshot()
                  }
                }}>
                <span>{tab.audible ? "🔊" : "•"}</span>
                <span className="peek-title">{tab.title || tab.url}</span>
              </button>
              {tab.id && (
                <button
                  type="button"
                  className="peek-close-btn"
                  title="Close tab"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (tab.id) {
                      await chrome.runtime.sendMessage({
                        type: "CLOSE_TAB",
                        tabId: tab.id
                      })
                      await fetchSnapshot()
                    }
                  }}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="peek-cmd-btn"
          onClick={async () => {
            if (!isDockedActive) setPeekOpen(false)
            await fetchSnapshot()
            setCmdQuery("")
            setCmdIndex(0)
            setCmdOpen(true)
            setTimeout(() => cmdInputRef.current?.focus(), 20)
          }}>
          <span>+ New Tab / Command Bar</span>
          <kbd style={{ fontSize: 10, opacity: 0.7 }}>⌘⇧K</kbd>
        </button>
      </aside>

      <div
        className={`cmd-backdrop ${cmdOpen ? "is-open" : ""}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setCmdOpen(false)
          }
        }}>
        <div className="cmd-box" role="dialog" aria-label="Arc Command Bar">
          <div className="cmd-input-row">
            <span>✨</span>
            <input
              ref={cmdInputRef}
              type="text"
              className="cmd-input"
              placeholder="Arc Command Bar — Search tabs, spaces, or type a URL..."
              autoComplete="off"
              value={cmdQuery}
              onChange={(e) => {
                setCmdQuery(e.target.value)
                setCmdIndex(0)
              }}
              onKeyDown={async (e) => {
                if (e.key === "Escape") {
                  e.preventDefault()
                  setCmdOpen(false)
                } else if (e.key === "ArrowDown") {
                  e.preventDefault()
                  if (cmdItems.length) {
                    setCmdIndex((prev) => (prev + 1) % cmdItems.length)
                  }
                } else if (e.key === "ArrowUp") {
                  e.preventDefault()
                  if (cmdItems.length) {
                    setCmdIndex(
                      (prev) => (prev - 1 + cmdItems.length) % cmdItems.length
                    )
                  }
                } else if (e.key === "Enter") {
                  e.preventDefault()
                  const chosen = cmdItems[clampedIndex]
                  if (chosen) {
                    setCmdOpen(false)
                    await chosen.run()
                  }
                }
              }}
            />
          </div>
          <ul className="cmd-results">
            {cmdItems.map((item, idx) => (
              <li key={`${item.title}-${idx}`}>
                <button
                  type="button"
                  className={`cmd-row-btn ${idx === clampedIndex ? "is-selected" : ""}`}
                  onClick={async () => {
                    setCmdOpen(false)
                    await item.run()
                  }}>
                  <span className="peek-title">{item.title}</span>
                  <span className="cmd-row-meta">{item.meta}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={`arc-toast ${toast.visible ? "is-visible" : ""}`}>
        <span className="arc-toast-title">✓ {toast.title}</span>
        {toast.subtitle && (
          <span className="arc-toast-sub">{toast.subtitle}</span>
        )}
      </div>
    </div>
  )
}
