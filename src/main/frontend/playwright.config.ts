import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, against the real jar and a real Postgres.
 *
 * Not a second unit-test suite. Everything these check is something the component tests cannot
 * see: that a font actually loaded rather than fell back, what colour a rule really computes to,
 * where focus lands after a dialog closes, and whether a page scrolls sideways on a tablet. Every
 * one of those has to be measured in a browser, and most of the defects found while building this
 * application were found exactly that way.
 *
 * The application is expected to be running already. Starting it from here would mean owning the
 * database lifecycle too, and a suite that boots Postgres is a suite nobody runs locally.
 */
/**
 * Set `IVI_CHROMIUM` when the machine already has a Chromium that Playwright did not install —
 * a container with a prebuilt browser, or a CI image that pins its own. Left unset, Playwright
 * uses the build it manages itself, which is what `npx playwright install` provides. Without the
 * escape hatch a version bump here means "download a browser" on a machine that has one.
 */
const executablePath = process.env.IVI_CHROMIUM;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: './e2e',
  // Distinct from the unit suite's `*.test.ts`, so vitest and Playwright never pick up each
  // other's files — they use incompatible runners and the failure is baffling when they do.
  testMatch: '**/*.spec.ts',

  // The stack is shared and seeded per test, so parallel workers would race over each other's
  // fixtures. Correctness first; the whole suite is seconds either way.
  workers: 1,
  fullyParallel: false,

  // A failing assertion here is a defect, not a flake to be papered over.
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.IVI_BASE_URL ?? 'http://localhost:8080',
    // el-GR because half of what is being checked is Greek rendering, and because a native date
    // input takes its format from the browser rather than from the page.
    locale: 'el-GR',
    timezoneId: 'Europe/Athens',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, launchOptions },
    },
    {
      /*
        An explicitly supported way of working, not an afterthought: a dietitian takes a tablet
        into the consultation room. Chromium with an iPad's viewport rather than the `iPad (gen 7)`
        device, which selects WebKit — the layout is what is under test here, and requiring a
        second browser engine would mean the suite does not run at all where only one is installed.
      */
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 810, height: 1080 },
        isMobile: false,
        hasTouch: true,
        launchOptions,
      },
      testMatch: '**/layout.spec.ts',
    },
  ],
});
