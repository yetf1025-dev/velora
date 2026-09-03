/**
 * 解析相对当前文档的资源路径(浏览器环境无 path 库,手写规范化)。
 *
 * Windows 下文档绝对路径与引用路径都可能是反斜杠,必须先统一成 "/"
 * 再折叠;否则 lastIndexOf("/") 找不到分隔符,切出的 baseDir 是截断的
 * 乱路径,后续 readTextFile 必然失败(SVG 加载失败事故)。
 * 盘符开头的绝对路径(D:/x)不加前导 "/",其余按 POSIX 绝对路径补 "/"。
 */

/** 折叠路径段:. / 空段忽略,.. 弹栈;按首段是否盘符决定前导斜杠 */
function fold(p: string): string {
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return /^[A-Za-z]:$/.test(out[0] ?? "") ? out.join("/") : "/" + out.join("/");
}

export function resolveRelative(baseFile: string, rel: string): string {
  const base = baseFile.replace(/\\/g, "/");
  const r = rel.replace(/\\/g, "/");
  // 绝对引用(POSIX /、Windows 盘符 D:/)直接规范化
  if (r.startsWith("/") || /^[A-Za-z]:\//.test(r)) return fold(r);
  const cut = base.lastIndexOf("/");
  const baseDir = cut === -1 ? "" : base.slice(0, cut);
  return fold(baseDir + "/" + r);
}

/**
 * 文件所在目录(规范化为正斜杠;无分隔符的裸文件名返回 null)。
 * Windows 反斜杠路径同样正确(切父目录别再手写 lastIndexOf("/"),
 * 否则会重蹈 resolveRelative 的截断事故)。
 */
export function parentDir(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  const cut = normalized.lastIndexOf("/");
  if (cut <= 0) return null;
  return normalized.slice(0, cut);
}
