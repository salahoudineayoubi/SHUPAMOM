/**
 * SM-2 spaced repetition (SuperMemo 2). quality: 0–5 (≥3 = recalled).
 * Pure function so it can be unit-tested and reused by the coach.
 */
export type SrsState = { ease: number; intervalDays: number; repetitions: number };

export function sm2(state: SrsState, quality: number): SrsState & { dueInDays: number } {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease, intervalDays, repetitions } = state;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(intervalDays * ease);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { ease: Number(ease.toFixed(2)), intervalDays, repetitions, dueInDays: intervalDays };
}
