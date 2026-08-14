import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/api/queryClient';
import type { JournalEntryResponse } from '@/api/types';
import { JournalEntryForm } from './JournalEntryForm';
import { today } from './journalDates';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

const EXISTING = {
  id: 4,
  clientId: 7,
  entryDate: '2026-08-01',
  title: 'Πρώτη συνεδρία',
  content: 'Αρχικό ιστορικό.',
  createdAt: '2026-08-01T09:00:00Z',
  updatedAt: '2026-08-01T09:00:00Z',
} as unknown as JournalEntryResponse;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('JournalEntryForm', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(json(EXISTING));
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'XSRF-TOKEN=token; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should default the date to today and leave it editable', () => {
    // Given — most write-ups happen the same day, but the date that matters clinically is when
    // the consultation happened, so this is a default and not a fixed value
    render(<JournalEntryForm clientId={7} entry={null} onDone={() => {}} />, { wrapper });

    const date = screen.getByLabelText(/Ημερομηνία συνεδρίας/);
    expect(date).toHaveValue(today());
    expect(date).not.toBeDisabled();
  });

  it('should stop a date in the future before it reaches the server', async () => {
    // Given — @PastOrPresent server-side. The message here is Greek; the server's is not.
    const user = userEvent.setup();
    render(<JournalEntryForm clientId={7} entry={null} onDone={() => {}} />, { wrapper });

    await user.type(screen.getByLabelText(/Σημειώσεις συνεδρίας/), 'Κείμενο');
    await user.clear(screen.getByLabelText(/Ημερομηνία συνεδρίας/));
    await user.type(screen.getByLabelText(/Ημερομηνία συνεδρίας/), '2099-01-01');
    await user.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    expect(await screen.findByText(/δεν μπορεί να είναι μελλοντική/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should refuse an entry with no text', async () => {
    // Given — an entry that says nothing is a row in a clinical record that cannot be read later
    const user = userEvent.setup();
    render(<JournalEntryForm clientId={7} entry={null} onDone={() => {}} />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    expect(await screen.findByText(/δεν μπορεί να είναι κενό/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should treat whitespace as empty', async () => {
    const user = userEvent.setup();
    render(<JournalEntryForm clientId={7} entry={null} onDone={() => {}} />, { wrapper });

    await user.type(screen.getByLabelText(/Σημειώσεις συνεδρίας/), '   ');
    await user.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    expect(await screen.findByText(/δεν μπορεί να είναι κενό/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should not scold before the first attempt to save', async () => {
    // Given — a field marked wrong the moment it is focused is telling someone off for not
    // having finished typing
    const user = userEvent.setup();
    render(<JournalEntryForm clientId={7} entry={null} onDone={() => {}} />, { wrapper });

    await user.click(screen.getByLabelText(/Σημειώσεις συνεδρίας/));
    await user.tab();

    expect(screen.queryByText(/δεν μπορεί να είναι κενό/)).not.toBeInTheDocument();
  });

  it('should send a new entry with its client and date', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<JournalEntryForm clientId={7} entry={null} onDone={onDone} />, { wrapper });

    await user.type(screen.getByLabelText(/Τίτλος/), 'Επανέλεγχος');
    await user.type(screen.getByLabelText(/Σημειώσεις συνεδρίας/), 'Καλή πρόοδος.');
    await user.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/journal');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      clientId: 7,
      entryDate: today(),
      title: 'Επανέλεγχος',
      content: 'Καλή πρόοδος.',
    });
  });

  it('should omit an empty title rather than sending a blank one', async () => {
    // Given — the title is nullable, and "" is not the same as absent in a record that gets read
    // back years later
    const user = userEvent.setup();
    render(<JournalEntryForm clientId={7} entry={null} onDone={() => {}} />, { wrapper });

    await user.type(screen.getByLabelText(/Σημειώσεις συνεδρίας/), 'Χωρίς τίτλο.');
    await user.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).not.toHaveProperty('title');
  });

  it('should open an amend on what is already there', () => {
    render(<JournalEntryForm clientId={7} entry={EXISTING} onDone={() => {}} />, { wrapper });

    expect(screen.getByLabelText(/Ημερομηνία συνεδρίας/)).toHaveValue('2026-08-01');
    expect(screen.getByLabelText(/Τίτλος/)).toHaveValue('Πρώτη συνεδρία');
    expect(screen.getByLabelText(/Σημειώσεις συνεδρίας/)).toHaveValue('Αρχικό ιστορικό.');
  });

  it('should amend with PUT rather than creating a second entry', async () => {
    const user = userEvent.setup();
    render(<JournalEntryForm clientId={7} entry={EXISTING} onDone={() => {}} />, { wrapper });

    await user.type(screen.getByLabelText(/Σημειώσεις συνεδρίας/), ' Συμπλήρωμα.');
    await user.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/journal/4');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string).content).toBe('Αρχικό ιστορικό. Συμπλήρωμα.');
  });

  it('should keep the text on screen when the save fails', async () => {
    // Given — the practitioner has no other copy of what they just typed
    fetchMock.mockResolvedValue(json({ status: 500, message: 'boom', errors: {} }, 500));
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<JournalEntryForm clientId={7} entry={null} onDone={onDone} />, { wrapper });

    await user.type(screen.getByLabelText(/Σημειώσεις συνεδρίας/), 'Μια ολόκληρη συνεδρία.');
    await user.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByLabelText(/Σημειώσεις συνεδρίας/)).toHaveValue('Μια ολόκληρη συνεδρία.');
    expect(onDone).not.toHaveBeenCalled();
  });
});
