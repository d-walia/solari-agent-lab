/**
 * Bounded-concurrency worker pool — the shared spine of every tool in the lab.
 *
 * All three tools do the same thing: fan out N independent jobs across Solari
 * environments, but never more than the plan's concurrency cap at once. This
 * runs them `concurrency` at a time, preserves input order in the results, and
 * settles each job (a thrown job becomes a rejected result, never a lost slot).
 */
export type Settled<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

export async function pool<T>(
  concurrency: number,
  jobs: Array<() => Promise<T>>,
  onSettle?: (index: number, result: Settled<T>) => void,
): Promise<Array<Settled<T>>> {
  // Guard a bad cap (e.g. MAX_CONCURRENCY=abc → NaN): NaN would create zero
  // workers and silently return an all-empty result instead of running anything.
  const n = Math.floor(concurrency);
  const width = Number.isFinite(n) && n > 0 ? n : 1;
  const results = new Array<Settled<T>>(jobs.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= jobs.length) return;
      try {
        results[i] = { ok: true, value: await jobs[i]() };
      } catch (error) {
        results[i] = { ok: false, error };
      }
      onSettle?.(i, results[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(width, jobs.length) }, () => worker()),
  );
  return results;
}
