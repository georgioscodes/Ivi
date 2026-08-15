import { expect, test } from './fixtures';

/**
 * Greek, as the browser actually renders it.
 *
 * The whole application is Greek, and every failure mode here is invisible to a unit test: a font
 * that silently falls back, a number formatted with the wrong separator, a hyphen standing in for
 * a minus. The PDF work in step 8 took the font question seriously because a plan rendered in a
 * font without Greek coverage produces blank glyphs and nobody notices until a client opens it.
 * The screen deserves the same check.
 */

test('should render Greek in the font the application ships, not a fallback', async ({
  page,
  seed,
}) => {
  await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
  await page.waitForSelector('.analysis__table');
  await page.evaluate(() => document.fonts.ready);

  // The Greek subset is a separate woff2 file. Asking the browser whether it loaded is the only
  // way to know the page is not quietly rendering in whatever system font came first.
  const greekLoaded = await page.evaluate(() =>
    [...document.fonts].some((f) => f.status === 'loaded' && f.family.includes('Inter')),
  );
  expect(greekLoaded, 'the bundled Inter should have loaded').toBe(true);

  // And that Greek text is measurably being drawn with it, rather than in a fallback that happens
  // to cover the glyphs.
  const rendered = await page.evaluate(() => {
    const heading = document.querySelector('.page-title');
    return heading ? getComputedStyle(heading).fontFamily : '';
  });
  expect(rendered).toContain('Inter');
});

test('should draw every Greek glyph rather than a missing-character box', async ({ page, seed }) => {
  // Given — tofu (□) is what a missing glyph renders as. Measuring the text's width against the
  // same string in a font known to lack Greek is how you catch it without looking at a picture.
  await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
  await page.waitForSelector('.analysis__table');
  await page.evaluate(() => document.fonts.ready);

  const allCovered = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return true;
    }
    const font = getComputedStyle(document.body).fontFamily;
    ctx.font = `16px ${font}`;
    const tofuWidth = ctx.measureText('￿').width;

    // Every accented capital and lowercase form Greek uses, plus the final sigma.
    const alphabet = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩάέήίόύώϊϋΐΰςΆΈΉΊΌΎΏ';
    return [...alphabet].every((ch) => ctx.measureText(ch).width !== tofuWidth);
  });
  expect(allCovered, 'a Greek character rendered at the width of a missing glyph').toBe(true);
});

test('should format numbers the Greek way, everywhere they appear', async ({ page, seed }) => {
  // Given — a decimal comma and a full stop for thousands. "2.010" is two thousand and ten here,
  // and a practitioner reading it as two-point-oh-one-oh is being misinformed by the interface.
  await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
  await page.waitForSelector('.analysis__table');

  const targetRow = page.locator('.analysis__row--target');
  await expect(targetRow).toContainText('2.000');
  await expect(targetRow).toContainText('120,0');

  // No Latin-style "2,000.0" anywhere in the table.
  const table = await page.locator('.analysis__table').textContent();
  expect(table).not.toMatch(/\d,\d{3}\./);
});

test('should use a real minus sign for signed values', async ({ page, seed }) => {
  // Given — a hyphen-minus is a different character from U+2212 and renders shorter and higher,
  // which reads as a dash rather than as a sign at the size these appear.
  await page.goto(`/client/${seed.clientId}/measurements`);
  await page.waitForSelector('.tabs');

  const text = (await page.locator('.shell__main').textContent()) ?? '';
  const signed = text.match(/[-−]\d/g) ?? [];
  const asciiHyphen = signed.filter((s) => s.startsWith('-'));
  expect(asciiHyphen, 'signed numbers should use U+2212, not a hyphen').toEqual([]);
});

test('should keep Greek intact through a full round trip to the database', async ({
  page,
  seed,
}) => {
  // Given — the encoding path is long: browser → JSON → JDBC → Postgres → back. A single
  // mis-set charset anywhere turns Μαρία into ÎœÎ±ÏÎ¯Î±, and the place it shows is the client's name.
  await page.goto(`/client/${seed.clientId}/journal`);
  await page.waitForSelector('.entry');

  await expect(page.locator('.entry__content').first()).toHaveText(
    'ΠΡΟΣΟΧΗ: δυσκολία με το βραδινό γεύμα.',
  );

  await page.goto(`/client/${seed.clientId}`);
  await expect(page.locator('.page-title')).toHaveText(seed.clientName);
});

test('should name each page in its title', async ({ page, seed }) => {
  /*
    Every route was titled "Ivi", which makes the back button, a row of open tabs and the history
    list equally useless, and gives a screen reader the same word to announce after every
    navigation. WCAG 2.4.2.

    The first version of this test asked whether the title was *Greek*, which was the wrong
    question — "Ivi" is a brand name and Latin script is fine. What was actually missing is any
    indication of which page you are on.
  */
  await page.goto(`/client/${seed.clientId}`);
  await expect(page).toHaveTitle('Καρτέλα πελάτη · Ivi');

  await page.goto(`/client/${seed.clientId}/plan/${seed.planId}`);
  await expect(page).toHaveTitle('Πλάνο διατροφής · Ivi');

  await page.goto('/food');
  await expect(page).toHaveTitle('Τρόφιμα · Ivi');
});

test('should keep the client name out of the document title', async ({ page, seed }) => {
  /*
    The obvious "descriptive" title would name the client. It is the wrong call: a document title
    goes into browser history, the OS window title and the task switcher, so a named person
    receiving dietetic care would be written into places this application neither controls nor can
    erase. Naming the kind of page satisfies the guideline without leaking Article 9 data onto the
    desktop.
  */
  await page.goto(`/client/${seed.clientId}`);
  await expect(page).not.toHaveTitle(new RegExp(seed.clientName));
});
