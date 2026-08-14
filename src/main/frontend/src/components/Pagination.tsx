import './pagination.css';

interface PaginationProps {
  /** Zero-based, as the server counts. Displayed one-based, as people count. */
  page: number;
  totalPages: number;
  totalElements: number;
  onChange: (page: number) => void;
  /** True while the next page is in flight, so the controls stop accepting more clicks. */
  busy?: boolean;
  /**
   * What is being counted, in the genitive-friendly plural: "πελάτες", "τρόφιμα", "προτάσεις".
   *
   * Required rather than defaulted. This component was written for the client list and hardcoded
   * "πελάτες"; reused on the food catalogue it cheerfully reported "34 πελάτες" underneath a
   * table of cheeses. A default would have let the next screen do the same.
   */
  noun: string;
}

/**
 * Previous / next with a position readout.
 *
 * Numbered page links are deliberately absent. A practice has tens or hundreds of clients, not
 * thousands, and the way anybody finds a specific one is the search box next to this. Page seven
 * of an alphabetical list is not a thing anyone looks for.
 */
export function Pagination({
  page,
  totalPages,
  totalElements,
  onChange,
  busy,
  noun,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="Σελιδοποίηση">
      <button
        type="button"
        className="button button--secondary"
        onClick={() => onChange(page - 1)}
        disabled={page <= 0 || busy}
      >
        Προηγούμενη
      </button>

      {/* Polite, so it is announced after a page change rather than interrupting. */}
      <span className="pagination__position" aria-live="polite">
        Σελίδα {page + 1} από {totalPages} · {totalElements} {noun}
      </span>

      <button
        type="button"
        className="button button--secondary"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1 || busy}
      >
        Επόμενη
      </button>
    </nav>
  );
}
