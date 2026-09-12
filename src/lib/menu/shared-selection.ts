export interface VersionedMenuCandidate<T> {
  venueId: string;
  version: number;
  observedAt: string;
  validFrom: string;
  validUntil: string | null;
  value: T;
}

const DEFAULT_FRESH_DAYS = 30;

export function selectNewestValidMenus<T>(
  candidates: VersionedMenuCandidate<T>[],
  now = new Date(),
  freshDays = DEFAULT_FRESH_DAYS,
) {
  const selected = new Map<string, VersionedMenuCandidate<T> & { freshness: "fresh" | "stale" }>();
  const nowMs = now.getTime();
  const freshAfter = nowMs - freshDays * 24 * 60 * 60 * 1000;

  for (const candidate of candidates) {
    const startsAt = Date.parse(candidate.validFrom);
    const endsAt = candidate.validUntil ? Date.parse(candidate.validUntil) : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(startsAt) || startsAt > nowMs || endsAt <= nowMs) continue;

    const existing = selected.get(candidate.venueId);
    if (existing && existing.version >= candidate.version) continue;
    selected.set(candidate.venueId, {
      ...candidate,
      freshness: Date.parse(candidate.observedAt) >= freshAfter ? "fresh" : "stale",
    });
  }

  return selected;
}
