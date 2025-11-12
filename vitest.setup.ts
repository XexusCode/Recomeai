import "@testing-library/jest-dom/vitest";

class ResizeObserverPolyfill {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe() {
    // no-op for tests
  }

  unobserve() {
    // no-op for tests
  }

  disconnect() {
    // no-op for tests
  }
}

if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  // @ts-expect-error -- polyfill assignment for test environment
  window.ResizeObserver = ResizeObserverPolyfill;
}

