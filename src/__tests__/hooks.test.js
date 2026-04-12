// hooks.test.js
// Tests for useWindowWidth custom hook

import { renderHook, act } from "@testing-library/react";
import useWindowWidth from "../hooks/useWindowWidth";

// ============================================================
// useWindowWidth
// ============================================================

describe("useWindowWidth", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("returns initial window width", () => {
    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(1024);
  });

  it("updates width on window resize after debounce", () => {
    const { result } = renderHook(() => useWindowWidth());

    act(() => {
      Object.defineProperty(window, "innerWidth", { value: 800, writable: true, configurable: true });
      window.dispatchEvent(new Event("resize"));
    });

    // Before debounce completes (150ms)
    expect(result.current).toBe(1024);

    // After debounce
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toBe(800);
  });

  it("debounces rapid resize events (only fires once)", () => {
    const { result } = renderHook(() => useWindowWidth());

    act(() => {
      // Fire multiple rapid resizes
      Object.defineProperty(window, "innerWidth", { value: 500, writable: true, configurable: true });
      window.dispatchEvent(new Event("resize"));

      Object.defineProperty(window, "innerWidth", { value: 600, writable: true, configurable: true });
      window.dispatchEvent(new Event("resize"));

      Object.defineProperty(window, "innerWidth", { value: 700, writable: true, configurable: true });
      window.dispatchEvent(new Event("resize"));
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Should reflect the LAST resize value
    expect(result.current).toBe(700);
  });

  it("cleans up event listener on unmount", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useWindowWidth());

    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("reflects mobile breakpoint correctly", () => {
    Object.defineProperty(window, "innerWidth", { value: 400, writable: true, configurable: true });
    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(400);
    expect(result.current < 640).toBe(true); // below MOBILE_BP
  });

  it("reflects desktop width correctly", () => {
    Object.defineProperty(window, "innerWidth", { value: 1920, writable: true, configurable: true });
    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(1920);
    expect(result.current >= 640).toBe(true); // above MOBILE_BP
  });
});
