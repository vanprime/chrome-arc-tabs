import type { ArcState, ArcTidyRule } from "~types/arc"

export const CURRENT_STATE_VERSION = 4

export const DEFAULT_TIDY_RULES: ArcTidyRule[] = [
  {
    id: "tidy-dev",
    name: "Engineering & Dev",
    icon: "⚡",
    keywords: [
      "github",
      "gitlab",
      "stackoverflow",
      "localhost",
      "vercel",
      "netlify",
      "linear",
      "jira"
    ]
  },
  {
    id: "tidy-docs",
    name: "Docs & Knowledge",
    icon: "📚",
    keywords: [
      "docs",
      "wikipedia",
      "arxiv",
      "developer",
      "mdn",
      "notion",
      "medium",
      "substack"
    ]
  },
  {
    id: "tidy-media",
    name: "Media & Video",
    icon: "🎧",
    keywords: ["youtube", "spotify", "netflix", "twitch", "soundcloud", "vimeo"]
  },
  {
    id: "tidy-social",
    name: "Social & Comms",
    icon: "💬",
    keywords: [
      "mail",
      "slack",
      "discord",
      "x.com",
      "twitter",
      "reddit",
      "linkedin",
      "news.ycombinator"
    ]
  }
]

export const DEFAULT_ARC_STATE: ArcState = {
  stateVersion: CURRENT_STATE_VERSION,
  activeSpaceId: "space-personal",
  viewAllSpacesTabs: false,
  autoArchiveHours: 12,
  leftPeekEnabled: true,
  dockedSidebarMode: false,
  collapseNativeTabs: true,
  showFavoritesGrid: false,
  tidyGroupedMode: false,
  tidyFallbackByDomain: true,
  tidyRules: DEFAULT_TIDY_RULES,
  favorites: [],
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
      folders: [],
      pinnedTabs: []
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
      folders: [],
      pinnedTabs: []
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

      const demoFolderIds = new Set(["folder-reading", "folder-dev"])
      const demoPinIds = new Set(["pin-wiki", "pin-mdn", "pin-chrome-ext"])

      for (const sp of rawSpaces) {
        const removedFolderIds = new Set<string>(demoFolderIds)
        sp.folders = (sp.folders || []).filter((f) => {
          if (demoFolderIds.has(f.id)) {
            return false
          }
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

        // Remove demo pins, pins inside accidental folders, mass-imported group pins, and chrome://extensions
        const seenUrls = new Set<string>()
        sp.pinnedTabs = (sp.pinnedTabs || []).filter((p) => {
          if (demoPinIds.has(p.id) || /^pin-\d+-\d+$/.test(p.id)) {
            return false
          }
          if (p.folderId && removedFolderIds.has(p.folderId)) {
            return false
          }
          const key = (p.url || "").trim().toLowerCase()
          if (
            !key ||
            key.startsWith("chrome://extensions") ||
            seenUrls.has(key)
          ) {
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
      tidyGroupedMode: raw.tidyGroupedMode ?? false,
      tidyFallbackByDomain: raw.tidyFallbackByDomain ?? true,
      tidyRules:
        Array.isArray(raw.tidyRules) && raw.tidyRules.length > 0
          ? raw.tidyRules
          : structuredClone(DEFAULT_TIDY_RULES),
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
