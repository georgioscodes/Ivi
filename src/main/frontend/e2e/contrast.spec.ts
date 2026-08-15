import { expect, test } from './fixtures';

/**
 * Contrast, measured from what the browser actually painted.
 *
 * `docs/ui-palette.md` records the contrast of each token, computed by hand. That checks the
 * palette; it does not check the pages. A token can be impeccable and still be applied to the
 * wrong thing — pale ink on a pale fill, a hint colour reused on a coloured card — and only the
 * rendered page knows which pairs actually occur.
 *
 * The brand five are surface colours: fills with dark ink on top, never the reverse. This is where
 * that rule is enforced against reality rather than intention.
 */

/** WCAG 2.1: 4.5:1 for body text, 3:1 for large text and for user interface components. */
const BODY = 4.5;
const LARGE = 3;

const PAGES = [
  { name: 'the client list', path: () => '/' },
  { name: 'the client record', path: (c: number) => `/client/${c}` },
  { name: 'the measurements tab', path: (c: number) => `/client/${c}/measurements` },
  { name: 'the journal', path: (c: number) => `/client/${c}/journal` },
  { name: 'the food catalogue', path: () => '/food' },
];

for (const target of PAGES) {
  test(`should keep every piece of text readable on ${target.name}`, async ({ page, seed }) => {
    await page.goto(target.path(seed.clientId));
    await page.waitForSelector('.shell__main');
    await page.evaluate(() => document.fonts.ready);

    const failures = await page.evaluate(measureContrast, { body: BODY, large: LARGE });
    expect(failures, formatFailures(failures)).toEqual([]);
  });
}

test('should keep the plan builder readable, including the over-target warnings', async ({
  page,
  seed,
}) => {
  // The busiest screen in the application, and the one with colour carrying meaning.
  await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
  await page.waitForSelector('.analysis__table');
  await page.evaluate(() => document.fonts.ready);

  const failures = await page.evaluate(measureContrast, { body: BODY, large: LARGE });
  expect(failures, formatFailures(failures)).toEqual([]);
});

test('should keep a dialog readable, including a destructive one', async ({ page, seed }) => {
  // Given — white text on --error is the single exception to the "no white text" rule, and it is
  // worth measuring rather than trusting
  await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
  await page.waitForSelector('.analysis__table');
  await page.getByRole('button', { name: 'Διαγραφή', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const failures = await page.evaluate(measureContrast, { body: BODY, large: LARGE });
  expect(failures, formatFailures(failures)).toEqual([]);
});

interface Failure {
  text: string;
  selector: string;
  ratio: number;
  required: number;
  colour: string;
  background: string;
}

function formatFailures(failures: Failure[]): string {
  if (failures.length === 0) {
    return 'no contrast failures';
  }
  return failures
    .map(
      (f) =>
        `${f.selector} "${f.text}" — ${f.ratio.toFixed(2)}:1 (needs ${f.required}:1), ` +
        `${f.colour} on ${f.background}`,
    )
    .join('\n');
}

/**
 * Runs inside the page. Walks every element holding its own text, resolves the background it
 * actually sits on by climbing until something opaque is found, and measures the pair.
 */
function measureContrast(thresholds: { body: number; large: number }): Failure[] {
  const luminance = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const parse = (colour: string): [number, number, number, number] => {
    const nums = colour.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
    return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, nums[3] ?? 1];
  };

  const ratio = (fg: [number, number, number], bg: [number, number, number]) => {
    const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
    return (light + 0.05) / (dark + 0.05);
  };

  /** The first opaque background behind an element, which is what its text is really read on. */
  const backgroundOf = (el: Element): [number, number, number] => {
    let node: Element | null = el;
    while (node) {
      const [r, g, b, a] = parse(getComputedStyle(node).backgroundColor);
      if (a > 0.95) {
        return [r, g, b];
      }
      node = node.parentElement;
    }
    return [255, 255, 255];
  };

  const describe = (el: Element) => {
    const classes = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    return `${el.tagName.toLowerCase()}${classes}`.slice(0, 60);
  };

  const failures: Failure[] = [];

  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    // Only elements holding their own text, so a colour is attributed to what actually renders it.
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim() ?? '')
      .join(' ')
      .trim();
    if (own === '') {
      continue;
    }

    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.1) {
      continue;
    }
    // Visually-hidden text is for screen readers; it is not painted and has no contrast.
    const box = el.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) {
      continue;
    }

    const [r, g, b, alpha] = parse(style.color);
    if (alpha < 0.1) {
      continue;
    }

    const size = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    // WCAG "large text": 18.66px bold, or 24px at any weight.
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = isLarge ? thresholds.large : thresholds.body;

    const background = backgroundOf(el);
    const measured = ratio([r, g, b], background);

    if (measured < required) {
      failures.push({
        text: own.slice(0, 40),
        selector: describe(el),
        ratio: measured,
        required,
        colour: style.color,
        background: `rgb(${background.join(', ')})`,
      });
    }
  }

  return failures;
}
