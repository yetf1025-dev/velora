/**
 * 渲染调度器:限制 Mermaid/SVG 等 CPU 密集渲染的并发,避免 100 个 NodeView
 * 同时触发导致主线程卡顿。
 *
 * 策略:每个任务经 requestIdleCallback(回退 requestAnimationFrame)调度,
 * 同一帧最多跑 maxPerFrame 个,让出主线程保证编辑/输入流畅。
 */

type Task = () => Promise<void> | void;

const queue: Task[] = [];
let running = false;
const maxPerFrame = 3; // 每帧(约 16ms)最多完成 3 个渲染

function scheduleNext() {
  if (queue.length === 0) {
    running = false;
    return;
  }
  const run = (idle?: IdleDeadline) => {
    running = true;
    let count = 0;
    const runBatch = async () => {
      while (queue.length > 0 && count < maxPerFrame) {
        // 空闲时间用尽(或帧预算)则让出
        if (idle && idle.timeRemaining && idle.timeRemaining() < 2) break;
        count++;
        const task = queue.shift()!;
        await task();
      }
      if (queue.length > 0) {
        scheduleNext();
      } else {
        running = false;
      }
    };
    void runBatch();
  };

  // 优先 requestIdleCallback(空闲时渲染),回退 rAF
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run);
  } else {
    requestAnimationFrame(() => run());
  }
}

/** 排入一个渲染任务,按调度执行 */
export function scheduleRender(task: Task): void {
  queue.push(task);
  if (!running) scheduleNext();
}
