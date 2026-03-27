interface AppHeaderProps {
  showUpdateIndicator: boolean;
  availableVersion?: string;
  onOpenSettings: () => void;
  onOpenUpdates: () => void;
}

export function AppHeader({
  showUpdateIndicator,
  availableVersion,
  onOpenSettings,
  onOpenUpdates,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-background font-headline text-sm font-medium tracking-tight">
      <div data-tauri-drag-region className="h-8 w-full" />
      <div className="flex h-14 items-center px-8">
        <div
          data-tauri-drag-region
          className="flex h-full min-w-0 flex-1 items-center text-base font-bold tracking-tight text-on-surface"
        >
          <span>SSH Tunnel Manager</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center bg-surface-container-low rounded-full px-4 py-1.5 focus-within:ring-2 ring-primary/30 transition-all">
            <span className="material-symbols-outlined text-on-surface-variant text-lg mr-2">search</span>
            <input className="bg-transparent border-none text-xs focus:ring-0 text-on-surface placeholder:text-on-surface-variant w-48 outline-none" placeholder="Quick find..." type="text"/>
          </div>
          <div className="flex items-center gap-2">
            {showUpdateIndicator && (
              <button
                onClick={onOpenUpdates}
                className="relative text-primary hover:text-primary-dim transition-colors"
                title={`Update ${availableVersion} available`}
              >
                <span className="material-symbols-outlined">arrow_upward</span>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary status-pulse" />
              </button>
            )}
            <button
              onClick={onOpenSettings}
              className="text-on-surface-variant hover:text-on-surface transition-colors"
              title="Settings (Command+,)"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

interface MobileNavigationProps {
  showUpdateIndicator: boolean;
  onOpenSettings: () => void;
}

export function MobileNavigation({ showUpdateIndicator, onOpenSettings }: MobileNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-low flex justify-around items-center py-3 md:hidden z-50 border-t border-outline-variant/40">
      <button className="flex flex-col items-center text-primary">
        <span className="material-symbols-outlined">lan</span>
        <span className="text-[10px] mt-1">Tunnels</span>
      </button>
      <button onClick={onOpenSettings} className="flex flex-col items-center text-on-surface-variant">
        <span className="relative material-symbols-outlined">
          settings
          {showUpdateIndicator && (
            <span className="absolute -top-1 -right-2 material-symbols-outlined text-[14px] text-primary">arrow_upward</span>
          )}
        </span>
        <span className="text-[10px] mt-1">Settings</span>
      </button>
    </nav>
  );
}
