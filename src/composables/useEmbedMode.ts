export function detectEmbedMode(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
