import type { Grade, Hit } from "./session";

/** 仅覆盖现有四档速度（含原速），不提供自由调节判定宽度 */
export const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

/**
 * 固定真实毫秒容差：由原速（1×）的谱面窗口 45/90/150ms 换算而来。
 * 各档速度下要求相同的手部时间精度，半速成绩可与原速直接比较。
 */
export const REAL_WINDOWS_MS = {
  perfect: 45,
  great: 90,
  good: 150,
} as const;

/** 长按提前松手判定的真实时间容差（沿用原 0.12s 阈值） */
export const HOLD_EARLY_RELEASE_MS = 120;

/** 按真实毫秒误差评级，与速度无关 */
export function grade(realDeltaMs: number): Grade {
  const d = Math.abs(realDeltaMs);
  return d <= REAL_WINDOWS_MS.perfect
    ? "PERFECT"
    : d <= REAL_WINDOWS_MS.great
      ? "GREAT"
      : d <= REAL_WINDOWS_MS.good
        ? "GOOD"
        : "MISS";
}

/** 当前速度下的等效谱面秒窗口（真实毫秒固定，速度越低窗口越宽） */
export function windowsFor(speed: number) {
  return {
    perfect: (REAL_WINDOWS_MS.perfect / 1000) * speed,
    great: (REAL_WINDOWS_MS.great / 1000) * speed,
    good: (REAL_WINDOWS_MS.good / 1000) * speed,
  };
}

/**
 * 谱面秒误差 → 真实毫秒误差。
 * 谱面时钟在暂停期间冻结，暂停占用的真实时间不会进入误差。
 */
export function chartToRealMs(chartDeltaSeconds: number, speed: number) {
  return (chartDeltaSeconds / speed) * 1000;
}

/** 真实毫秒容差 → 当前速度下的等效谱面秒 */
export function realMsToChartSeconds(realMs: number, speed: number) {
  return (realMs / 1000) * speed;
}

export const weight: Record<Grade, number> = {
  PERFECT: 1,
  GREAT: 0.75,
  GOOD: 0.4,
  MISS: 0,
};

export function statistics(hits: Hit[], total: number) {
  let combo = 0,
    maxCombo = 0,
    points = 0;
  for (const hit of hits) {
    combo = hit.grade === "MISS" ? 0 : combo + 1;
    maxCombo = Math.max(maxCombo, combo);
    points += weight[hit.grade];
  }
  return {
    combo,
    maxCombo,
    score: Math.round((points / Math.max(1, total)) * 1000000),
    accuracy: hits.length ? (points / hits.length) * 100 : 100,
  };
}
