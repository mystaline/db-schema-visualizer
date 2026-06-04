import { describe, it, expect, afterEach } from "vitest";
import { detectEmbedMode } from "../useEmbedMode";

describe("detectEmbedMode", () => {
  afterEach(() => {
    Object.defineProperty(window, "top", {
      value: window,
      configurable: true,
      writable: true,
    });
  });

  it("returns false when not in an iframe", () => {
    expect(detectEmbedMode()).toBe(false);
  });

  it("returns true when window.self !== window.top", () => {
    Object.defineProperty(window, "top", {
      value: {} as Window,
      configurable: true,
    });
    expect(detectEmbedMode()).toBe(true);
  });

  it("returns true when window.top access throws (cross-origin parent)", () => {
    Object.defineProperty(window, "top", {
      get() {
        throw new DOMException("Blocked a frame with origin");
      },
      configurable: true,
    });
    expect(detectEmbedMode()).toBe(true);
  });
});
