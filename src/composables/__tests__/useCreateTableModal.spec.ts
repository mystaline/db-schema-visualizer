import { describe, it, expect, beforeEach } from "vitest";
import { useCreateTableModal } from "../useCreateTableModal";

// Reset the singleton before test suite starts
const { isOpen, closable, close } = useCreateTableModal();

describe("useCreateTableModal", () => {
  beforeEach(() => {
    close();
  });

  it("starts closed", () => {
    expect(isOpen.value).toBe(false);
  });

  it("opens with default closable flag", () => {
    const { open } = useCreateTableModal();
    open();

    expect(isOpen.value).toBe(true);
    expect(closable.value).toBe(false);
  });

  it("opens with closable=true when caller passes true", () => {
    const { open } = useCreateTableModal();
    open(true);

    expect(isOpen.value).toBe(true);
    expect(closable.value).toBe(true);
  });

  it("opens with closable=false when caller passes false", () => {
    const { open } = useCreateTableModal();
    open(false);

    expect(isOpen.value).toBe(true);
    expect(closable.value).toBe(false);
  });

  it("closes the modal", () => {
    const { open, close: closeFn } = useCreateTableModal();
    open();
    expect(isOpen.value).toBe(true);

    closeFn();
    expect(isOpen.value).toBe(false);
  });
});
