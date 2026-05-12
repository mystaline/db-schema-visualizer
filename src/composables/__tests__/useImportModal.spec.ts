import { describe, it, expect, beforeEach } from "vitest";
import { useImportModal } from "../useImportModal";

// Reset the singleton before test suite starts
const { closeImport } = useImportModal();

describe("useImportModal", () => {
  beforeEach(() => {
    closeImport();
  });

  it("starts closed", () => {
    const { isImportOpen } = useImportModal();
    expect(isImportOpen.value).toBe(false);
  });

  it("opens the modal", () => {
    const { isImportOpen, openImport } = useImportModal();
    openImport();

    expect(isImportOpen.value).toBe(true);
  });

  it("closes the modal", () => {
    const { isImportOpen, openImport, closeImport: closeFn } = useImportModal();
    openImport();
    expect(isImportOpen.value).toBe(true);

    closeFn();
    expect(isImportOpen.value).toBe(false);
  });

  it("multiple open calls keep it open", () => {
    const { isImportOpen, openImport } = useImportModal();
    openImport();
    openImport();

    expect(isImportOpen.value).toBe(true);
  });

  it("close on already closed does nothing", () => {
    const { isImportOpen } = useImportModal();
    closeImport();

    expect(isImportOpen.value).toBe(false);
  });
});
