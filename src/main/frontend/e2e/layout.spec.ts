import { expect, test } from './fixtures';

/**
 * Layout at the sizes this application is actually used at.
 *
 * A dietitian takes a tablet into the consultation room, so that is a supported way of working
 * rather than a responsive afterthought. Runs under both the desktop and tablet projects; the
 * viewport comes from the project, and every assertion here should hold at either.
 *
 * The recurring failure this catches is horizontal scroll. A page one hundred pixels too wide is
 * not obviously broken in a screenshot — you notice it when a column of numbers is cut off and the
 * only way to read them is to drag the whole page sideways.
 */

const PAGES = [
  { name: 'the client list', path: () => '/' },
  { name: 'the client record', path: (c: number) => `/client/${c}` },
  { name: 'the measurements tab', path: (c: number) => `/client/${c}/measurements` },
  { name: 'the journal', path: (c: number) => `/client/${c}/journal` },
  { name: 'the food catalogue', path: () => '/food' },
];

for (const target of PAGES) {
  test(`should not scroll sideways on ${target.name}`, async ({ page, seed }) => {
    await page.goto(target.path(seed.clientId));
    await page.waitForSelector('.shell__main');

    const overflow = await horizontalOverflow(page);
    expect(overflow, await describeOverflow(page)).toBe(0);
  });
}

test('should not scroll sideways on the plan builder', async ({ page, seed }) => {
  await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
  await page.waitForSelector('.analysis__table');

  const overflow = await horizontalOverflow(page);
  expect(overflow, await describeOverflow(page)).toBe(0);
});

test('should keep the summary table readable by scrolling it, not the page', async ({
  page,
  seed,
}) => {
  // Given — the table is wider than a tablet in portrait. Its own box is allowed to scroll; the
  // page is not, and the box has to be reachable from the keyboard to be scrollable without a
  // pointer.
  await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
  await page.waitForSelector('.analysis__table');

  const box = page.locator('.analysis__scroll');
  const scrollable = await box.evaluate((el) => ({
    scrolls: el.scrollWidth > el.clientWidth,
    focusable: el.tabIndex >= 0,
    fitsViewport: el.getBoundingClientRect().width <= document.documentElement.clientWidth + 1,
  }));

  expect(scrollable.fitsViewport, 'the scroll box itself must fit the viewport').toBe(true);
  if (scrollable.scrolls) {
    expect(scrollable.focusable, 'a scrollable region must be reachable by keyboard').toBe(true);
  }
});

test('should keep tap targets big enough to hit on a touch screen', async ({ page, seed }) => {
  /*
    WCAG 2.5.8 asks 24×24 CSS pixels. Text links inside prose are exempt, and so are controls
    with enough clear space around them — but a row of small buttons in a card header is exactly
    the case the guideline is about, and a dietitian is using this with a finger.
  */
  await page.goto(`/client/${seed.clientId}/journal`);
  await page.waitForSelector('.entry');

  const tooSmall = await page.evaluate(() => {
    const results: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button, a[href], input, select')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) {
        continue;
      }
      if (box.height < 24 || box.width < 24) {
        results.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    return results;
  });

  expect(tooSmall, 'these are under 24×24 CSS pixels').toEqual([]);
});

async function horizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Names the widest offenders, so a failure says which element to look at. */
async function describeOverflow(page: import('@playwright/test').Page) {
  const culprits = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        if (box.right <= limit + 1) {
          return false;
        }
        // Anything inside a scroll container is allowed to be wider than the viewport.
        for (let p = el.parentElement; p; p = p.parentElement) {
          const overflowX = getComputedStyle(p).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
            return false;
          }
        }
        return true;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className} right=${Math.round(el.getBoundingClientRect().right)}`);
  });
  return culprits.length ? `overflowing: ${culprits.join(' | ')}` : 'page scrolls sideways';
}
