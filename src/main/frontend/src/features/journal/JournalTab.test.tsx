import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/api/queryClient';
import { JournalTab } from './JournalTab';

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    clientId: 7,
    entryDate: '2026-08-11',
    title: 'Επανέλεγχος',
    content: 'Καλή προσκόλληση στη διατροφή.',
    createdAt: '2026-08-11T09:00:00Z',
    updatedAt: '2026-08-11T09:00:00Z',
    ...overrides,
  };
}

function page(content: unknown[], totalElements = content.length) {
  return { content, page: 0, size: 20, totalElements, totalPages: 1, last: true };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderTab() {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/client/7/journal']}>
          <Routes>
            <Route path="/client/:clientId/journal" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<JournalTab />, { wrapper: Wrapper });
}

describe('JournalTab', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(json(page([entry()])));
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'XSRF-TOKEN=token; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should show an entry with its date, title and text', async () => {
    renderTab();

    expect(await screen.findByText('Επανέλεγχος')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /11 Αυγούστου 2026/ })).toBeInTheDocument();
    expect(screen.getByText('Τρίτη')).toBeInTheDocument();
    expect(screen.getByText('Καλή προσκόλληση στη διατροφή.')).toBeInTheDocument();
  });

  it('should keep the practitioner line breaks', async () => {
    // Given — a note's paragraph breaks are its structure, and flattening them changes what it
    // says. The same rule the export applies.
    fetchMock.mockResolvedValue(json(page([entry({ content: 'Πρώτη γραμμή\nΔεύτερη γραμμή' })])));
    renderTab();

    // The `pre-wrap` that renders these is asserted in the browser check — happy-dom does not
    // apply the stylesheet, so a computed-style assertion here would pass on an empty string.
    const body = await screen.findByText(/Πρώτη γραμμή/);
    expect(body.textContent).toContain('\n');
  });

  it('should not send a search until the typing stops', async () => {
    // Given — every list read writes a row to the audit log, because reading someone's clinical
    // notes is a recorded access. One request per keystroke would bury the real accesses under a
    // trail of half-typed prefixes.
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Επανέλεγχος');
    fetchMock.mockClear();

    await user.type(screen.getByRole('searchbox'), 'διατροφή');

    // Nothing yet: the term is still settling.
    expect(fetchMock).not.toHaveBeenCalled();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('q=%CE%B4%CE%B9%CE%B1%CF%84%CF%81%CE%BF%CF%86%CE%AE');
  });

  it('should leave the term off the request when the box is empty', async () => {
    // Given — a blank `q` would send the server down the search path to match everything, which
    // is a different query for an identical result
    renderTab();
    await screen.findByText('Επανέλεγχος');

    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('q=');
  });

  it('should say that a search matched nothing, differently from having no entries at all', async () => {
    // Given — "you have no entries" under a search box with a word in it is wrong, and sends the
    // practitioner looking for an entry they are sure they wrote
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Επανέλεγχος');

    fetchMock.mockResolvedValue(json(page([])));
    await user.type(screen.getByRole('searchbox'), 'ξξξ');

    expect(await screen.findByText(/Καμία καταχώρηση δεν ταιριάζει/, {}, { timeout: 2000 }))
      .toBeInTheDocument();
  });

  it('should mark an entry that was changed after it was written', async () => {
    // Given — a journal is a clinical record. That an entry was amended is part of it.
    fetchMock.mockResolvedValue(
      json(page([entry({ updatedAt: '2026-08-12T10:00:00Z' })])),
    );
    renderTab();

    expect(await screen.findByText('Τροποποιήθηκε')).toBeInTheDocument();
  });

  it('should not mark an entry that has never been amended', async () => {
    renderTab();
    await screen.findByText('Επανέλεγχος');

    expect(screen.queryByText('Τροποποιήθηκε')).not.toBeInTheDocument();
  });

  it('should name the entry in each row action, for anyone who cannot see which row it is in', async () => {
    renderTab();
    await screen.findByText('Επανέλεγχος');

    expect(
      screen.getByRole('button', { name: /Επεξεργασία καταχώρησης με ημερομηνία 11 Αυγούστου 2026/ }),
    ).toBeInTheDocument();
  });

  it('should confirm a delete without inflecting the date', async () => {
    // Given — "της 3 Αυγούστου" is wrong Greek; it wants an ordinal. The sentence is phrased so
    // the date needs no inflection, the same escape the plan builder's day label needed.
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Επανέλεγχος');

    await user.click(screen.getByRole('button', { name: /Διαγραφή καταχώρησης/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/με ημερομηνία 11 Αυγούστου 2026/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/της 11 Αυγούστου/)).not.toBeInTheDocument();
  });

  it('should delete the entry it was asked about', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Επανέλεγχος');

    await user.click(screen.getByRole('button', { name: /Διαγραφή καταχώρησης/ }));
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Διαγραφή' }));

    await waitFor(() => {
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/journal/1');
      expect(init.method).toBe('DELETE');
    });
  });
});
