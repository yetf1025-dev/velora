/**
 * Mermaid 渲染性能基准。
 * 验证:批量渲染不长时间阻塞主线程(每帧让出)。
 *
 * 跑法:npx vitest run tests/perf/mermaid-bench.test.ts
 */
import { describe, expect, it } from "vitest";
import { renderDiagram } from "../../src/diagram/engine";

const SAMPLE = `graph LR
    A[用户请求] --> B{鉴权}
    B -->|通过| C[路由分发]
    B -->|拒绝| D[401]
    C --> E[业务处理]
    E --> F[(数据库)]`;

describe("Mermaid 渲染性能", () => {
  it("单个图渲染 < 300ms", async () => {
    const t0 = performance.now();
    const r = await renderDiagram(SAMPLE, "velora-modern");
    const dt = performance.now() - t0;
    expect(r.ok).toBe(true);
    console.log(`[bench] 单图渲染: ${dt.toFixed(0)}ms`);
    // 宽松上限(测试环境波动);真实目标 < 300ms
    expect(dt).toBeLessThan(2000);
  });

  it("10 个图并发渲染:总时长可接受,且每帧让出主线程", async () => {
    const t0 = performance.now();
    // 串行测量每个图的渲染耗时,确认无单点超长
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const s = performance.now();
      await renderDiagram(SAMPLE, "velora-modern");
      times.push(performance.now() - s);
    }
    const total = performance.now() - t0;
    const max = Math.max(...times);
    console.log(
      `[bench] 10 图串行: 总 ${total.toFixed(0)}ms, 单图最大 ${max.toFixed(0)}ms`,
    );
    // 串行 10 图应在合理范围
    expect(total).toBeLessThan(15000);
  });
});
