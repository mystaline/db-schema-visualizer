import { describe, it, expect, beforeEach, vi } from "vitest";
import { nextTick } from "vue";
import { useToast } from "../useToast";

// Grab the module-level singleton ref before each describe so we can reset it
const { toasts } = useToast();

describe("useToast", () => {
  beforeEach(() => {
    toasts.value = [];
    vi.useFakeTimers();
  });

  it("creates a success toast by default", () => {
    const { toast } = useToast();
    toast("Saved!");

    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].message).toBe("Saved!");
    expect(toasts.value[0].type).toBe("success");
  });

  it("creates an error toast", () => {
    const { toast } = useToast();
    toast("Something failed", "error");

    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].type).toBe("error");
  });

  it("creates an info toast", () => {
    const { toast } = useToast();
    toast("Heads up", "info");

    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].type).toBe("info");
  });

  it("creates a warning toast", () => {
    const { toast } = useToast();
    toast("Be careful", "warning");

    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].type).toBe("warning");
  });

  it("auto-removes toast after 3 seconds", () => {
    const { toast } = useToast();
    toast("Temporary");

    expect(toasts.value).toHaveLength(1);

    vi.advanceTimersByTime(3000);
    expect(toasts.value).toHaveLength(0);
  });

  it("keeps toast before 3 seconds elapse", () => {
    const { toast } = useToast();
    toast("Still here");

    vi.advanceTimersByTime(2999);
    expect(toasts.value).toHaveLength(1);
  });

  it("assigns unique IDs to toasts", () => {
    const { toast } = useToast();
    toast("First");
    toast("Second");

    expect(toasts.value).toHaveLength(2);
    expect(toasts.value[0].id).not.toBe(toasts.value[1].id);
  });

  it("respects custom toast type", () => {
    const { toast } = useToast();
    toast("Custom", "info");

    expect(toasts.value[0].type).toBe("info");
  });

  it("does not remove other toasts when one expires", () => {
    const { toast } = useToast();
    toast("First");
    // Advance past halfway so only "First" timer expires
    vi.advanceTimersByTime(1500);
    toast("Second");

    // Advance past "First" expiry but before "Second"
    vi.advanceTimersByTime(1600);

    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].message).toBe("Second");
  });
});
