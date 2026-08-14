import { useMutation } from '@tanstack/react-query';

import { requestBlob } from '@/api/http';

/**
 * Downloads the plan as the PDF a client receives.
 *
 * A mutation rather than a query, even though it is a GET. It is an action a practitioner takes,
 * it must not run on mount or on a cache miss, and the server records it as an EXPORT in the audit
 * log — a downloaded PDF leaves the system's control entirely, so it is not something to fire
 * speculatively.
 */
export function useExportPlan(planId: number) {
  return useMutation({
    mutationFn: async (fallbackName: string) => {
      const { blob, filename } = await requestBlob(`/export/plan/${planId}`);
      saveBlob(blob, filename ?? `${fallbackName}.pdf`);
      return filename;
    },
  });
}

/**
 * Hands the file to the browser.
 *
 * The PDF arrives through `fetch` rather than a plain link because the request has to carry the
 * session cookie and because a failure needs to surface as a message rather than as a browser
 * error page. That means the bytes are in memory here, and an object URL on a temporary anchor is
 * the way to get them into the downloads folder with the name the server chose.
 */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Firefox will not act on an anchor that is not in the document.
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoked on the next tick rather than immediately: revoking synchronously after `click()`
  // cancels the download in some browsers, which fails silently and looks like the button did
  // nothing at all.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
