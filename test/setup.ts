import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
// Side-effecting: calls i18next.init(). Most components call useTranslation()
// or read i18next.language directly (src/lib/dates.ts, src/lib/money.ts);
// without this they'd render untranslated keys or throw.
import '../src/i18n/config';

// @testing-library/react's own auto-cleanup only self-registers when it finds
// a global `afterEach` — this repo doesn't set vitest's `test.globals: true`,
// so without this, DOM from one test's render() would leak into the next.
afterEach(cleanup);

// jsdom implements neither of these, and both are read/used synchronously by
// real app code under test: ThemeProvider reads matchMedia on first render,
// and react-aria-components' interactive primitives (Select, Menu, Dialog,
// Autocomplete, the toast queue) expect Resize/IntersectionObserver to exist.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!window.ResizeObserver) {
  window.ResizeObserver = NoopObserver;
}
if (!window.IntersectionObserver) {
  window.IntersectionObserver = NoopObserver as unknown as typeof IntersectionObserver;
}
