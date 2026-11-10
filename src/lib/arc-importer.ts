import type { ArcFolder, ArcPinnedTab, ArcSpace, ArcTheme } from "~types/arc"

export interface ArcImportSummary {
  format: "storable-sidebar-json" | "arc-markdown" | "bookmarks-html"
  spaces: ArcSpace[]
  totalSpaces: number
  totalFolders: number
  totalPinnedTabs: number
}

const SPACE_THEME_PALETTE: ArcTheme[] = [
  { hue: 256, accentHue: 318, saturation: 74, style: "aurora" },
  { hue: 214, accentHue: 182, saturation: 78, style: "ocean" },
  { hue: 24, accentHue: 342, saturation: 82, style: "sunset" },
  { hue: 152, accentHue: 190, saturation: 70, style: "forest" },
  { hue: 335, accentHue: 285, saturation: 76, style: "berry" },
  { hue: 46, accentHue: 18, saturation: 80, style: "amber" }
]

const SF_ICON_MAP: Record<string, string> = {
  leaf: "🌿",
  briefcase: "💼",
  bolt: "⚡",
  sparkles: "✨",
  star: "⭐",
  heart: "❤️",
  book: "📚",
  bookmark: "🔖",
  code: "💻",
  terminal: "⌨️",
  globe: "🌐",
  flame: "🔥",
  music: "🎧",
  gamecontroller: "🎮",
  cart: "🛒",
  paintbrush: "🎨",
  graduationcap: "🎓",
  airplane: "✈️",
  house: "🏠",
  person: "👤",
  folder: "📁",
  magnifyingglass: "🔭"
}

function pickThemeForSpace(index: number, rawColor?: any): ArcTheme {
  const fallback = SPACE_THEME_PALETTE[index % SPACE_THEME_PALETTE.length]
  if (!rawColor || typeof rawColor !== "object") {
    return { ...fallback }
  }
  // Try to extract RGB or hue if present in Arc's customInfo/windowTheme
  const r = typeof rawColor.red === "number" ? rawColor.red : null
  const g = typeof rawColor.green === "number" ? rawColor.green : null
  const b = typeof rawColor.blue === "number" ? rawColor.blue : null
  if (r !== null && g !== null && b !== null) {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = fallback.hue
    if (max !== min) {
      const d = max - min
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) * 60
          break
        case g:
          h = ((b - r) / d + 2) * 60
          break
        case b:
          h = ((r - g) / d + 4) * 60
          break
      }
    }
    const hue = Math.round((h + 360) % 360)
    return {
      hue,
      accentHue: (hue + 48) % 360,
      saturation: 76,
      style: "custom"
    }
  }
  return { ...fallback }
}

function extractSpaceIcon(rawSpace: any, index: number): string {
  const iconType = rawSpace?.customInfo?.iconType
  if (iconType && typeof iconType === "object") {
    if (typeof iconType.emoji_v2 === "string" && iconType.emoji_v2.trim()) {
      return iconType.emoji_v2.trim()
    }
    if (typeof iconType.emoji === "string" && iconType.emoji.trim()) {
      return iconType.emoji.trim()
    }
    if (typeof iconType.emoji === "number") {
      try {
        return String.fromCodePoint(iconType.emoji)
      } catch {
        // Ignore invalid codepoint
      }
    }
    if (typeof iconType.icon === "string") {
      const key = iconType.icon.toLowerCase().replace(/\..*$/, "")
      if (SF_ICON_MAP[key]) return SF_ICON_MAP[key]
    }
  }
  const title = (rawSpace?.title || "").trim()
  const leadingEmoji = title.match(/^(\p{Extended_Pictographic})/u)
  if (leadingEmoji?.[1]) {
    return leadingEmoji[1]
  }
  const defaultIcons = ["🌿", "⚡", "🔭", "🚀", "🎨", "📚", "💼"]
  return defaultIcons[index % defaultIcons.length]
}

function normalizeObjectArray(rawList: any): any[] {
  if (!Array.isArray(rawList)) return []
  // Swift Codable encodes non-string keyed Dictionaries as alternating [id, object, id, object]
  return rawList.filter(
    (entry) => entry && typeof entry === "object" && !Array.isArray(entry)
  )
}

/**
 * Parses Arc Browser's raw `StorableSidebar.json` file.
 */
function parseStorableSidebarJson(
  rawJson: any,
  includeUnpinned = false
): ArcSpace[] {
  const containers: any[] = Array.isArray(rawJson?.sidebar?.containers)
    ? rawJson.sidebar.containers
    : Array.isArray(rawJson?.containers)
      ? rawJson.containers
      : []

  const importedSpaces: ArcSpace[] = []
  const now = Date.now()

  for (const container of containers) {
    if (!container || typeof container !== "object") continue
    const rawSpaces = normalizeObjectArray(container.spaces)
    const rawItems = normalizeObjectArray(container.items)
    if (rawSpaces.length === 0 || rawItems.length === 0) continue

    const itemsById = new Map<string, any>()
    const childrenByParentId = new Map<string, any[]>()

    for (const item of rawItems) {
      if (typeof item.id === "string") {
        itemsById.set(item.id, item)
      }
      if (typeof item.parentID === "string") {
        const list = childrenByParentId.get(item.parentID) || []
        list.push(item)
        childrenByParentId.set(item.parentID, list)
      }
    }

    const getOrderedChildren = (parentId: string): any[] => {
      const parentItem = itemsById.get(parentId)
      const explicitIds: string[] = Array.isArray(parentItem?.childrenIds)
        ? parentItem.childrenIds
        : []
      const byParent = childrenByParentId.get(parentId) || []

      if (explicitIds.length === 0) {
        return byParent
      }
      const seen = new Set<string>()
      const ordered: any[] = []
      for (const cid of explicitIds) {
        const found = itemsById.get(cid)
        if (found) {
          ordered.push(found)
          seen.add(cid)
        }
      }
      for (const fallbackChild of byParent) {
        if (typeof fallbackChild.id === "string" && !seen.has(fallbackChild.id)) {
          ordered.push(fallbackChild)
        }
      }
      return ordered
    }

    rawSpaces.forEach((rawSp, spIdx) => {
      const rawTitle = (rawSp.title || `Space ${spIdx + 1}`).trim()
      const icon = extractSpaceIcon(rawSp, importedSpaces.length)
      const cleanName =
        rawTitle.replace(/^(\p{Extended_Pictographic})\s*/u, "").trim() ||
        rawTitle

      const rawColor =
        rawSp?.customInfo?.windowTheme?.primaryColorPalette?.midTone ||
        rawSp?.customInfo?.windowTheme?.background
      const theme = pickThemeForSpace(importedSpaces.length, rawColor)

      const folders: ArcFolder[] = []
      const pinnedTabs: ArcPinnedTab[] = []
      const seenUrls = new Set<string>()

      // Extract pinned (and optionally unpinned) container IDs from `containerIDs`
      const cIds: any[] = Array.isArray(rawSp.containerIDs)
        ? rawSp.containerIDs
        : Array.isArray(rawSp.newContainerIDs)
          ? rawSp.newContainerIDs
          : []

      const targetRootIds: string[] = []
      for (let i = 0; i < cIds.length; i++) {
        const token = cIds[i]
        const nextToken = cIds[i + 1]
        if (token === "pinned" && typeof nextToken === "string") {
          targetRootIds.push(nextToken)
        } else if (
          includeUnpinned &&
          token === "unpinned" &&
          typeof nextToken === "string"
        ) {
          targetRootIds.push(nextToken)
        }
      }

      // Fallback if containerIDs didn't use ["pinned", uuid] markers
      if (targetRootIds.length === 0) {
        for (const token of cIds) {
          if (
            typeof token === "string" &&
            token !== "pinned" &&
            token !== "unpinned" &&
            (itemsById.has(token) || childrenByParentId.has(token))
          ) {
            targetRootIds.push(token)
          }
        }
      }

      const traverseNode = (
        nodeId: string,
        currentFolderId: string | null,
        depth: number
      ) => {
        if (depth > 12) return
        const children = getOrderedChildren(nodeId)
        for (const child of children) {
          if (!child || typeof child !== "object") continue
          const tabData = child?.data?.tab
          const isFolder =
            Boolean(child?.data?.list) ||
            (!tabData &&
              ((Array.isArray(child.childrenIds) &&
                child.childrenIds.length > 0) ||
                childrenByParentId.has(child.id)))

          if (isFolder && typeof child.id === "string") {
            const folderName = (
              child.title ||
              child?.data?.list?.title ||
              "Folder"
            ).trim()
            const folderId = `folder-arc-${now}-${folders.length}-${Math.random().toString(36).slice(2, 6)}`
            folders.push({
              id: folderId,
              name: folderName,
              collapsed: false,
              color: "purple"
            })
            traverseNode(child.id, folderId, depth + 1)
          } else if (tabData && typeof tabData.savedURL === "string") {
            const url = tabData.savedURL.trim()
            if (!url || url.startsWith("arc://")) continue
            const normKey = `${currentFolderId || "root"}::${url.toLowerCase()}`
            if (seenUrls.has(normKey)) continue
            seenUrls.add(normKey)

            const title = (
              child.title ||
              tabData.savedTitle ||
              url
            ).trim()
            pinnedTabs.push({
              id: `pin-arc-${now}-${pinnedTabs.length}-${Math.random().toString(36).slice(2, 6)}`,
              title,
              url,
              favIconUrl: "",
              folderId: currentFolderId,
              linkedTabId: null
            })
          } else if (typeof child.id === "string") {
            // Traverse wrapper containers (e.g. splitView or itemContainer)
            traverseNode(child.id, currentFolderId, depth + 1)
          }
        }
      }

      for (const rootId of targetRootIds) {
        traverseNode(rootId, null, 0)
      }

      // Keep non-empty folders or all spaces
      const nonEmptyFolderIds = new Set(
        pinnedTabs.map((p) => p.folderId).filter(Boolean)
      )
      const cleanedFolders = folders.filter((f) => nonEmptyFolderIds.has(f.id))

      if (cleanName || pinnedTabs.length > 0) {
        importedSpaces.push({
          id: `space-arc-${now}-${importedSpaces.length}`,
          name: cleanName || `Space ${importedSpaces.length + 1}`,
          icon,
          theme,
          domainRules: [],
          folders: cleanedFolders,
          pinnedTabs
        })
      }
    })
  }

  return importedSpaces
}

/**
 * Parses Arc Browser's native Markdown export (`Arc Data Export.md`)
 */
function parseArcMarkdownExport(markdown: string): ArcSpace[] {
  const lines = markdown.split(/\r?\n/)
  const spaces: ArcSpace[] = []
  const now = Date.now()

  let currentSpace: ArcSpace | null = null
  let currentFolderId: string | null = null

  const ensureCurrentSpace = (rawHeading?: string): ArcSpace => {
    if (currentSpace && !rawHeading) return currentSpace
    const title = (rawHeading || "Imported Space").trim()
    const leadingEmoji = title.match(/^(\p{Extended_Pictographic})\s*/u)
    const icon =
      leadingEmoji?.[1] ||
      ["🌿", "⚡", "🔭", "🚀", "🎨", "📚"][spaces.length % 6]
    const cleanName =
      title.replace(/^(\p{Extended_Pictographic})\s*/u, "").trim() || title

    const newSpace: ArcSpace = {
      id: `space-md-${now}-${spaces.length}`,
      name: cleanName,
      icon,
      theme: pickThemeForSpace(spaces.length),
      domainRules: [],
      folders: [],
      pinnedTabs: []
    }
    spaces.push(newSpace)
    currentSpace = newSpace
    currentFolderId = null
    return newSpace
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Heading detection: # Space, ## Section/Folder, ### Folder
    const h1Match = line.match(/^#\s+(.+)$/)
    if (h1Match) {
      const h1Text = h1Match[1].trim()
      if (!/^arc\s+data\s+export$/i.test(h1Text)) {
        ensureCurrentSpace(h1Text)
      }
      continue
    }

    const h2Match = line.match(/^##\s+(.+)$/)
    if (h2Match) {
      const h2Text = h2Match[1].trim()
      if (/^(pinned(\s+tabs)?|favorites|top\s+tabs|today|unpinned)$/i.test(h2Text)) {
        currentFolderId = null
      } else if (!currentSpace) {
        ensureCurrentSpace(h2Text)
      } else {
        const sp = ensureCurrentSpace()
        const folderId = `folder-md-${now}-${sp.folders.length}`
        sp.folders.push({
          id: folderId,
          name: h2Text,
          collapsed: false,
          color: "purple"
        })
        currentFolderId = folderId
      }
      continue
    }

    const h3Match = line.match(/^#{3,6}\s+(.+)$/)
    if (h3Match) {
      const folderName = h3Match[1].trim()
      if (/^(pinned(\s+tabs)?|favorites|today|unpinned)$/i.test(folderName)) {
        currentFolderId = null
      } else {
        const sp = ensureCurrentSpace()
        const folderId = `folder-md-${now}-${sp.folders.length}`
        sp.folders.push({
          id: folderId,
          name: folderName,
          collapsed: false,
          color: "blue"
        })
        currentFolderId = folderId
      }
      continue
    }

    // Markdown link detection: - [Title](https://...)
    const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i)
    if (linkMatch) {
      const title = linkMatch[1].trim()
      const url = linkMatch[2].trim()
      const sp = ensureCurrentSpace()
      sp.pinnedTabs.push({
        id: `pin-md-${now}-${sp.pinnedTabs.length}-${Math.random().toString(36).slice(2, 6)}`,
        title: title || url,
        url,
        favIconUrl: "",
        folderId: currentFolderId,
        linkedTabId: null
      })
    }
  }

  return spaces.filter((s) => s.pinnedTabs.length > 0 || s.folders.length > 0)
}

/**
 * Parses Netscape Bookmarks HTML (`bookmarks.html` from `arc-export` or browsers)
 */
function parseBookmarksHtmlExport(htmlText: string): ArcSpace[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlText, "text/html")
  const now = Date.now()
  const spaces: ArcSpace[] = []

  const createSpaceFromTitle = (rawTitle: string): ArcSpace => {
    const clean = rawTitle.replace(/^(\p{Extended_Pictographic})\s*/u, "").trim()
    const leadingEmoji = rawTitle.match(/^(\p{Extended_Pictographic})/u)
    const icon =
      leadingEmoji?.[1] ||
      ["🌿", "⚡", "🔭", "🚀", "🎨", "📚"][spaces.length % 6]
    return {
      id: `space-html-${now}-${spaces.length}`,
      name: clean || rawTitle || `Space ${spaces.length + 1}`,
      icon,
      theme: pickThemeForSpace(spaces.length),
      domainRules: [],
      folders: [],
      pinnedTabs: []
    }
  }

  // Look for top-level H3 folders inside the root DL
  const rootDl = doc.querySelector("dl")
  if (!rootDl) return []

  const topDts = Array.from(rootDl.children).filter(
    (el) => el.tagName.toLowerCase() === "dt"
  )

  for (const dt of topDts) {
    const h3 = dt.querySelector(":scope > h3")
    const dl = dt.querySelector(":scope > dl")
    if (h3 && dl) {
      const spaceTitle = (h3.textContent || "Imported").trim()
      const space = createSpaceFromTitle(spaceTitle)

      const walkDl = (dlEl: Element, activeFolderId: string | null) => {
        for (const child of Array.from(dlEl.children)) {
          if (child.tagName.toLowerCase() !== "dt") continue
          const subH3 = child.querySelector(":scope > h3")
          const subDl = child.querySelector(":scope > dl")
          const anchor = child.querySelector(":scope > a")

          if (subH3 && subDl) {
            const folderName = (subH3.textContent || "Folder").trim()
            const folderId = `folder-html-${now}-${space.folders.length}`
            space.folders.push({
              id: folderId,
              name: folderName,
              collapsed: false,
              color: "blue"
            })
            walkDl(subDl, folderId)
          } else if (anchor) {
            const href = (anchor.getAttribute("href") || "").trim()
            if (href.startsWith("http://") || href.startsWith("https://")) {
              space.pinnedTabs.push({
                id: `pin-html-${now}-${space.pinnedTabs.length}-${Math.random().toString(36).slice(2, 6)}`,
                title: (anchor.textContent || href).trim(),
                url: href,
                favIconUrl: "",
                folderId: activeFolderId,
                linkedTabId: null
              })
            }
          }
        }
      }

      walkDl(dl, null)
      if (space.pinnedTabs.length > 0) {
        spaces.push(space)
      }
    }
  }

  // Fallback if all links were flat without H3 containers
  if (spaces.length === 0) {
    const allLinks = Array.from(doc.querySelectorAll("a[href]"))
    if (allLinks.length > 0) {
      const fallbackSpace = createSpaceFromTitle("Arc Imported")
      for (const a of allLinks) {
        const href = (a.getAttribute("href") || "").trim()
        if (href.startsWith("http://") || href.startsWith("https://")) {
          fallbackSpace.pinnedTabs.push({
            id: `pin-html-${now}-${fallbackSpace.pinnedTabs.length}`,
            title: (a.textContent || href).trim(),
            url: href,
            favIconUrl: "",
            folderId: null,
            linkedTabId: null
          })
        }
      }
      if (fallbackSpace.pinnedTabs.length > 0) {
        spaces.push(fallbackSpace)
      }
    }
  }

  return spaces
}

/**
 * Auto-detects and parses an Arc Browser export file (`StorableSidebar.json`, `Arc Data Export.md`, or `bookmarks.html`).
 */
export function parseArcImportContent(
  content: string,
  fileName = "",
  includeUnpinned = false
): ArcImportSummary {
  const trimmed = content.trim()
  const lowerName = fileName.toLowerCase()

  let format: ArcImportSummary["format"] = "arc-markdown"
  let spaces: ArcSpace[] = []

  if (lowerName.endsWith(".json") || trimmed.startsWith("{")) {
    format = "storable-sidebar-json"
    const parsed = JSON.parse(trimmed)
    spaces = parseStorableSidebarJson(parsed, includeUnpinned)
  } else if (
    lowerName.endsWith(".html") ||
    lowerName.endsWith(".htm") ||
    /<!doctype\s+netscape-bookmark-file/i.test(trimmed) ||
    /<dl>/i.test(trimmed)
  ) {
    format = "bookmarks-html"
    spaces = parseBookmarksHtmlExport(trimmed)
  } else {
    format = "arc-markdown"
    spaces = parseArcMarkdownExport(trimmed)
  }

  const totalSpaces = spaces.length
  const totalFolders = spaces.reduce((acc, s) => acc + s.folders.length, 0)
  const totalPinnedTabs = spaces.reduce(
    (acc, s) => acc + s.pinnedTabs.length,
    0
  )

  return {
    format,
    spaces,
    totalSpaces,
    totalFolders,
    totalPinnedTabs
  }
}
