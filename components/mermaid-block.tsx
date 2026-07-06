"use client"

import React, { useEffect, useRef, useState } from "react"
import mermaid from "mermaid"

// 全域只需初始化一次；與各頁面設定一致。
mermaid.initialize({
  startOnLoad: false,
  suppressErrorRendering: true,
  securityLevel: "loose",
  theme: "neutral",
  themeVariables: { background: "transparent", primaryColor: "#dbeafe", primaryTextColor: "#1e3a5f", lineColor: "#94a3b8" },
})

/** Mermaid 圖表關鍵字（用來判斷 code fence 是否為圖表，即使語言標成 flowchart/graph…） */
const MERMAID_KEYWORDS = [
  "flowchart", "graph", "sequenceDiagram", "classDiagram", "stateDiagram", "stateDiagram-v2",
  "erDiagram", "journey", "gantt", "pie", "mindmap", "timeline", "gitGraph", "quadrantChart",
  "requirementDiagram", "C4Context", "block-beta", "sankey-beta", "xychart-beta",
]

/** 判斷一段程式碼是否為 Mermaid 圖表 */
export function looksLikeMermaid(lang: string | undefined, code: string): boolean {
  if (lang) return lang === "mermaid" || MERMAID_KEYWORDS.includes(lang)
  const first = code.trim().split(/[\s{(]/)[0]
  return MERMAID_KEYWORDS.includes(first)
}

export function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  useEffect(() => {
    if (!ref.current) return
    setStatus("loading")
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) {
        ref.current.innerHTML = svg
        ref.current.querySelectorAll("svg").forEach((s) => { s.style.background = "transparent"; s.style.maxWidth = "100%" })
      }
      setStatus("ok")
    }).catch(() => {
      if (!ref.current) return
      const pre = document.createElement("pre")
      pre.className = "mermaid"
      pre.textContent = code
      ref.current.innerHTML = ""
      ref.current.appendChild(pre)
      mermaid.run({ nodes: [pre], suppressErrors: true }).then(() => {
        if (ref.current) {
          ref.current.querySelectorAll("svg").forEach((s) => { s.style.background = "transparent"; s.style.maxWidth = "100%" })
          setStatus(ref.current.querySelector("svg") ? "ok" : "error")
        }
      }).catch(() => setStatus("error"))
    })
    return () => { if (ref.current) ref.current.innerHTML = "" }
  }, [code])

  if (status === "error") {
    return (
      <div className="w-full rounded-lg border border-amber-200 bg-amber-50/50 p-4 not-prose">
        <p className="text-xs font-medium text-amber-700 mb-2">此圖表格式無法解析</p>
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-white/60 rounded p-3">{code}</pre>
      </div>
    )
  }
  return <div ref={ref} data-mermaid-container className="flex justify-center not-prose [&_svg]:!bg-transparent" />
}

/** 供 ReactMarkdown 使用的 components：把 Mermaid code fence 渲染成圖表 */
export const mermaidMarkdownComponents = {
  pre({ children }: { children?: React.ReactNode }) {
    if (React.isValidElement(children)) {
      const cp = (children as React.ReactElement).props as { className?: string; children?: React.ReactNode }
      const lang = /language-([\w-]+)/.exec(cp.className || "")?.[1]
      if (looksLikeMermaid(lang, String(cp.children ?? ""))) return <>{children}</>
    }
    return <pre>{children}</pre>
  },
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const lang = /language-([\w-]+)/.exec(className || "")?.[1]
    const code = String(children ?? "").trim()
    if (looksLikeMermaid(lang, code)) return <MermaidBlock code={code} />
    return <code className={className} {...props}>{children}</code>
  },
}
