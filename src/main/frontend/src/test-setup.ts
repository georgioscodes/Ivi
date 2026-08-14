/**
 * Registers the jest-dom matchers with Vitest.
 *
 * They express intent that a raw property read does not: `toBeDisabled()` says what is being
 * asserted, where `element.disabled === true` says how it happens to be represented — and
 * `toBeDisabled` also accounts for a disabled ancestor fieldset, which the property does not.
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Unmounts whatever the last test rendered.
 *
 * Testing Library only registers this itself when Vitest runs with `globals: true`, which this
 * project does not — so without it every file has to remember `afterEach(cleanup)`, and the file
 * that forgets does not fail cleanly. It fails on the *next* test with "found multiple elements",
 * pointing at a query that is perfectly correct, about a component that rendered a test ago.
 */
afterEach(cleanup);
