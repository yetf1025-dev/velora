/**
 * Velora Diagram Theme 注册表
 * 每套主题映射到 mermaid `base` 主题的 themeVariables。
 * 这是 Velora 的差异化资产:不让用户面对 mermaid 默认“工程图”风格。
 */

export interface VeloraDiagramTheme {
  id: string;
  label: string;
  /** 适合的文档色彩模式;auto 表示亮暗皆可 */
  mode: "light" | "dark" | "auto";
  variables: Record<string, string>;
}

export const diagramThemes: VeloraDiagramTheme[] = [
  {
    id: "velora-modern",
    label: "Modern",
    mode: "auto",
    variables: {
      primaryColor: "#eef2ff",
      primaryBorderColor: "#6366f1",
      primaryTextColor: "#1e1b4b",
      lineColor: "#6366f1",
      secondaryColor: "#f0fdf4",
      tertiaryColor: "#fff7ed",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "14px",
    },
  },
  {
    id: "velora-minimal",
    label: "Minimal",
    mode: "light",
    variables: {
      primaryColor: "#ffffff",
      primaryBorderColor: "#a1a1aa",
      primaryTextColor: "#18181b",
      lineColor: "#71717a",
      secondaryColor: "#fafafa",
      tertiaryColor: "#f4f4f5",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "14px",
    },
  },
  {
    id: "velora-enterprise",
    label: "Enterprise",
    mode: "light",
    variables: {
      primaryColor: "#eff6ff",
      primaryBorderColor: "#1d4ed8",
      primaryTextColor: "#1e3a8a",
      lineColor: "#1e40af",
      secondaryColor: "#f8fafc",
      tertiaryColor: "#f1f5f9",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "14px",
    },
  },
  {
    id: "velora-blueprint",
    label: "Blueprint",
    mode: "auto",
    variables: {
      primaryColor: "#1e3a5f",
      primaryBorderColor: "#7dd3fc",
      primaryTextColor: "#e0f2fe",
      lineColor: "#7dd3fc",
      secondaryColor: "#17293f",
      tertiaryColor: "#0f2033",
      background: "#0f2033",
      mainBkg: "#1e3a5f",
      fontFamily: "'SF Mono', Menlo, monospace",
      fontSize: "13px",
    },
  },
  {
    id: "velora-soft",
    label: "Soft",
    mode: "light",
    variables: {
      primaryColor: "#fdf2f8",
      primaryBorderColor: "#f9a8d4",
      primaryTextColor: "#831843",
      lineColor: "#ec4899",
      secondaryColor: "#f0f9ff",
      tertiaryColor: "#fefce8",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "14px",
    },
  },
  {
    id: "velora-dark",
    label: "Dark",
    mode: "dark",
    variables: {
      primaryColor: "#27272b",
      primaryBorderColor: "#818cf8",
      primaryTextColor: "#e4e4e7",
      lineColor: "#818cf8",
      secondaryColor: "#1e1e21",
      tertiaryColor: "#161618",
      background: "#161618",
      mainBkg: "#27272b",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "14px",
    },
  },
];

export const DEFAULT_THEME_ID = "velora-modern";

export function getDiagramTheme(id: string | null | undefined): VeloraDiagramTheme {
  return diagramThemes.find((t) => t.id === id) ?? diagramThemes[0];
}

/** 根据文档亮暗模式挑选默认主题 */
export function resolveThemeId(
  nodeTheme: string | null | undefined,
  colorMode: "light" | "dark",
): string {
  if (nodeTheme) return nodeTheme;
  return colorMode === "dark" ? "velora-dark" : DEFAULT_THEME_ID;
}
