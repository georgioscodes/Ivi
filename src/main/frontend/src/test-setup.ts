/**
 * Registers the jest-dom matchers with Vitest.
 *
 * They express intent that a raw property read does not: `toBeDisabled()` says what is being
 * asserted, where `element.disabled === true` says how it happens to be represented — and
 * `toBeDisabled` also accounts for a disabled ancestor fieldset, which the property does not.
 */
import '@testing-library/jest-dom/vitest';
