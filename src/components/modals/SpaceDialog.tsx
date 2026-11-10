import React, { useEffect, useRef, useState } from "react"
import type { ArcSpace, ArcTheme } from "~types/arc"

interface SpaceDialogProps {
  isOpen: boolean
  isNew: boolean
  activeSpace: ArcSpace
  canDelete: boolean
  onClose: () => void
  onPreviewTheme: (theme: ArcTheme) => void
  onSaveSpace: (data: {
    isNew: boolean
    icon: string
    name: string
    hue: number
    accentHue: number
    domainRules: string[]
  }) => Promise<void>
  onDeleteSpace: () => Promise<void>
}

const THEME_PRESETS = [
  { label: "Aurora Purple", hue: 256, accent: 318, sat: 74 },
  { label: "Ocean Cyan", hue: 214, accent: 182, sat: 78 },
  { label: "Sunset Coral", hue: 24, accent: 342, sat: 82 },
  { label: "Forest Emerald", hue: 152, accent: 190, sat: 70 },
  { label: "Berry Rose", hue: 335, accent: 285, sat: 76 },
  { label: "Monochrome Slate", hue: 220, accent: 240, sat: 18 }
]

export function SpaceDialog({
  isOpen,
  isNew,
  activeSpace,
  canDelete,
  onClose,
  onPreviewTheme,
  onSaveSpace,
  onDeleteSpace
}: SpaceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [icon, setIcon] = useState("🌿")
  const [name, setName] = useState("")
  const [hue, setHue] = useState(256)
  const [accentHue, setAccentHue] = useState(318)
  const [domainsText, setDomainsText] = useState("")

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (isNew) {
        setIcon("🚀")
        setName("")
        setHue(188)
        setAccentHue(245)
        setDomainsText("")
      } else {
        setIcon(activeSpace.icon || "🌿")
        setName(activeSpace.name || "")
        setHue(activeSpace.theme?.hue ?? 256)
        setAccentHue(activeSpace.theme?.accentHue ?? 318)
        setDomainsText((activeSpace.domainRules || []).join(", "))
      }
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [isOpen, isNew, activeSpace])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      dialog.returnValue = ""
      onPreviewTheme(activeSpace.theme)
      onClose()
    }
    dialog.addEventListener("close", handleClose)
    return () => dialog.removeEventListener("close", handleClose)
  }, [activeSpace.theme, onClose, onPreviewTheme])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const domainRules = domainsText
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)

    await onSaveSpace({
      isNew,
      icon: icon.trim() || "🌿",
      name: name.trim() || "Space",
      hue,
      accentHue,
      domainRules
    })
    dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className="arc-modal"
      {...({ closedby: "any" } as any)}
      aria-labelledby="space-dialog-title">
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-title-bar">
          <h2 id="space-dialog-title">
            {isNew ? "Create New Space" : `Customize ${activeSpace.name}`}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Close Space Customization"
            onClick={() => dialogRef.current?.close()}>
            ×
          </button>
        </div>

        <div className="form-grid">
          <div className="form-row-split">
            <label className="form-field" htmlFor="space-icon-input">
              <span>Icon</span>
              <input
                id="space-icon-input"
                type="text"
                maxLength={4}
                className="arc-input icon-input"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                required
              />
            </label>
            <label className="form-field flex-1" htmlFor="space-name-input">
              <span>Space Name</span>
              <input
                id="space-name-input"
                type="text"
                maxLength={32}
                className="arc-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </label>
          </div>

          <div className="form-field">
            <span>Arc Atmospheric Theme Preset</span>
            <div className="theme-presets-row">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="theme-swatch"
                  style={
                    {
                      "--sw-h1": preset.hue,
                      "--sw-h2": preset.accent
                    } as React.CSSProperties
                  }
                  aria-label={preset.label}
                  title={preset.label}
                  onClick={() => {
                    setHue(preset.hue)
                    setAccentHue(preset.accent)
                    onPreviewTheme({
                      hue: preset.hue,
                      accentHue: preset.accent,
                      saturation: preset.sat,
                      style: "custom"
                    })
                  }}
                />
              ))}
            </div>
          </div>

          <label className="form-field" htmlFor="space-hue-slider">
            <span>
              Primary Tint Hue (<output>{hue}</output>°)
            </span>
            <input
              id="space-hue-slider"
              type="range"
              min={0}
              max={360}
              value={hue}
              onChange={(e) => {
                const next = Number(e.target.value)
                setHue(next)
                onPreviewTheme({
                  hue: next,
                  accentHue,
                  saturation: 74,
                  style: "custom"
                })
              }}
            />
          </label>

          <label className="form-field" htmlFor="space-accent-slider">
            <span>
              Secondary Mesh Hue (<output>{accentHue}</output>°)
            </span>
            <input
              id="space-accent-slider"
              type="range"
              min={0}
              max={360}
              value={accentHue}
              onChange={(e) => {
                const next = Number(e.target.value)
                setAccentHue(next)
                onPreviewTheme({
                  hue,
                  accentHue: next,
                  saturation: 74,
                  style: "custom"
                })
              }}
            />
          </label>

          <label className="form-field" htmlFor="space-domains-input">
            <span>Auto-Route Domains (comma-separated)</span>
            <input
              id="space-domains-input"
              type="text"
              className="arc-input"
              placeholder="e.g. github.com, linear.app, figma.com"
              value={domainsText}
              onChange={(e) => setDomainsText(e.target.value)}
            />
            <small className="field-hint">
              Tabs matching these domains automatically route to this Space.
            </small>
          </label>
        </div>

        <div className="modal-footer-actions">
          {!isNew && canDelete && (
            <button
              type="button"
              className="btn-danger"
              onClick={async () => {
                await onDeleteSpace()
                dialogRef.current?.close()
              }}>
              Delete Space
            </button>
          )}
          <div className="spacer" />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save Space
          </button>
        </div>
      </form>
    </dialog>
  )
}
