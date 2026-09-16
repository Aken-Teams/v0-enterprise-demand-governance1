import mermaid from "mermaid"

/**
 * Mermaid 全域設定——**唯一**的初始化來源。
 *
 * 先前需求詳情頁、分享頁、範本頁各自呼叫 mermaid.initialize()，
 * mermaid 是單例，誰後載入誰生效，改了共用設定卻看不出效果。
 * 所有要渲染 Mermaid 的地方一律 `import "@/lib/mermaid-config"`。
 *
 * 配色：原本的 neutral 主題整張圖是灰白的，節點一多就分不出層次；
 * 改用 base 主題並自訂色票，由 base 推導節點、子圖、序列圖各自的顏色。
 * 色票取自介面既有的藍／琥珀／綠，與系統其他圖表一致。
 */
mermaid.initialize({
  startOnLoad: false,
  suppressErrorRendering: true,
  securityLevel: "loose",
  theme: "base",
  themeVariables: {
    background: "transparent",
    fontFamily: "inherit",
    // 主要節點：淡藍底、藍邊、深藍字
    primaryColor: "#dbeafe",
    primaryBorderColor: "#60a5fa",
    primaryTextColor: "#1e3a5f",
    // 次要／第三色：琥珀與綠，讓不同群組的節點區分得開
    secondaryColor: "#fef3c7",
    secondaryBorderColor: "#fbbf24",
    secondaryTextColor: "#78350f",
    tertiaryColor: "#dcfce7",
    tertiaryBorderColor: "#4ade80",
    tertiaryTextColor: "#14532d",
    // 連線與標籤
    lineColor: "#64748b",
    textColor: "#1e293b",
    edgeLabelBackground: "#ffffff",
    // 子圖／群組外框
    clusterBkg: "#f8fafc",
    clusterBorder: "#cbd5e1",
    // 註記（note）
    noteBkgColor: "#fef9c3",
    noteBorderColor: "#facc15",
    noteTextColor: "#713f12",
  },
})

export {}
