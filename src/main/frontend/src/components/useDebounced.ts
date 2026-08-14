import { useEffect, useState } from 'react';

/**
 * The value, held back until it stops changing.
 *
 * Used for search. Querying per keystroke sends a request for every prefix of what someone typed,
 * and the answers arrive out of order — so the list can settle on the results for "Ελ" after the
 * results for "Ελένη" have already been shown.
 *
 * 300ms is roughly the gap between deliberate typing and a pause.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
