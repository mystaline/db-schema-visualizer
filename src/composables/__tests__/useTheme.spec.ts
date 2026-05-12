import { describe, it, expect, beforeEach } from "vitest";
import { nextTick } from "vue";
import { useTheme } from "../useTheme";

const { isDark, toggleTheme } = useTheme();

describe("useTheme", () => {
  beforeEach(() => {
    if (!isDark.value) toggleTheme();
  });

  it("has a boolean isDark value", () => {
    expect(typeof isDark.value).toBe("boolean");
  });

  it("toggles between dark and light", () => {
    const initial = isDark.value;
    toggleTheme();
    expect(isDark.value).toBe(!initial);
    toggleTheme();
    expect(isDark.value).toBe(initial);
  });

  it("reflects correct state after multiple toggles", () => {
    expect(isDark.value).toBe(true);

    toggleTheme();
    expect(isDark.value).toBe(false);

    toggleTheme();
    expect(isDark.value).toBe(true);

    toggleTheme();
    expect(isDark.value).toBe(false);
  });

  it("watch persists preference to localStorage", async () => {
    localStorage.removeItem("schema-vis-theme");

    toggleTheme(); // dark → light
    await nextTick();
    expect(isDark.value).toBe(false);
    expect(localStorage.getItem("schema-vis-theme")).toBe("light");

    toggleTheme(); // light → dark
    await nextTick();
    expect(isDark.value).toBe(true);
    expect(localStorage.getItem("schema-vis-theme")).toBe("dark");
  });

  it("watch toggles the document class", async () => {
    toggleTheme(); // dark → light
    await nextTick();
    expect(document.documentElement.classList.contains("light")).toBe(true);

    toggleTheme(); // light → dark
    await nextTick();
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});
