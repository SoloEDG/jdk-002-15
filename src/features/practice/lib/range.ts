import type { PracticeConfig } from "../../../shared/session";
import { SPEEDS } from "../../../shared/judgment";
const MIN_SPEED = SPEEDS[0];
const MAX_SPEED = SPEEDS[SPEEDS.length - 1];
export function normalize(
  config: PracticeConfig,
  beats: number,
): PracticeConfig {
  const start = Math.max(
    0,
    Math.min(beats - 4, Math.round(config.start / 4) * 4),
  );
  return {
    enabled: config.enabled,
    speed: Math.max(MIN_SPEED, Math.min(MAX_SPEED, config.speed)),
    start,
    end: Math.max(start + 4, Math.min(beats, Math.round(config.end / 4) * 4)),
  };
}
export function rangeLabel(start: number, end: number) {
  return `${Math.floor(start / 4) + 1} — ${Math.ceil(end / 4)} 小节`;
}
