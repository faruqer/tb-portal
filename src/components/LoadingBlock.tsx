interface LoadingBlockProps {
  label?: string;
  compact?: boolean;
}

export function LoadingBlock({ label = 'Loading data…', compact = false }: LoadingBlockProps) {
  return (
    <div className={`loading-block${compact ? ' loading-block-compact' : ''}`} role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
