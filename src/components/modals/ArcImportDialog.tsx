import React, { useEffect, useRef, useState } from "react"
import {
  type ArcImportSummary,
  parseArcImportContent
} from "~lib/arc-importer"
import type { ArcSpace } from "~types/arc"

interface ArcImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onCopyPath: (path: string) => Promise<void>
  onConfirmImport: (data: {
    spaces: ArcSpace[]
    mode: "merge" | "replace"
  }) => Promise<void>
}

const MACOS_ARC_PATH = "~/Library/Application Support/Arc/StorableSidebar.json"

export function ArcImportDialog({
  isOpen,
  onClose,
  onCopyPath,
  onConfirmImport
}: ArcImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rawContent, setRawContent] = useState<string>("")
  const [fileName, setFileName] = useState<string>("")
  const [includeUnpinned, setIncludeUnpinned] = useState(false)
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge")
  const [summary, setSummary] = useState<ArcImportSummary | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      setRawContent("")
      setFileName("")
      setSummary(null)
      setErrorMsg(null)
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [isOpen])

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

  useEffect(() => {
    if (!rawContent) {
      setSummary(null)
      return
    }
    try {
      const parsed = parseArcImportContent(
        rawContent,
        fileName,
        includeUnpinned
      )
      if (parsed.totalSpaces === 0) {
        setErrorMsg(
          "No Spaces or Pinned Tabs found in this file. Make sure it is StorableSidebar.json, Arc Data Export.md, or a Bookmarks HTML file."
        )
        setSummary(null)
      } else {
        setErrorMsg(null)
        setSummary(parsed)
      }
    } catch (err: any) {
      setErrorMsg(
        `Could not parse file: ${err?.message || "Invalid file format"}`
      )
      setSummary(null)
    }
  }, [rawContent, fileName, includeUnpinned])

  const handleFileSelected = async (file?: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      setFileName(file.name)
      setRawContent(text)
    } catch (err: any) {
      setErrorMsg(`Failed to read file: ${err?.message || "Unknown error"}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!summary || summary.spaces.length === 0) return
    await onConfirmImport({
      spaces: summary.spaces,
      mode: importMode
    })
    dialogRef.current?.close()
  }

  const formatLabel =
    summary?.format === "storable-sidebar-json"
      ? "Arc StorableSidebar.json"
      : summary?.format === "arc-markdown"
        ? "Arc Data Export.md"
        : "Bookmarks HTML"

  return (
    <dialog
      ref={dialogRef}
      className="arc-modal tidy-modal"
      {...({ closedby: "any" } as any)}
      aria-labelledby="arc-import-dialog-title">
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-title-bar">
          <h2 id="arc-import-dialog-title">🌈 Import from Arc Browser</h2>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Close Arc Import"
            onClick={() => dialogRef.current?.close()}>
            ×
          </button>
        </div>

        <div className="arc-import-guide">
          <div className="import-guide-item">
            <div className="import-guide-header">
              <strong>1. Full Fidelity: StorableSidebar.json (Recommended)</strong>
              <button
                type="button"
                className="copy-path-btn"
                title="Copy macOS Arc Sidebar file path"
                onClick={() => onCopyPath(MACOS_ARC_PATH)}>
                📋 Copy macOS Path
              </button>
            </div>
            <p>
              Imports your exact Arc <strong>Spaces, Icons, Themes, Folders, and Pinned Tabs</strong>.
              Click <em>Choose File</em> below, press <kbd>⌘</kbd>+<kbd>⇧</kbd>+<kbd>G</kbd> in Finder, and paste{" "}
              <code>{MACOS_ARC_PATH}</code>.
            </p>
          </div>

          <div className="import-guide-item">
            <strong>2. Built-In Arc Export: Arc Data Export.md</strong>
            <p>
              In Arc Browser, go to <strong>Arc → Settings (⌘,) → Advanced → Export Data</strong> and select the exported{" "}
              <code>Arc Data Export.md</code> file (or any <code>bookmarks.html</code> export).
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.md,.markdown,.txt,.html,.htm"
          hidden
          onChange={(e) => handleFileSelected(e.target.files?.[0])}
        />

        <div
          className={`arc-dropzone ${isDraggingFile ? "is-drag-over" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDraggingFile(true)
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDraggingFile(false)
            handleFileSelected(e.dataTransfer.files?.[0])
          }}>
          <span className="dropzone-title">
            {fileName
              ? `📄 ${fileName}`
              : "📂 Click to Choose File or Drop Here"}
          </span>
          <span className="dropzone-sub">
            Supports <code>StorableSidebar.json</code>,{" "}
            <code>Arc Data Export.md</code>, or <code>bookmarks.html</code>
          </span>
        </div>

        <div className="tidy-config-controls">
          <label className="setting-row tidy-fallback-toggle">
            <span>Merge with existing Spaces (uncheck to replace all)</span>
            <input
              type="checkbox"
              checked={importMode === "merge"}
              onChange={(e) =>
                setImportMode(e.target.checked ? "merge" : "replace")
              }
            />
          </label>

          <label className="setting-row tidy-fallback-toggle">
            <span>Also import unpinned Today tabs (StorableSidebar.json)</span>
            <input
              type="checkbox"
              checked={includeUnpinned}
              onChange={(e) => setIncludeUnpinned(e.target.checked)}
            />
          </label>
        </div>

        {errorMsg && <div className="arc-import-error">{errorMsg}</div>}

        {summary && (
          <div className="arc-import-preview">
            <div className="import-preview-header">
              <span>✅ Detected {formatLabel}</span>
              <span>
                {summary.totalSpaces} Spaces • {summary.totalFolders} Folders •{" "}
                {summary.totalPinnedTabs} Tabs
              </span>
            </div>
            <ul className="import-preview-list">
              {summary.spaces.map((sp) => (
                <li key={sp.id} className="import-preview-row">
                  <span>
                    {sp.icon} <strong>{sp.name}</strong>
                  </span>
                  <span>
                    {sp.folders.length} folder{sp.folders.length === 1 ? "" : "s"},{" "}
                    {sp.pinnedTabs.length} pin{sp.pinnedTabs.length === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-footer-actions">
          <span className="field-hint">🔒 Processed 100% locally in Chrome</span>
          <div className="spacer" />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!summary || summary.totalSpaces === 0}>
            Import {summary ? `(${summary.totalSpaces} Spaces)` : ""}
          </button>
        </div>
      </form>
    </dialog>
  )
}
