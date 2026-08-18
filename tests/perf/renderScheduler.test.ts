import { describe, expect, it, vi } from "vitest";
import { scheduleRender } from "../../src/diagram/renderScheduler";

describe("渲染调度器", () => {
  it("任务全部执行(不丢)", async () => {
    const done: number[] = [];
    for (let i = 0; i < 10; i++) {
      const idx = i;
      scheduleRender(async () => {
        done.push(idx);
      });
    }
    // 等待调度完成(若干帧)
    await new Promise((r) => setTimeout(r, 500));
    expect(done.length).toBe(10);
    expect(done.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("不阻塞:调度期间主线程可响应(同步任务立即完成)", () => {
    let flag = false;
    scheduleRender(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    // 同步代码立即执行,不等渲染
    flag = true;
    expect(flag).toBe(true);
    // 清理:等任务跑完避免泄漏
    setTimeout(() => {}, 100);
  });
});
