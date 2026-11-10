import React, { useEffect, useRef, useState } from "react"
import type { ArcFolder } from "~types/arc"

interface FolderDialogProps {
  isOpen: boolean
  editingFolder: ArcFolder | null
  onClose: () => void
  onSaveFolder: (name: string, existingFolderId: string | null) => Promise<void>
}

export function FolderDialog({
  isOpen,
  editingFolder,
  onClose,
  onSaveFolder
}: FolderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [folderName, setFolderName] = useState("")

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      setFolderName(editingFolder?.name || "")
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [isOpen, editingFolder])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = folderName.trim()
    if (!clean) return
    await onSaveFolder(clean, editingFolder?.id || null)
    dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className="arc-modal"
      {...({ closedby: "any" } as any)}
      aria-labelledby="folder-dialog-title">
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-title-bar">
          <h2 id="folder-dialog-title">
            {editingFolder ? "Rename Folder" : "New Folder"}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Close Folder Dialog"
            onClick={() => dialogRef.current?.close()}>
            ×
          </button>
        </div>

        <div className="form-grid">
          <label className="form-field" htmlFor="folder-name-input">
            <span>Folder Name</span>
            <input
              id="folder-name-input"
              type="text"
              className="arc-input"
              placeholder="e.g. Design System, PRs, Reading"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              required
              autoFocus
            />
          </label>
        </div>

        <div className="modal-footer-actions">
          <div className="spacer" />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save Folder
          </button>
        </div>
      </form>
    </dialog>
  )
}
