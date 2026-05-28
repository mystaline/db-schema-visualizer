import { describe, it, expect, beforeEach } from "vitest";
import { useReportModal } from "../useReportModal";

// Reset the singleton before test suite starts
const { isOpen, open, close } = useReportModal();

describe("useReportModal", () => {
  beforeEach(() => { close(); });

  it("starts closed", () => {
    expect(isOpen.value).toBe(false);
  });

  it("opens the modal", () => {
    open();
    expect(isOpen.value).toBe(true);
  });

  it("closes the modal", () => {
    open();
    close();
    expect(isOpen.value).toBe(false);
  });
});
