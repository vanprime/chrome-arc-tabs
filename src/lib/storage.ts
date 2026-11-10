import type { ArcState } from "~types/arc"

export const DEFAULT_ARC_STATE: ArcState = {
  activeSpaceId: "space-personal",
  viewAllSpacesTabs: false,
  autoArchiveHours: 12,
  leftPeekEnabled: true,
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
    return {
      ...DEFAULT_ARC_STATE,
      ...data.arcState,
      spaces:
        Array.isArray(data.arcState.spaces) && data.arcState.spaces.length > 0
          ? data.arcState.spaces
          : DEFAULT_ARC_STATE.spaces,
      favorites: Array.isArray(data.arcState.favorites)
        ? data.arcState.favorites
        : DEFAULT_ARC_STATE.favorites,
      tabSpaceMap: data.arcState.tabSpaceMap || {},
      tabLastActive: data.arcState.tabLastActive || {},
      splitPairs: Array.isArray(data.arcState.splitPairs)
        ? data.arcState.splitPairs
        : [],
      archive: Array.isArray(data.arcState.archive) ? data.arcState.archive : []
    }
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
