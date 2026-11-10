export interface ArcTheme {
  hue: number
  accentHue: number
  saturation: number
  style: string
}

export interface ArcFavorite {
  id: string
  title: string
  url: string
  favIconUrl: string
}

export interface ArcFolder {
  id: string
  name: string
  collapsed: boolean
  color: string
}

export interface ArcPinnedTab {
  id: string
  title: string
  url: string
  favIconUrl: string
  folderId: string | null
  linkedTabId: number | null
}

export interface ArcSpace {
  id: string
  name: string
  icon: string
  theme: ArcTheme
  domainRules: string[]
  folders: ArcFolder[]
  pinnedTabs: ArcPinnedTab[]
  chromeGroupId?: number | null
}

export interface ArcSplitPair {
  id: string
  leftTabId: number
  rightTabId: number
  spaceId: string
}

export interface ArcArchiveEntry {
  id: string
  title: string
  url: string
  favIconUrl: string
  spaceId: string
  archivedAt: number
  reason: string
}

export interface ArcTidyRule {
  id: string
  name: string
  icon: string
  keywords: string[]
}

export interface ArcState {
  stateVersion: number
  activeSpaceId: string
  viewAllSpacesTabs: boolean
  autoArchiveHours: number
  leftPeekEnabled: boolean
  dockedSidebarMode: boolean
  collapseNativeTabs: boolean
  showFavoritesGrid: boolean
  tidyGroupedMode?: boolean
  tidyFallbackByDomain?: boolean
  tidyRules?: ArcTidyRule[]
  favorites: ArcFavorite[]
  spaces: ArcSpace[]
  tabSpaceMap: Record<number, string>
  tabLastActive: Record<number, number>
  splitPairs: ArcSplitPair[]
  archive: ArcArchiveEntry[]
}

export interface DragPayload {
  kind: "favorite" | "pinned" | "today-tab"
  id?: string
  pinId?: string
  tabId?: number
  index?: number
  title?: string
  url?: string
  favIconUrl?: string
}

export interface ContextMenuItem {
  label: string
  danger?: boolean
  action: () => void | Promise<void>
}

export interface CommandSuggestion {
  title: string
  subtitle: string
  badge: string
  iconUrl: string
  run: () => void | Promise<void>
}
