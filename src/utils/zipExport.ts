import JSZip from "jszip";

export interface ZipFile {
  name: string;
  content: string;
}

/**
 * Packs `files` into a single zip Blob and returns it. Separated from the
 * download-trigger so this step can be unit-tested in isolation.
 */
export async function buildZipBlob(files: ZipFile[]): Promise<Blob> {
  if (files.length === 0) {
    throw new Error("downloadZip: no files to pack");
  }
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.content));
  return zip.generateAsync({ type: "blob" });
}

/**
 * Packs `files` into a single zip blob named `zipName` and triggers a browser
 * download by clicking a transient anchor. Caller is responsible for catching
 * errors and surfacing toasts.
 */
export async function downloadZip(
  files: ZipFile[],
  zipName: string,
): Promise<void> {
  const blob = await buildZipBlob(files);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
