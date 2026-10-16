// Optional: configure or set up a testing framework before each test
// if you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// jsdom has no ResizeObserver; Recharts needs one to mount.
if (typeof globalThis.ResizeObserver === 'undefined') {
  // jsdom does not calculate element dimensions. Return a deterministic
  // positive size so chart components can exercise their normal render path.
  globalThis.ResizeObserver = class {
    constructor(private readonly notify: ResizeObserverCallback) {}
    observe(target: Element) {
      this.notify([{
        target,
        contentRect: { width: 640, height: 360 },
        contentBoxSize: [{ inlineSize: 640, blockSize: 360 }],
      } as ResizeObserverEntry], this as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
