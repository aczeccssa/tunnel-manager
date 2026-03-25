import { Button } from "./ui/Button";

interface EmptyStateProps {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-8 text-center">
      {/* Icon */}
      <div className="mb-6 p-6 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-tertiary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
        No tunnel profiles yet
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mb-8 leading-relaxed">
        Create your first SSH tunnel profile to get started. Manage your local and remote
        port forwards with ease.
      </p>

      <Button onClick={onCreate} size="lg">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="mr-2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create your first profile
      </Button>
    </div>
  );
}
