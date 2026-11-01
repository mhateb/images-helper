/** In-memory handoff of files from Analyze → Tool (same SPA session). */
let pendingFiles: File[] | null = null;

export function setHandoffFiles(files: File[]): void {
  pendingFiles = files.length > 0 ? files : null;
}

export function takeHandoffFiles(): File[] | null {
  const files = pendingFiles;
  pendingFiles = null;
  return files;
}
