import { Modal } from "./ui";
import type { UpdateInfo, TunnelProfile } from "../types";

interface UpdatePromptProps {
  open: boolean;
  availableUpdate: UpdateInfo | null;
  onClose: () => void;
  onInstall: () => void;
  onOpenReleaseNotes: (url: string) => void;
}

export function UpdatePrompt({
  open,
  availableUpdate,
  onClose,
  onInstall,
  onOpenReleaseNotes,
}: UpdatePromptProps) {
  return (
    <Modal open={open} onClose={onClose} size="md" showClose={false}>
      <div className="flex flex-col h-full max-h-[90vh]">
        <header className="px-6 py-5 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-highest/30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">system_update_alt</span>
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Update Available</h2>
              <p className="text-[13px] text-on-surface-variant font-label">
                {availableUpdate ? `Version ${availableUpdate.version} is ready to install` : "A new release is available"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full" />
              <h3 className="font-headline text-lg font-semibold text-on-surface">Release</h3>
            </div>
            <p className="text-sm leading-6 text-on-surface-variant">
              {availableUpdate
                ? `Current version ${availableUpdate.currentVersion} can be updated to ${availableUpdate.version}.`
                : "An update is available for this app."}
            </p>
            {availableUpdate?.releaseNotes && (
              <div className="rounded-xl bg-surface-container px-4 py-4">
                <p className="text-sm text-on-surface-variant whitespace-pre-wrap leading-6">
                  {availableUpdate.releaseNotes}
                </p>
              </div>
            )}
          </section>
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40">
            {availableUpdate?.releaseUrl && (
              <button
                type="button"
                className="px-4 py-2 rounded-md text-on-surface hover:bg-surface-container transition-colors"
                onClick={() => onOpenReleaseNotes(availableUpdate.releaseUrl!)}
              >
                Release Notes
              </button>
            )}
            <button
              type="button"
              className="px-4 py-2 rounded-md text-on-surface hover:bg-surface-container transition-colors"
              onClick={onClose}
            >
              Later
            </button>
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold hover:bg-primary-dim transition-colors"
              onClick={onInstall}
            >
              Update and Restart
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface DeleteProfileDialogProps {
  profile: TunnelProfile | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteProfileDialog({
  profile,
  onClose,
  onConfirm,
}: DeleteProfileDialogProps) {
  return (
    <Modal open={!!profile} onClose={onClose} size="sm" showClose={false}>
      <div className="flex flex-col h-full max-h-[90vh]">
        <header className="px-6 py-5 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-highest/30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-error/10 flex items-center justify-center text-error">
              <span className="material-symbols-outlined">delete</span>
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Delete Profile</h2>
              <p className="text-[13px] text-on-surface-variant font-label">This action cannot be undone</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-error rounded-full" />
              <h3 className="font-headline text-lg font-semibold text-on-surface">Confirmation</h3>
            </div>
            <p className="text-sm leading-6 text-on-surface-variant">
              Are you sure you want to delete "{profile?.name}"? This profile, related runtime state, and cached credentials will be removed from the app.
            </p>
          </section>
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40">
            <button
              className="px-4 py-2 rounded-md text-on-surface hover:bg-surface-container transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-5 py-2.5 rounded-xl bg-error text-on-error font-semibold hover:bg-error/90 transition-colors"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
