function isLocalHost(hostname: string) {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname === "[::1]" || hostname === "[::]") return true;
  const parts = hostname.split(".").map(Number);
  return parts.length === 4 && parts.every(Number.isInteger) && (
    parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

/** Copy a stable meal URL, never a localhost address or browser query/fragment. */
export function sessionInviteUrl(sessionId: string, currentOrigin: string, appUrl?: string) {
  const url = new URL(appUrl || currentOrigin);
  if (url.protocol !== "https:" || isLocalHost(url.hostname) || url.username || url.password ||
      (appUrl && (url.pathname !== "/" || url.search || url.hash))) {
    throw new Error("Open this meal on your published TasteDNA site to share a link that works on another device.");
  }
  return new URL(`/sessions/${encodeURIComponent(sessionId)}`, url.origin).href;
}
