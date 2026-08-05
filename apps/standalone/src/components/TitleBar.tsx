import { Clock, Minus, X, Film, Settings, DownloadCloud, RefreshCw, Sparkles } from 'lucide-react';

interface TitleBarProps {
  appVersion: string;
  activeView: 'download' | 'history';
  showSettings: boolean;
  updateState: { ready: boolean; downloading: boolean; percent: number };
  onGoDownload: () => void;
  onToggleHistory: () => void;
  onOpenSettings: () => void;
  onOpenUpdates: () => void;
}

export function TitleBar({
  appVersion,
  activeView,
  showSettings,
  updateState,
  onGoDownload,
  onToggleHistory,
  onOpenSettings,
  onOpenUpdates,
}: TitleBarProps) {
  const historyActive = activeView === 'history' && !showSettings;

  return (
    <div className="drag-region flex h-10 shrink-0 items-center justify-between pl-3 pr-2 select-none">
      {/* Brand */}
      <button
        onClick={onGoDownload}
        className="no-drag group flex items-center gap-2 rounded-md py-1 pr-1.5 transition-opacity hover:opacity-90"
      >
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-gradient-to-br from-accent to-accentHover shadow-glow-sm">
          <Film className="h-3.5 w-3.5 text-black" strokeWidth={2.4} />
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-primaryText">FrameVault</span>
        {appVersion && (
          <span className="rounded-full border border-border bg-white/[0.03] px-1.5 py-[1px] text-[9px] font-medium text-secondaryText">
            v{appVersion}
          </span>
        )}
      </button>

      {/* Controls */}
      <div className="no-drag flex items-center gap-0.5">
        <button
          onClick={onToggleHistory}
          title="History"
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            historyActive
              ? 'bg-accent/12 text-accent'
              : 'text-secondaryText hover:bg-white/[0.06] hover:text-primaryText'
          }`}
        >
          <Clock className="h-[17px] w-[17px]" strokeWidth={1.8} />
        </button>
        
        <button
          onClick={onOpenUpdates}
          title="Updates"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-secondaryText transition-colors hover:bg-white/[0.06] hover:text-primaryText"
        >
          {updateState.ready ? (
            <>
              <Sparkles className="h-[17px] w-[17px] text-success animate-pulse" strokeWidth={2} />
              <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-success" />
            </>
          ) : updateState.downloading ? (
            <RefreshCw className="h-[16px] w-[16px] text-accent animate-spin" strokeWidth={2} />
          ) : (
            <DownloadCloud className="h-[17px] w-[17px]" strokeWidth={1.8} />
          )}
        </button>


        <div className="mx-1 h-4 w-px bg-border" />

        <button
          onClick={() => (window as any).electronAPI.windowMinimize?.()}
          title="Minimize"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-secondaryText transition-colors hover:bg-white/[0.06] hover:text-primaryText"
        >
          <Minus className="h-[17px] w-[17px]" strokeWidth={2} />
        </button>
        <button
          onClick={() => (window as any).electronAPI.windowClose?.()}
          title="Close"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-secondaryText transition-colors hover:bg-error hover:text-white"
        >
          <X className="h-[17px] w-[17px]" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
