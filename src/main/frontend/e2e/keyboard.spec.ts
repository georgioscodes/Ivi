import { expect, test } from './fixtures';

/**
 * Keyboard operation and focus.
 *
 * A dietitian working through a consultation types more than they point, and this is the part of
 * an interface that no component test can check: jsdom and happy-dom have no real focus, no
 * `<dialog>` top layer, and no sequential navigation order. It has to be a browser.
 */

test.describe('dialogs', () => {
  test('should announce the dialog that is actually open', async ({ page, seed }) => {
    // Given — the plan page renders three ConfirmDialogs at once (clear day, delete plan, remove
    // item). If they share element ids, `aria-labelledby` resolves against the first match in the
    // document and a screen reader announces the wrong dialog's title.
    await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
    await page.waitForSelector('.analysis__table');

    const duplicated = await page.evaluate(() => {
      const counts = new Map<string, number>();
      for (const el of document.querySelectorAll('[id]')) {
        counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
      }
      return [...counts].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`);
    });
    expect(duplicated, 'ids must be unique for aria-labelledby to resolve').toEqual([]);
  });

  test('should give the open dialog the right accessible name', async ({ page, seed }) => {
    await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
    await page.waitForSelector('.analysis__table');

    /*
      Deliberately the *second* dialog on the page rather than the first. With shared ids the
      first one in document order wins the `aria-labelledby` lookup, so "clear day" — which is
      first — would pass this check while every other dialog on the page announced its title.
    */
    await page.getByRole('button', { name: 'Διαγραφή', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The name a screen reader would read out, resolved by the browser, not by reading the source.
    await expect(dialog).toHaveAccessibleName('Διαγραφή πλάνου');
  });

  test('should put focus on the safe choice for a destructive action', async ({ page, seed }) => {
    // Given — Enter on an unguarded dialog should not delete a client's plan
    await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
    await page.waitForSelector('.analysis__table');

    await page.getByRole('button', { name: 'Διαγραφή', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(page.locator('dialog[open] :focus')).toHaveText('Ακύρωση');
  });

  test('should trap focus inside the dialog', async ({ page, seed }) => {
    await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
    await page.waitForSelector('.analysis__table');
    await page.getByRole('button', { name: 'Διαγραφή', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    /*
      What "trapped" means here is narrower than it first looks. Probed against a bare native
      <dialog> with no application code at all, Chromium cycles A → B → body → A: while wrapping
      from the last control back to the first, focus passes through the document body, because
      that is where it goes instead of reaching the browser's own UI. Asserting "always inside the
      dialog" therefore fails on a dialog that is behaving perfectly.

      The property that actually matters is that focus never reaches anything *behind* the modal.
    */
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const escaped = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]');
        const active = document.activeElement;
        if (!dialog || !active || active === document.body) {
          return false;
        }
        return !dialog.contains(active);
      });
      expect(escaped, `focus reached the page behind the dialog after ${i + 1} tabs`).toBe(false);
    }
  });

  test('should close on Escape and return focus to what opened it', async ({ page, seed }) => {
    // Given — focus falling to <body> strands a keyboard user at the top of the document, with
    // no indication of where they were
    await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
    await page.waitForSelector('.analysis__table');

    const trigger = page.getByRole('button', { name: 'Διαγραφή', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('should let the food picker be driven entirely from the keyboard', async ({ page, seed }) => {
    await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
    await page.waitForSelector('.analysis__table');

    await page.getByRole('button', { name: /Προσθήκη τροφίμου στο γεύμα/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The search box should already hold focus: it is the only thing to do next.
    await expect(dialog.getByRole('searchbox').or(dialog.getByRole('textbox')).first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('the plan builder', () => {
  test('should reorder a meal from the keyboard alone', async ({ page, seed }) => {
    /*
      dnd-kit's keyboard sensor, driven for real. This is the interaction least amenable to a
      component test — happy-dom has no layout, and the sensor works in coordinates — so it is
      checked here or not at all.

      The rows also carry explicit move buttons, which is what makes reordering possible for
      someone using a switch or voice control rather than either a mouse or arrow keys.
    */
    await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
    await page.waitForSelector('.analysis__table');

    // The seeded plan puts two items in one meal on day 0.
    const meal = page.locator('.meal').filter({ has: page.locator('.item') }).first();
    const names = () => meal.locator('.item__name').allTextContents();
    const before = await names();
    // Asserted, not skipped: `test.skip` on a missing fixture reads as a pass in the summary,
    // which is how the first version of this test quietly checked nothing at all.
    expect(before.length, 'the fixture should seed two items in one meal').toBeGreaterThanOrEqual(2);

    const moveDown = meal.locator('.item').first().getByRole('button', { name: /Μετακίνηση κάτω/ });
    await moveDown.focus();
    await page.keyboard.press('Enter');

    await expect.poll(names).toEqual([before[1], before[0]]);
  });

  test('should keep the quantity field usable without a pointer', async ({ page, seed }) => {
    // Given — the field commits on a pause in typing, on blur and on Enter. Tabbing away is the
    // most common of the three and the one that must not silently drop the edit.
    await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
    await page.waitForSelector('.analysis__table');

    const quantity = page.locator('input.item__quantity').first();
    await quantity.focus();
    await quantity.fill('3');
    await page.keyboard.press('Enter');

    await expect(page.locator('.save-status')).toBeVisible();
    await expect.poll(() => quantity.inputValue()).toBe('3');
  });
});

test.describe('the journal', () => {
  test('should not strand focus after deleting the row that held it', async ({ page, seed }) => {
    // Given — the delete button lives inside the entry it deletes. Native <dialog> restores focus
    // to the element that opened it, and that element no longer exists.
    await page.goto(`/client/${seed.clientId}/journal`);
    await page.waitForSelector('.entry');

    await page.getByRole('button', { name: /Διαγραφή καταχώρησης/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Διαγραφή' }).click();

    await expect(page.locator('.entry')).toHaveCount(0);

    /*
      Polled rather than sampled once. Focus is moved on the frame after the list re-renders, so a
      single read can catch the gap between the row disappearing and the new target being focused
      — which it did, intermittently, while passing every time the test was run on its own. A test
      that fails one run in five is worse than no test: it teaches you to re-run it.
    */
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'NONE'), {
        message: 'focus should land on a control, not fall to the document body',
      })
      .toBe('BUTTON');
  });
});

test.describe('the page as a whole', () => {
  test('should let a keyboard user skip the navigation', async ({ page, seed }) => {
    // Given — every page repeats the same shell links. Without a skip link, reaching the content
    // means tabbing past all of them on every single page.
    await page.goto(`/client/${seed.clientId}`);
    await page.waitForSelector('.tabs');

    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return { text: el?.textContent?.trim() ?? '', href: el?.getAttribute('href') ?? '' };
    });
    expect(first.href, 'the first tab stop should be a skip link').toContain('#');
  });

  test('should show where focus is, on every interactive element', async ({ page, seed }) => {
    // Given — WCAG 2.4.7. A focus ring removed for looks makes the whole application unusable
    // without a pointer.
    await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
    await page.waitForSelector('.analysis__table');

    const invisible: string[] = [];
    const focusables = page.locator(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex="0"]',
    );

    for (let i = 0; i < (await focusables.count()); i++) {
      const el = focusables.nth(i);
      if (!(await el.isVisible())) {
        continue;
      }
      await el.focus();
      const ring = await el.evaluate((node) => {
        const s = getComputedStyle(node);
        return {
          outlineWidth: s.outlineWidth,
          outlineStyle: s.outlineStyle,
          boxShadow: s.boxShadow,
        };
      });
      const hasRing =
        (ring.outlineStyle !== 'none' && parseFloat(ring.outlineWidth) > 0) ||
        (ring.boxShadow !== 'none' && ring.boxShadow !== '');
      if (!hasRing) {
        invisible.push((await el.evaluate((n) => n.outerHTML)).slice(0, 80));
      }
    }

    expect(invisible, 'these take focus without showing it').toEqual([]);
  });
});
