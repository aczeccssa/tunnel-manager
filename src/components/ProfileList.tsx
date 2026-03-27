import { ProfileCard } from "./ProfileCard";
import { EmptyState } from "./EmptyState";
import { useProfileStore, useRuntimeStore, useUIStore } from "../store";
import type { TunnelProfile } from "../types";

interface ProfileListProps {
  onCreate: () => void;
  onEdit: (profile: TunnelProfile) => void;
  onDelete: (profile: TunnelProfile) => void;
  onDuplicate: (profile: TunnelProfile) => void;
  onCopyConfig: (profile: TunnelProfile) => void;
  onStart: (profile: TunnelProfile) => void;
  onStop: (profile: TunnelProfile) => void;
  onViewLogs: (profile: TunnelProfile) => void;
}

export function ProfileList({
  onCreate,
  onEdit,
  onDelete,
  onDuplicate,
  onCopyConfig,
  onStart,
  onStop,
  onViewLogs,
}: ProfileListProps) {
  const profiles = useProfileStore((s) => s.profiles);
  const runtimeStates = useRuntimeStore((s) => s.states);
  const { viewMode, filterStatus, filterType } = useUIStore();

  const filteredProfiles = profiles.filter((profile) => {
    // 1. Filter by Type
    if (filterType !== "all" && profile.mode !== filterType) {
      return false;
    }

    // 2. Filter by Status
    if (filterStatus !== "all") {
      const state = runtimeStates[profile.id];
      const status = state?.status || "IDLE";
      const isActive = status === "RUNNING" || status === "CONNECTING" || status === "RECONNECTING";
      
      if (filterStatus === "active" && !isActive) return false;
      if (filterStatus === "inactive" && isActive) return false;
    }

    return true;
  });

  if (profiles.length === 0) {
    return <EmptyState onCreate={onCreate} />;
  }

  if (filteredProfiles.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">filter_list_off</span>
        <h3 className="text-lg font-headline font-bold text-on-surface mb-2">No profiles match the current filter</h3>
        <p className="text-on-surface-variant text-sm mb-6 max-w-md">
          Try changing your filter settings to see your other profiles.
        </p>
      </div>
    );
  }

  return (
    <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-4"}>
      {filteredProfiles.map((profile) => {
        const state = runtimeStates[profile.id];
        return (
          <ProfileCard
            key={profile.id}
            profile={profile}
            status={state?.status || "IDLE"}
            errorMessage={state?.errorMessage}
            onStart={() => onStart(profile)}
            onStop={() => onStop(profile)}
            onEdit={() => onEdit(profile)}
            onDuplicate={() => onDuplicate(profile)}
            onCopyConfig={() => onCopyConfig(profile)}
            onDelete={() => onDelete(profile)}
            onViewLogs={() => onViewLogs(profile)}
            viewMode={viewMode}
          />
        );
      })}
    </div>
  );
}
