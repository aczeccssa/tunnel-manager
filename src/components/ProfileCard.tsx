import { useState } from "react";
import type { TunnelProfile, RuntimeStatus } from "../types";

interface ProfileCardProps {
  profile: TunnelProfile;
  status: RuntimeStatus;
  errorMessage?: string;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCopyConfig: () => void;
  onDelete: () => void;
  onViewLogs: () => void;
  viewMode?: "list" | "grid";
}

export function ProfileCard({
  profile,
  status,
  errorMessage,
  onStart,
  onStop,
  onEdit,
  onDuplicate,
  onCopyConfig,
  onDelete,
  onViewLogs,
  viewMode = "list",
}: ProfileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isRunning = status === "RUNNING";
  const isStopping = status === "STOPPING";
  const isConnecting = status === "CONNECTING";
  const isError = status === "ERROR";

  const isGrid = viewMode === "grid";

  const getCommandString = () => {
    switch (profile.mode) {
      case "LOCAL":
        return `ssh -L ${profile.localPort}:${profile.remoteHost || "localhost"}:${profile.remotePort}`;
      case "REMOTE":
        return `ssh -R ${profile.remotePort}:${profile.localTargetHost || "localhost"}:${profile.localTargetPort}`;
      case "DYNAMIC":
        return `ssh -D ${profile.localPort}`;
      default:
        return "ssh";
    }
  };

  const getTargetHost = () => {
    return profile.sshHost || "unknown-host";
  };

  const getIconForMode = () => {
    if (profile.mode === "LOCAL") return "database";
    if (profile.mode === "REMOTE") return "terminal";
    return "cloud_queue";
  };

  const getModeTagColor = () => {
    if (isRunning || isConnecting) {
      return "bg-primary/10 text-primary";
    }
    return "bg-surface-variant text-on-surface-variant";
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning || isConnecting || isStopping) {
      if (!isStopping) onStop();
    } else {
      onStart();
    }
  };

  return (
    <div className={`bg-surface-container-low hover:bg-surface-container transition-all group rounded-xl p-5 flex ${isGrid ? "flex-col items-start gap-4" : "items-center justify-between"}`}>
      <div className={`flex items-center gap-5 ${isGrid ? "w-full" : ""}`}>
        <div className="relative flex-shrink-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isRunning || isConnecting ? "bg-surface-container-highest text-primary" : "bg-surface-container-highest text-on-surface-variant"}`}>
            <span className="material-symbols-outlined">{getIconForMode()}</span>
          </div>
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-surface-container-low ${
            isRunning 
              ? "bg-primary status-pulse" 
              : isConnecting
                ? "bg-warning animate-pulse"
                : isError
                  ? "bg-error"
                  : "bg-on-surface-variant"
          }`}></div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-headline font-bold text-on-surface truncate">{profile.name}</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter flex-shrink-0 ${getModeTagColor()}`}>
              {profile.mode}
            </span>
          </div>
          <div className={`text-on-surface-variant text-sm flex items-center gap-1.5 flex-wrap ${isGrid ? "max-w-full" : "max-w-[300px] sm:max-w-md md:max-w-lg"}`}>
            <span className="font-mono text-xs opacity-60 truncate">{getCommandString()}</span>
            {!isGrid && (
              <>
                <span className="text-outline-variant text-[10px]">•</span>
                <span className="truncate">{getTargetHost()}</span>
              </>
            )}
          </div>
          {isGrid && (
            <div className="text-on-surface-variant text-xs mt-1 truncate opacity-80">
              {getTargetHost()}
            </div>
          )}
          {isError && errorMessage && (
            <div className={`text-error text-xs mt-1 truncate ${isGrid ? "w-full" : "max-w-[300px] sm:max-w-md"}`}>
              {errorMessage}
            </div>
          )}
        </div>
      </div>
      
      <div className={`flex items-center ${isGrid ? "w-full justify-between mt-2 pt-4 border-t border-outline-variant/40" : "gap-8"}`}>
        {!isGrid && (
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[11px] font-label text-on-surface-variant uppercase tracking-wider">Latency</span>
            <span className={`${isRunning ? "text-on-surface" : "text-on-surface-variant"} font-mono font-medium`}>
              {isRunning ? "N/A" : "—"}
            </span>
          </div>
        )}
        
        <div className={`flex items-center gap-4 ${isGrid ? "w-full justify-between" : ""}`}>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleToggle}
              disabled={isStopping || isConnecting}
              className={`w-12 h-6 rounded-full relative flex items-center px-1 transition-colors ${
                isRunning ? "bg-primary cursor-pointer" : isConnecting || isStopping ? "bg-surface-variant cursor-wait opacity-70" : "bg-surface-container-highest cursor-pointer"
              }`}
            >
              <div className={`w-4 h-4 rounded-full transition-transform ${
                isRunning ? "bg-on-primary translate-x-6" : "bg-on-surface-variant"
              }`}></div>
            </button>
            {isGrid && (
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isRunning ? "text-primary" : "text-on-surface-variant"}`}>
                {status}
              </span>
            )}
          </div>

          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined">more_vert</span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                <div className="absolute right-0 bottom-0 z-20 bg-surface-container-highest border border-outline-variant/40 rounded-xl shadow-[0_24px_40px_-12px_rgba(0,0,0,0.45)] py-1.5 min-w-[180px] overflow-hidden backdrop-blur-xl">
                  <MenuItem icon="copy_all" label="Duplicate" onClick={() => { onDuplicate(); setMenuOpen(false); }} />
                  <MenuItem icon="content_copy" label="Copy Config" onClick={() => { onCopyConfig(); setMenuOpen(false); }} />
                  <MenuItem icon="edit" label="Edit" onClick={() => { onEdit(); setMenuOpen(false); }} />
                  <MenuItem icon="terminal" label="Logs" onClick={() => { onViewLogs(); setMenuOpen(false); }} />
                  <div className="h-px bg-outline-variant/40 my-1 mx-2" />
                  <MenuItem icon="delete" label="Delete" onClick={() => { onDelete(); setMenuOpen(false); }} danger />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium text-left transition-colors
        hover:bg-surface-container
        ${danger ? "text-error hover:text-error" : "text-on-surface"}
      `}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </button>
  );
}
