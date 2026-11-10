import React, { useEffect, useRef, useState } from "react"
import { DEFAULT_TIDY_RULES } from "~lib/storage"
import type { ArcTidyRule } from "~types/arc"

interface TidyDialogProps {
  isOpen: boolean
  rules: ArcTidyRule[]
  fallbackByDomain: boolean
  onClose: () => void
  onSaveTidyConfig: (data: {
    rules: ArcTidyRule[]
    fallbackByDomain: boolean
  }) => Promise<void>
}

interface EditableRuleRow {
  id: string
  icon: string
  name: string
  keywordsText: string
}

export function TidyDialog({
  isOpen,
  rules,
  fallbackByDomain,
  onClose,
  onSaveTidyConfig
}: TidyDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [rows, setRows] = useState<EditableRuleRow[]>([])
  const [fallbackDomain, setFallbackDomain] = useState(true)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      const sourceRules =
        Array.isArray(rules) && rules.length > 0 ? rules : DEFAULT_TIDY_RULES
      setRows(
        sourceRules.map((r) => ({
          id: r.id,
          icon: r.icon || "✨",
          name: r.name || "",
          keywordsText: (r.keywords || []).join(", ")
        }))
      )
      setFallbackDomain(fallbackByDomain)
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [isOpen, rules, fallbackByDomain])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      dialog.returnValue = ""
      onClose()
    }
    dialog.addEventListener("close", handleClose)
    return () => dialog.removeEventListener("close", handleClose)
  }, [onClose])

  const handleAddRule = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `tidy-${Date.now()}-${prev.length}`,
        icon: "🗂️",
        name: "New Category",
        keywordsText: ""
      }
    ])
  }

  const handleRemoveRule = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleUpdateRow = (
    id: string,
    field: keyof EditableRuleRow,
    value: string
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  const handleResetDefaults = () => {
    setRows(
      DEFAULT_TIDY_RULES.map((r) => ({
        id: r.id,
        icon: r.icon,
        name: r.name,
        keywordsText: r.keywords.join(", ")
      }))
    )
    setFallbackDomain(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextRules: ArcTidyRule[] = rows
      .map((r) => ({
        id: r.id,
        icon: r.icon.trim() || "✨",
        name: r.name.trim() || "Category",
        keywords: r.keywordsText
          .split(",")
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
      }))
      .filter((r) => r.name.length > 0)

    await onSaveTidyConfig({
      rules:
        nextRules.length > 0 ? nextRules : structuredClone(DEFAULT_TIDY_RULES),
      fallbackByDomain: fallbackDomain
    })
    dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className="arc-modal tidy-modal"
      {...({ closedby: "any" } as any)}
      aria-labelledby="tidy-dialog-title">
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-title-bar">
          <h2 id="tidy-dialog-title">✨ Configure Tidy Rules</h2>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Close Tidy Configuration"
            onClick={() => dialogRef.current?.close()}>
            ×
          </button>
        </div>

        <p className="tidy-privacy-note">
          🔒 <strong>100% Local &amp; Private:</strong> Tidy rules run entirely
          inside your browser and persist in local Chrome storage. Zero data
          ever leaves Chrome.
        </p>

        <div className="tidy-rules-scroll">
          {rows.map((row, idx) => (
            <div key={row.id} className="tidy-rule-card">
              <div className="tidy-rule-top">
                <input
                  type="text"
                  maxLength={4}
                  className="arc-input tidy-icon-input"
                  aria-label={`Category ${idx + 1} Icon`}
                  title="Category Emoji / Icon"
                  value={row.icon}
                  onChange={(e) =>
                    handleUpdateRow(row.id, "icon", e.target.value)
                  }
                  required
                />
                <input
                  type="text"
                  maxLength={36}
                  className="arc-input flex-1"
                  aria-label={`Category ${idx + 1} Name`}
                  placeholder="Category Name (e.g. Engineering)"
                  value={row.name}
                  onChange={(e) =>
                    handleUpdateRow(row.id, "name", e.target.value)
                  }
                  required
                />
                <button
                  type="button"
                  className="tidy-delete-rule-btn"
                  title="Remove this category rule"
                  aria-label={`Remove ${row.name || "category"}`}
                  onClick={() => handleRemoveRule(row.id)}>
                  ×
                </button>
              </div>
              <input
                type="text"
                className="arc-input tidy-keywords-input"
                aria-label={`Keywords for ${row.name || `Category ${idx + 1}`}`}
                placeholder="Domains or title keywords (comma-separated, e.g. github, localhost, linear)"
                value={row.keywordsText}
                onChange={(e) =>
                  handleUpdateRow(row.id, "keywordsText", e.target.value)
                }
              />
            </div>
          ))}
        </div>

        <div className="tidy-config-controls">
          <button
            type="button"
            className="btn-secondary tidy-add-rule-btn"
            onClick={handleAddRule}>
            + Add Category Rule
          </button>

          <label className="setting-row tidy-fallback-toggle">
            <span>Group unmatched tabs by domain (e.g. 🌐 example.com)</span>
            <input
              type="checkbox"
              checked={fallbackDomain}
              onChange={(e) => setFallbackDomain(e.target.checked)}
            />
          </label>
        </div>

        <div className="modal-footer-actions">
          <button
            type="button"
            className="btn-text-subtle"
            onClick={handleResetDefaults}
            title="Restore the default 4 Tidy categories">
            Reset Defaults
          </button>
          <div className="spacer" />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save Tidy Rules
          </button>
        </div>
      </form>
    </dialog>
  )
}
