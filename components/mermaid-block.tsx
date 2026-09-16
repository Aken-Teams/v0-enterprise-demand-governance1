"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import mermaid from "mermaid"
import { Maximize2, X } from "lucide-react"
import "@/lib/mermaid-config"


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
  /** 保留渲染後的 SVG，供放大檢視重繪 */
  const [svg, setSvg] = useState("")
  const [zoomed, setZoomed] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    setStatus("loading")
    setSvg("")
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) {
        ref.current.innerHTML = svg
        ref.current.querySelectorAll("svg").forEach((s) => { s.style.background = "transparent"; s.style.maxWidth = "100%" })
      }
      setSvg(svg)
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
          setSvg(ref.current.innerHTML)
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
  /**
   * 放大後的寬度：以圖表原始寬度的兩倍為準，上限為視窗寬度的 75%。
   *
   * 直接讓 SVG 撐滿覆蓋層的話，兩三個節點的小圖會被拉成整片畫面、字大到荒謬；
   * 反之只用原始尺寸又等於沒放大。故以倍率放大並設上限，大圖縮在 75% 內、
   * 小圖也真的變大。
   */
  const zoomWidth = useMemo(() => {
    const natural = Number(/max-width:\s*([\d.]+)px/.exec(svg)?.[1] ?? 0)
    const cap = typeof window === "undefined" ? 1200 : window.innerWidth * 0.75
    if (!natural) return cap
    return Math.min(natural * 2, cap)
  }, [svg])

  return (
    <>
      {/*
        圖表在內文中會被限制高度以免洗版，但流程圖一小就看不清字；
        故整張圖可點擊放大，於覆蓋層以接近全螢幕的尺寸重繪同一份 SVG。
      */}
      <div className="group/mmd relative not-prose">
        <div
          ref={ref}
          data-mermaid-container
          className="flex cursor-zoom-in justify-center [&_svg]:!bg-transparent"
          onClick={() => svg && setZoomed(true)}
          title="點擊放大"
        />
        {svg && (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="absolute right-1 top-1 rounded-md border bg-background/90 p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover/mmd:opacity-100"
            title="放大檢視"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/*
        放大層留在原處、不 portal 到 body：若 portal 出去，在 Radix 對話框內
        會被視為「對話框外的點擊」，按關閉會連整個對話框一起關掉。
        另外對 pointerdown 停止傳遞，避免點擊被外層的關閉偵測吃掉。
      */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6 cursor-zoom-out"
          onClick={() => setZoomed(false)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="max-h-[80vh] overflow-auto rounded-lg bg-white p-6 [&_svg]:!max-w-none [&_svg]:!h-auto [&_svg]:!w-full"
            style={{ width: zoomWidth }}
            onClick={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <button
            type="button"
            className="absolute right-4 top-4 rounded-md bg-white/90 p-2 text-foreground shadow"
            onClick={(e) => { e.stopPropagation(); setZoomed(false) }}
            title="關閉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  )
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
