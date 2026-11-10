import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DEFAULT_ARC_STATE } from "~lib/storage"
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
  :where(div, aside, button, input, ul, li, span, kbd) {
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
    z-index: 2147483646;
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
  const [peekOpen, setPeekOpen] = useState(false)
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
      }
    } catch {
      // Background asleep or extension reloaded
    }
  }, [])

  useEffect(() => {
    fetchSnapshot()

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

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
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
      {arcState.leftPeekEnabled !== false && (
        <div
          className="peek-edge-sensor"
          onMouseEnter={() => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
            hoverTimerRef.current = setTimeout(async () => {
              await fetchSnapshot()
              setPeekOpen(true)
            }, 170)
          }}
          onMouseLeave={() => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
          }}
        />
      )}

      <aside
        className={`peek-drawer ${peekOpen ? "is-open" : ""}`}
        onMouseLeave={() => setPeekOpen(false)}>
        <div className="peek-header">
          <span>
            {activeSpace.icon || "🌿"} {activeSpace.name}
          </span>
          <span style={{ fontSize: 10, opacity: 0.65 }}>Arc Peek</span>
        </div>

        <button
          type="button"
          className="peek-cmd-btn"
          onClick={async () => {
            setPeekOpen(false)
            await fetchSnapshot()
            setCmdQuery("")
            setCmdIndex(0)
            setCmdOpen(true)
            setTimeout(() => cmdInputRef.current?.focus(), 20)
          }}>
          <span>Search or enter URL...</span>
          <kbd style={{ fontSize: 10, opacity: 0.7 }}>⌘⇧K</kbd>
        </button>

        <ul className="peek-list">
          {activeSpace.pinnedTabs?.length > 0 && (
            <>
              <li className="peek-section-label">Pinned</li>
              {activeSpace.pinnedTabs.map((pin) => (
                <li key={pin.id}>
                  <button
                    type="button"
                    className="peek-tab-btn"
                    onClick={async () => {
                      setPeekOpen(false)
                      await chrome.runtime.sendMessage({
                        type: "CREATE_TAB",
                        url: pin.url,
                        spaceId: activeSpace.id
                      })
                    }}>
                    <span>📌</span>
                    <span className="peek-title">{pin.title || pin.url}</span>
                  </button>
                </li>
              ))}
            </>
          )}

          <li className="peek-section-label">Today Tabs</li>
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                className={`peek-tab-btn ${tab.active ? "is-active" : ""}`}
                onClick={async () => {
                  setPeekOpen(false)
                  if (tab.id) {
                    await chrome.runtime.sendMessage({
                      type: "ACTIVATE_TAB",
                      tabId: tab.id
                    })
                  }
                }}>
                <span>{tab.audible ? "🔊" : "•"}</span>
                <span className="peek-title">{tab.title || tab.url}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="peek-spaces-row">
          {arcState.spaces.map((sp) => (
            <button
              key={sp.id}
              type="button"
              className={`peek-space-pill ${sp.id === activeSpace.id ? "is-active" : ""}`}
              onClick={async () => {
                await chrome.runtime.sendMessage({
                  type: "SWITCH_SPACE",
                  spaceId: sp.id
                })
                await fetchSnapshot()
              }}>
              {sp.icon} {sp.name}
            </button>
          ))}
        </div>
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
