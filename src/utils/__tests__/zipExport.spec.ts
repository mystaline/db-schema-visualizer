import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildZipBlob, downloadZip } from "../zipExport";

describe("buildZipBlob", () => {
  it("returns a Blob for a non-empty file list", async () => {
    const blob = await buildZipBlob([
      { name: "users.sql", content: "CREATE TABLE users();" },
      { name: "orders.sql", content: "CREATE TABLE orders();" },
    ]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("rejects when given an empty file list", async () => {
    await expect(buildZipBlob([])).rejects.toThrow(/no files/i);
  });
});

describe("downloadZip", () => {
  beforeEach(() => {
    // Mock URL + anchor click side effects so the test runs cleanly in happy-dom.
    window.URL.createObjectURL = vi.fn(() => "blob:mock");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("packs files into a zip blob and triggers a download", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    await downloadZip(
      [
        { name: "users.sql", content: "CREATE TABLE users();" },
        { name: "orders.sql", content: "CREATE TABLE orders();" },
      ],
      "schema_export.zip",
    );
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("rejects when given an empty file list", async () => {
    await expect(downloadZip([], "x.zip")).rejects.toThrow(/no files/i);
  });
});
