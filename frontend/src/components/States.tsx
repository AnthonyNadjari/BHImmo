/** Shared loading / error / empty UI primitives. */

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="state error-card" role="alert">
      <p>Couldn't load data.</p>
      <p className="muted small">{error.message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="state">{children}</div>;
}

/** Shimmer block used to build skeletons. */
export function Shimmer({ w, h, r = 6 }: { w?: number | string; h: number | string; r?: number }) {
  return <span className="shimmer" style={{ width: w ?? "100%", height: h, borderRadius: r }} />;
}

/** Skeleton table rows for list views while data loads. */
export function TableSkeleton({ rows = 8, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-scroll" aria-hidden="true">
      <div className="skeleton-table">
        {Array.from({ length: rows }).map((_, r) => (
          <div className="skeleton-row" key={r}>
            <Shimmer w={54} h={40} />
            {Array.from({ length: cols }).map((_, c) => (
              <Shimmer key={c} h={12} w={c === 0 ? "60%" : "70%"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
