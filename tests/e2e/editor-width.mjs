// 编辑器列宽公式与边界验证(WebKit + Chromium 双引擎)
// 断言对象:
//   column = 滚动容器的直接子元素(VeloraEditor 里带 padding/maxWidth 的列)
//   真实形态:maxWidth = min(token+96, 100%),border-box 含两侧 padding 48
import { chromium, webkit } from "playwright";

const results = [];
const check = (n, c, d = "") => results.push(`${c ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);

for (const [name, type] of [["webkit", webkit], ["chromium", chromium]]) {
  const browser = await type.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:1420/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const geom = () => page.evaluate(() => {
    // 从 ProseMirror(.velora-editor)向上找滚动容器,列是其第一个子元素
    let sc = document.querySelector(".velora-editor");
    while (sc && !getComputedStyle(sc).overflowY.includes("auto")) sc = sc.parentElement;
    if (!sc) return null;
    const col = sc.firstElementChild;
    return {
      colW: col.getBoundingClientRect().width,
      colMax: getComputedStyle(col).maxWidth,
      avail: sc.clientWidth,
      sw: sc.scrollWidth, cw: sc.clientWidth,
      docOver: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  // ── 场景1:默认宽窗(1080 设置) ──
  let g = await geom();
  check(`[${name}] 默认列宽符合 min(1176, 主区)`, g && g.colW <= Math.min(1176, g.avail) + 1 && g.colW >= Math.min(1176, g.avail) - 33, 
    `列=${Math.round(g.colW)} 主区=${g.avail} (内容区=${Math.round(g.colW) - 96})`);

  // ── 场景2:非法持久化值 clamp 到 1440 ──
  await page.evaluate(() => {
    const raw = localStorage.getItem("velora-prefs");
    const obj = raw ? JSON.parse(raw).state : {};
    obj.editorMaxWidth = 99999;
    localStorage.setItem("velora-prefs", JSON.stringify({ state: obj, version: 0 }));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const token = await page.evaluate(() => document.documentElement.style.getPropertyValue("--vl-editor-width"));
  check(`[${name}] 非法持久化值 clamp→1440px`, token === "1440px", `token=${token}`);
  g = await geom();
  check(`[${name}] 大设置下仍受主区约束`, g.colW <= g.avail + 1, `列=${Math.round(g.colW)} 主区=${g.avail}`);

  // ── 场景3:双面板极宽时列收缩不溢出 ──
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(400);
  g = await geom();
  check(`[${name}] 900px 窗列 ≤ 主区`, g.colW <= g.avail + 1, `列=${Math.round(g.colW)} 主区=${g.avail}`);
  check(`[${name}] 900px 文档无横向溢出`, !g.docOver);

  // ── 场景4:700 极窄,文档级无溢出 ──
  await page.setViewportSize({ width: 700, height: 700 });
  await page.waitForTimeout(400);
  g = await geom();
  check(`[${name}] 700px 文档无横向溢出`, !g.docOver);

  if (!errors.length) check(`[${name}] 无页面错误`, true);
  else check(`[${name}] 无页面错误`, false, errors.slice(0, 2).join("|"));
  await browser.close();
}
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
