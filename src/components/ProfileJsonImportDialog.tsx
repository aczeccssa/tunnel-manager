import { Modal } from "./ui";
import { highlightJson } from "./profile-form-utils";

interface ProfileJsonImportDialogProps {
  open: boolean;
  value: string;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
}

export function ProfileJsonImportDialog({
  open,
  value,
  error,
  loading,
  onClose,
  onChange,
  onConfirm,
}: ProfileJsonImportDialogProps) {
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Import Profile JSON">
      <div className="flex flex-col max-h-[85vh]">
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-on-surface-variant leading-6">
              Automatic clipboard paste was unavailable or the content did not match. Paste the profile JSON here, then confirm to fill the form.
            </p>
            {error && (
              <div className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}
          </div>

          <section className="space-y-3">
            <label className="text-on-surface-variant text-[13px] font-medium px-1">JSON Input</label>
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              spellCheck={false}
              placeholder='{"kind":"tunnel-manager/profile-config","version":1,"profile":{...}}'
              className="min-h-[220px] w-full resize-y rounded-md bg-surface-container-highest px-4 py-3 font-mono text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30"
            />
          </section>

          <section className="space-y-3">
            <label className="text-on-surface-variant text-[13px] font-medium px-1">Syntax Highlight</label>
            <pre className="min-h-[220px] overflow-auto rounded-md bg-surface-container-highest px-4 py-3 font-mono text-sm leading-6 text-on-surface">
              <code
                dangerouslySetInnerHTML={{
                  __html: value
                    ? highlightJson(value)
                    : '<span class="text-on-surface-variant/60">{ ... }</span>',
                }}
              />
            </pre>
          </section>
        </div>

        <footer className="px-6 py-5 border-t border-outline-variant/40 bg-surface-container-low/50 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-md text-on-surface-variant font-medium hover:bg-surface-container-highest transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !value.trim()}
            className="px-8 py-2.5 rounded-md bg-primary text-on-primary font-semibold shadow-lg shadow-primary/20 hover:bg-primary-dim transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Importing..." : "Confirm"}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
