import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/api/queryClient';
import { PlanNotes } from './PlanNotes';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAVED = { id: 1, notes: 'Αποθηκευμένο' };

describe('PlanNotes', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(json(SAVED));
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'XSRF-TOKEN=token; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should say where the notes end up, on a plan that has none', () => {
    // Given — a practitioner deciding whether to write anything needs to know it reaches the
    // client, not just the screen
    render(<PlanNotes planId={1} notes={null} />, { wrapper });

    expect(screen.getByText(/τυπώνεται στο PDF που λαμβάνει ο πελάτης/)).toBeInTheDocument();
  });

  it('should keep the practitioner line breaks', async () => {
    // Given — a list of substitutions is a list. The export prints it with `white-space: pre-wrap`
    // and the screen has to agree, or the two documents differ.
    render(<PlanNotes planId={1} notes={'Πρωί: καφές\nΒράδυ: τσάι'} />, { wrapper });

    const body = screen.getByText(/Πρωί: καφές/);
    expect(body.textContent).toContain('\n');
  });

  it('should send what was typed and close', async () => {
    const user = userEvent.setup();
    render(<PlanNotes planId={1} notes={null} />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Προσθήκη σημειώσεων' }));
    await user.type(screen.getByRole('textbox', { name: 'Σημειώσεις πλάνου' }), 'Χωρίς ζάχαρη');
    await user.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/plan/1/notes');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ notes: 'Χωρίς ζάχαρη' });
  });

  it('should discard the draft on cancel without sending anything', async () => {
    const user = userEvent.setup();
    render(<PlanNotes planId={1} notes="Αρχικό" />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Επεξεργασία' }));
    await user.type(screen.getByRole('textbox', { name: 'Σημειώσεις πλάνου' }), ' και κάτι ακόμη');
    await user.click(screen.getByRole('button', { name: 'Ακύρωση' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Αρχικό')).toBeInTheDocument();

    // Reopening starts from what is stored, not from the abandoned draft.
    await user.click(screen.getByRole('button', { name: 'Επεξεργασία' }));
    expect(screen.getByRole('textbox', { name: 'Σημειώσεις πλάνου' })).toHaveValue('Αρχικό');
  });

  it('should not overwrite what is being typed when the plan is replaced underneath it', async () => {
    // Given — every other edit on the page replaces the whole cached plan from its response, so a
    // quantity change three sections up re-renders this component with a new `notes` prop. Half a
    // sentence disappearing mid-word because a food was added elsewhere is the kind of loss a
    // practitioner cannot even describe afterwards.
    const user = userEvent.setup();
    const { rerender } = render(<PlanNotes planId={1} notes="Αρχικό" />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Επεξεργασία' }));
    await user.clear(screen.getByRole('textbox', { name: 'Σημειώσεις πλάνου' }));
    await user.type(screen.getByRole('textbox', { name: 'Σημειώσεις πλάνου' }), 'Ημιτελής πρότ');

    rerender(<PlanNotes planId={1} notes="Αρχικό" />);

    expect(screen.getByRole('textbox', { name: 'Σημειώσεις πλάνου' })).toHaveValue(
      'Ημιτελής πρότ',
    );
  });

  it('should keep the editor open when the save fails', async () => {
    // Given — closing on failure would throw away text the practitioner has no copy of
    fetchMock.mockResolvedValue(json({ status: 500, message: 'boom', errors: {} }, 500));
    const user = userEvent.setup();
    render(<PlanNotes planId={1} notes={null} />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Προσθήκη σημειώσεων' }));
    await user.type(screen.getByRole('textbox', { name: 'Σημειώσεις πλάνου' }), 'Κείμενο');
    await user.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: 'Σημειώσεις πλάνου' })).toHaveValue('Κείμενο');
  });
});
