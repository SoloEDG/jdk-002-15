import { computed, ref } from "vue";
import type { Lane, Note } from "../../../shared/chart";
import { secondsAt } from "../../../shared/chart";
import type { Hit, Run } from "../../../shared/session";
import {
  chartToRealMs,
  grade,
  HOLD_EARLY_RELEASE_MS,
  realMsToChartSeconds,
  statistics,
  windowsFor,
} from "../../../shared/judgment";

export function useJudgment() {
  const hits = ref<Hit[]>([]),
    held = ref(new Set<Lane>()),
    feedback = ref(""),
    feedbackMs = ref<number | null>(null),
    total = ref(0);
  let run: Run | null = null;
  /** 长按起点误差在按下瞬间换算为真实毫秒并锁定，之后只比较尾端时刻 */
  const holding = new Map<string, { note: Note; realDeltaMs: number }>();
  /** 组合键按首键按下时间计时 */
  const pending = new Map<string, { at: number; lanes: Set<Lane> }>();
  const done = computed(() => new Set(hits.value.map((h) => h.noteId)));
  const stats = computed(() => statistics(hits.value, total.value));

  function finish(n: Note, realDeltaMs: number, miss = false) {
    if (done.value.has(n.id)) return;
    const g = miss ? "MISS" : grade(realDeltaMs);
    hits.value.push({
      noteId: n.id,
      grade: g,
      delta: Math.round(realDeltaMs),
      beat: n.beat,
    });
    feedback.value = g;
    feedbackMs.value = Math.round(realDeltaMs);
    holding.delete(n.id);
    pending.delete(n.id);
  }

  /** 重开即清空上一局的全部误差与提示 */
  function reset(next: Run) {
    run = next;
    hits.value = [];
    held.value = new Set();
    holding.clear();
    pending.clear();
    feedback.value = "";
    feedbackMs.value = null;
    total.value = next.notes.length;
  }

  function down(lane: Lane, time: number) {
    if (!run || held.value.has(lane)) return;
    held.value.add(lane);
    const speed = run.speed;
    const win = windowsFor(speed);
    const n = run.notes.find(
      (n) =>
        n.lanes.includes(lane) &&
        !done.value.has(n.id) &&
        !holding.has(n.id) &&
        Math.abs(secondsAt(n.beat, run!.track.bpm) - time) <= win.good,
    );
    if (!n) return;
    let pressTime = time;
    if (n.lanes.length > 1) {
      const existing = pending.get(n.id);
      const group = existing ?? { at: time, lanes: new Set<Lane>() };
      group.lanes.add(lane);
      pending.set(n.id, group);
      if (group.lanes.size < n.lanes.length) return;
      // 组合首键：以首个按下的键为准，统一换算为真实毫秒
      pressTime = group.at;
    }
    // 谱面时钟暂停时冻结，换算后暂停时间不会混入误差
    const realDeltaMs = chartToRealMs(
      pressTime - secondsAt(n.beat, run.track.bpm),
      speed,
    );
    if (n.duration > 0) holding.set(n.id, { note: n, realDeltaMs });
    else finish(n, realDeltaMs);
  }

  function up(lane: Lane, time: number) {
    held.value.delete(lane);
    if (!run) return;
    const speed = run.speed;
    const earlyLimit = realMsToChartSeconds(HOLD_EARLY_RELEASE_MS, speed);
    for (const h of holding.values()) {
      if (h.note.lanes.includes(lane)) {
        const end = secondsAt(h.note.beat + h.note.duration, run.track.bpm);
        finish(h.note, h.realDeltaMs, time < end - earlyLimit);
      }
    }
  }

  function tick(time: number) {
    if (!run) return;
    const speed = run.speed;
    const win = windowsFor(speed);
    for (const n of run.notes) {
      if (done.value.has(n.id)) continue;
      const target = secondsAt(n.beat, run.track.bpm);
      const h = holding.get(n.id);
      if (h) {
        if (time >= secondsAt(n.beat + n.duration, run.track.bpm))
          finish(n, h.realDeltaMs);
      } else if (time > target + win.good)
        finish(n, chartToRealMs(time - target, speed), true);
    }
  }

  function clearHeld() {
    held.value.clear();
  }

  return {
    hits,
    held,
    feedback,
    feedbackMs,
    done,
    stats,
    reset,
    down,
    up,
    tick,
    clearHeld,
  };
}
