import type { ArcState } from "~types/arc"

export const CURRENT_STATE_VERSION = 3

export const DEFAULT_ARC_STATE: ArcState = {
  stateVersion: CURRENT_STATE_VERSION,
  activeSpaceId: "space-personal",
  viewAllSpacesTabs: false,
  autoArchiveHours: 12,
  leftPeekEnabled: true,
  dockedSidebarMode: false,
  collapseNativeTabs: true,
  showFavoritesGrid: false,
  favorites: [
    {
      id: "fav-github",
      title: "GitHub",
      url: "https://github.com",
      favIconUrl: ""
    },
    {
      id: "fav-google",
      title: "Google Search",
      url: "https://www.google.com",
      favIconUrl: ""
    },
    {
      id: "fav-youtube",
      title: "YouTube",
      url: "https://www.youtube.com",
      favIconUrl: ""
    },
    {
      id: "fav-hn",
      title: "Hacker News",
      url: "https://news.ycombinator.com",
      favIconUrl: ""
    }
  ],
  spaces: [
    {
      id: "space-personal",
      name: "Personal",
      icon: "🌿",
      theme: {
        hue: 256,
        accentHue: 318,
        saturation: 74,
        style: "aurora"
      },
      domainRules: [],
      folders: [
        {
          id: "folder-reading",
          name: "Reading List",
          collapsed: false,
          color: "purple"
        }
      ],
      pinnedTabs: [
        {
          id: "pin-wiki",
          title: "Wikipedia",
          url: "https://www.wikipedia.org",
          favIconUrl: "",
          folderId: "folder-reading",
          linkedTabId: null
        },
        {
          id: "pin-mdn",
          title: "MDN Web Docs",
          url: "https://developer.mozilla.org",
          favIconUrl: "",
          folderId: null,
          linkedTabId: null
        }
      ]
    },
    {
      id: "space-work",
      name: "Work",
      icon: "⚡",
      theme: {
        hue: 214,
        accentHue: 182,
        saturation: 78,
        style: "ocean"
      },
      domainRules: [
        "github.com",
        "linear.app",
        "figma.com",
        "notion.so",
        "slack.com"
      ],
      folders: [
        {
          id: "folder-dev",
          name: "Engineering",
          collapsed: false,
          color: "blue"
        }
      ],
      pinnedTabs: [
        {
          id: "pin-chrome-ext",
          title: "Chrome Extensions Docs",
          url: "https://developer.chrome.com/docs/extensions",
          favIconUrl: "",
          folderId: "folder-dev",
          linkedTabId: null
        }
      ]
    },
    {
      id: "space-research",
      name: "Research",
      icon: "🔭",
      theme: {
        hue: 24,
        accentHue: 342,
        saturation: 82,
        style: "sunset"
      },
      domainRules: ["arxiv.org", "scholar.google.com", "news.ycombinator.com"],
      folders: [],
      pinnedTabs: []
    }
  ],
  tabSpaceMap: {},
  tabLastActive: {},
  splitPairs: [],
  archive: []
}

export async function getArcState(): Promise<ArcState> {
  try {
    const data = await chrome.storage.local.get("arcState")
    if (!data.arcState) {
      await chrome.storage.local.set({ arcState: DEFAULT_ARC_STATE })
      return structuredClone(DEFAULT_ARC_STATE)
    }

    const raw = data.arcState as Partial<ArcState>
    const needsMigration = (raw.stateVersion ?? 1) < CURRENT_STATE_VERSION

    const rawSpaces =
      Array.isArray(raw.spaces) && raw.spaces.length > 0
        ? structuredClone(raw.spaces)
        : structuredClone(DEFAULT_ARC_STATE.spaces)

    // Clean up any accidental Space-named folders (e.g. "⚡ Work", "🔭 Research")
    // that were previously imported inside Personal by the legacy group-folder sync
    if (needsMigration) {
      const spaceNameSet = new Set<string>(["arc"])
      for (const sp of rawSpaces) {
        const cleanName = (sp.name || "").trim().toLowerCase()
        const withIcon = `${sp.icon || ""} ${sp.name || ""}`
          .trim()
          .toLowerCase()
        if (cleanName) spaceNameSet.add(cleanName)
        if (withIcon) spaceNameSet.add(withIcon)
      }

      for (const sp of rawSpaces) {
        const removedFolderIds = new Set<string>()
        sp.folders = (sp.folders || []).filter((f) => {
          const fName = (f.name || "").trim().toLowerCase()
          const fStripped = fName
            .replace(/^(\p{Extended_Pictographic})\s*/u, "")
            .trim()
          const isAccidentalSpaceFolder =
            spaceNameSet.has(fName) ||
            spaceNameSet.has(fStripped) ||
            /^group\s+\d+$/i.test(fName)
          if (isAccidentalSpaceFolder) {
            removedFolderIds.add(f.id)
            return false
          }
          return true
        })

        // Remove pins that were inside accidental folders and deduplicate remaining pins by URL
        const seenUrls = new Set<string>()
        sp.pinnedTabs = (sp.pinnedTabs || []).filter((p) => {
          if (p.folderId && removedFolderIds.has(p.folderId)) {
            return false
          }
          const key = (p.url || "").trim().toLowerCase()
          if (!key || seenUrls.has(key)) {
            return false
          }
          seenUrls.add(key)
          return true
        })
      }
    }

    const merged: ArcState = {
      ...DEFAULT_ARC_STATE,
      ...raw,
      stateVersion: CURRENT_STATE_VERSION,
      collapseNativeTabs: raw.collapseNativeTabs ?? true,
      showFavoritesGrid: needsMigration
        ? false
        : (raw.showFavoritesGrid ?? false),
      spaces: rawSpaces,
      favorites: Array.isArray(raw.favorites)
        ? raw.favorites
        : DEFAULT_ARC_STATE.favorites,
      tabSpaceMap: raw.tabSpaceMap || {},
      tabLastActive: raw.tabLastActive || {},
      splitPairs: Array.isArray(raw.splitPairs) ? raw.splitPairs : [],
      archive: Array.isArray(raw.archive) ? raw.archive : []
    }

    if (needsMigration) {
      await chrome.storage.local.set({ arcState: merged })
    }

    return merged
  } catch (err) {
    console.error("Error reading arcState:", err)
    return structuredClone(DEFAULT_ARC_STATE)
  }
}

export async function saveArcState(arcState: ArcState): Promise<void> {
  try {
    await chrome.storage.local.set({ arcState })
  } catch (err) {
    console.error("Error saving arcState:", err)
  }
}
