import '@testing-library/jest-dom/vitest';

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
