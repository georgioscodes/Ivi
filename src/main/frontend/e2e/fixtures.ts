import { test as base, expect, type BrowserContext } from '@playwright/test';

/**
 * A signed-in practitioner with a client, a plan and a journal entry, seeded through the API.
 *
 * Seeded rather than clicked because these tests are about the *rendered* result, not about
 * re-testing the flows the component suite already covers. Clicking the setup would make every
 * spec depend on every form, so one broken field would fail the lot and say nothing useful.
 *
 * Each test gets its own practitioner. Tenant isolation is enforced structurally, so a fresh
 * practitioner is a clean database as far as any assertion here can tell — and no test can be
 * affected by another's leftovers.
 */

export interface Seed {
  practitionerEmail: string;
  clientId: number;
  clientName: string;
  planId: number;
  planName: string;
}

/** Greek throughout, including the accented capitals that broke journal search. */
const CLIENT_NAME = 'Μαρία Παπαδοπούλου';
const PLAN_NAME = 'Πλάνο εβδομάδας 1';
const PASSWORD = 'a-sufficiently-long-password';

export const test = base.extend<{ seed: Seed }>({
  seed: async ({ context, baseURL }, use) => {
    // `context.request` and not the standalone `request` fixture: they keep separate cookie jars,
    // so a CSRF token read from the browser context would be sent with a request that never
    // received it. Sharing the jar is also what lets the seeded session carry into `page`.
    const api = new Api(context, baseURL ?? 'http://localhost:8080');
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.gr`;

    await api.csrf();
    await api.post('/practitioner/registration', {
      email,
      password: PASSWORD,
      displayName: 'Δρ. Ελένη Νικολάου',
      practiceName: 'Διατροφή & Ζωή',
    });
    // Registration establishes no session — the same register-then-login the UI does.
    await api.csrf();
    await api.post('/auth/login', { email, password: PASSWORD });
    await api.csrf();

    const client = await api.post('/client', {
      fullName: CLIENT_NAME,
      email: 'maria@example.gr',
      goal: 'Απώλεια βάρους',
    });

    const plan = await api.post('/plan', {
      clientId: client.id,
      name: PLAN_NAME,
      dayCount: 3,
      targetKcal: 2000,
      targetProteinG: 120,
      targetCarbohydrateG: 250,
      targetFatG: 67,
    });

    /*
      Two foods in the *same* meal on day 0, so reordering has something to reorder — the first
      version of this seeded them into two different meals and the keyboard-reorder test skipped
      itself silently, which looks identical to passing in a run summary. Day 1 is deliberately
      heavy so the over-target path renders too.
    */
    const foods = await api.get('/food?size=20');
    const add = (mealId: number, food: { id: number; portions?: { id: number }[] }, quantity: number) =>
      api.post(`/plan/${plan.id}/meal/${mealId}/item`, {
        foodId: food.id,
        portionId: food.portions?.[0]?.id ?? null,
        quantity,
      });

    await add(plan.days[0].meals[0].id, foods.content[0], 1);
    await add(plan.days[0].meals[0].id, foods.content[1], 2);
    await add(plan.days[0].meals[2].id, foods.content[3], 1);
    await add(plan.days[1].meals[0].id, foods.content[2], 20);

    await api.patch(`/plan/${plan.id}/notes`, {
      notes: 'Καθημερινά 2 λίτρα νερό.\nΕναλλακτικά: γιαούρτι αντί για τυρί.',
    });

    await api.post('/journal', {
      clientId: client.id,
      entryDate: '2026-08-11',
      title: 'Επανέλεγχος',
      content: 'ΠΡΟΣΟΧΗ: δυσκολία με το βραδινό γεύμα.',
    });

    await use({
      practitionerEmail: email,
      clientId: client.id,
      clientName: CLIENT_NAME,
      planId: plan.id,
      planName: PLAN_NAME,
    });
  },
});

export { expect };

/** The API, with the CSRF dance the application requires of every unsafe request. */
class Api {
  private token = '';

  constructor(
    private readonly context: BrowserContext,
    private readonly baseUrl: string,
  ) {}

  private get request() {
    return this.context.request;
  }

  /** Re-read after every authentication step: logging in rotates the token. */
  async csrf() {
    await this.request.get(`${this.baseUrl}/actuator/health`);
    const cookie = (await this.context.cookies()).find((c) => c.name === 'XSRF-TOKEN');
    this.token = cookie?.value ?? '';
  }

  async get(path: string) {
    const response = await this.request.get(`${this.baseUrl}/api/v1${path}`);
    expectOk(response.status(), 'GET', path, await response.text());
    return response.json();
  }

  async post(path: string, data: unknown) {
    const response = await this.request.post(`${this.baseUrl}/api/v1${path}`, {
      data,
      headers: { 'X-XSRF-TOKEN': this.token },
    });
    expectOk(response.status(), 'POST', path, await response.text());
    return response.status() === 204 ? null : response.json();
  }

  async patch(path: string, data: unknown) {
    const response = await this.request.patch(`${this.baseUrl}/api/v1${path}`, {
      data,
      headers: { 'X-XSRF-TOKEN': this.token },
    });
    expectOk(response.status(), 'PATCH', path, await response.text());
    return response.json();
  }
}

/**
 * Fails loudly at the point of the bad call. A fixture that half-succeeds produces assertion
 * failures three files away, about missing elements, for a plan that was never created.
 */
function expectOk(status: number, method: string, path: string, body: string) {
  if (status >= 400) {
    throw new Error(`Seed failed: ${method} ${path} -> ${status}\n${body.slice(0, 300)}`);
  }
}
