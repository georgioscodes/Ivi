import type { ReactNode } from 'react';

import { messageFor } from '@/api/messages';
import { ApiError } from '@/api/ApiError';
import { strings } from '@/strings';
import './states.css';

/**
 * The three things a panel can be other than its content: loading, empty, or failed.
 *
 * Shared because they are easy to do badly in ways that only show up in use — a spinner with no
 * accessible name, an empty state indistinguishable from a failed one, an error with no way
 * forward.
 */

interface LoadingProps {
  /** Announced to screen readers and shown beside the indicator. */
  label?: string;
}

export function Loading({ label = strings.common.loading }: LoadingProps) {
  return (
    <div className="state state--loading" role="status">
      <span className="state__spinner" aria-hidden="true" />
      <span className="state__text">{label}</span>
    </div>
  );
}

/**
 * A block of grey bars standing in for content that has not arrived.
 *
 * Used where a spinner would move the layout when the real content lands — a table, a plan day.
 * Purely decorative, so it is hidden from assistive technology and paired with a live region
 * that says what is happening.
 */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true">
      <span className="visually-hidden" role="status">
        {strings.common.loading}
      </span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="skeleton__row" aria-hidden="true" />
      ))}
    </div>
  );
}

interface EmptyProps {
  title?: string;
  hint?: string;
  /** A way out — "add the first client", "clear the filter". */
  action?: ReactNode;
}

export function Empty({ title = strings.empty.noResults, hint, action }: EmptyProps) {
  return (
    <div className="state state--empty">
      <p className="state__title">{title}</p>
      {hint ? <p className="state__hint">{hint}</p> : null}
      {action}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  /** Omitted when retrying cannot help — a 404 does not become a 200 on the second try. */
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const retryable = !(error instanceof ApiError) || error.isTransient;

  return (
    <div className="state state--error" role="alert">
      {/* Not colour alone: the border, the icon and the word all carry it. */}
      <p className="state__title">
        <span aria-hidden="true">⚠ </span>
        {messageFor(error)}
      </p>
      {onRetry && retryable ? (
        <button type="button" className="state__action" onClick={onRetry}>
          {strings.common.retry}
        </button>
      ) : null}
    </div>
  );
}
