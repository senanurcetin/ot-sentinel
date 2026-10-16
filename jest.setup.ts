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
      const box: ResizeObserverSize = { inlineSize: 640, blockSize: 360 };
      const rect: DOMRectReadOnly = {
        x: 0, y: 0, width: 640, height: 360,
        top: 0, left: 0, bottom: 360, right: 640,
        toJSON: () => ({}),
      };
      const entry: ResizeObserverEntry = {
        target,
        contentRect: rect,
        contentBoxSize: [box],
        borderBoxSize: [box],
        devicePixelContentBoxSize: [box],
      };
      this.notify([entry], this as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
