"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"
import { toast } from "sonner"
import { AppLayout } from "@/components/app-layout"
import { mermaidMarkdownComponents } from "@/components/mermaid-block"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { diffLines, diffStats, toHunks, changedSections } from "@/lib/diff"
import {
  FileText, GitCompare, Loader2, Upload, History, ShieldAlert, Trash2, Info,
} from "lucide-react"

interface VersionRow {
  id: string
  seq: number
  versionLabel: string
  title: string
  changeNote: string | null
  createdAt: string
  uploadedBy: { id: string; name: string } | null
}

interface DocPayload extends VersionRow {
  content: string
}

interface PrevPayload {
  seq: number
  versionLabel: string
  content: string
}

type ViewMode = "doc" | "diff"

export default function ProcessPage() {
  const { user, token } = useAuth()
  const isAdmin = user?.role === "admin"

  const [versions, setVersions] = useState<VersionRow[]>([])
  const [doc, setDoc] = useState<DocPayload | null>(null)
  const [previous, setPrevious] = useState<PrevPayload | null>(null)
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ViewMode>("doc")

  // 上傳表單
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [versionLabel, setVersionLabel] = useState("")
  const [title, setTitle] = useState("")
  const [changeNote, setChangeNote] = useState("")
  const [pasted, setPasted] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 浮水印：與需求文件預覽同一套（姓名 + 機密文件）
  const watermarkBg = useMemo(() => {
    const name = user?.name || "使用者"
    const text = `${name}　機密文件`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><text transform="rotate(-30 150 75)" x="150" y="85" font-size="14" fill="rgba(0,0,0,0.07)" text-anchor="middle" font-family="sans-serif">${text}</text></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }, [user?.name])

  const load = useCallback(async (seq?: number) => {
    if (!token) return
    setLoading(true)
    try {
      const url = seq != null ? `/api/process-docs?seq=${seq}` : "/api/process-docs"
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setVersions(data.versions ?? [])
        setDoc(data.doc ?? null)
        setPrevious(data.previous ?? null)
        if (data.doc) setSelectedSeq(data.doc.seq)
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "載入失敗")
      }
    } catch {
      toast.error("網路錯誤")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // 版本差異（與前一版比對）
  const diff = useMemo(() => {
    if (!doc || !previous) return null
    const lines = diffLines(previous.content, doc.content)
    return { lines, stats: diffStats(lines), hunks: toHunks(lines, 3), sections: changedSections(lines) }
  }, [doc, previous])

  const handleUpload = async () => {
    if (!token) return
    if (!versionLabel.trim()) { toast.error("請填寫版本號"); return }
    if (!pasted.trim() && !file) { toast.error("請上傳 .md 檔或貼上文件內容"); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("versionLabel", versionLabel.trim())
      fd.append("title", title.trim())
      fd.append("changeNote", changeNote.trim())
      if (pasted.trim()) fd.append("content", pasted.trim())
      else if (file) fd.append("file", file)

      const res = await fetch("/api/process-docs", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (res.ok) {
        toast.success("已建立新版本")
        setUploadOpen(false)
        setVersionLabel(""); setTitle(""); setChangeNote(""); setPasted(""); setFile(null)
        await load()
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "上傳失敗")
      }
    } catch {
      toast.error("網路錯誤")
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteLatest = async () => {
    if (!token || !doc) return
    if (!confirm(`確定刪除最新版本 ${doc.versionLabel}？此操作無法復原。`)) return
    try {
      const res = await fetch(`/api/process-docs?seq=${doc.seq}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) { toast.success("已刪除"); await load() }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "刪除失敗") }
    } catch { toast.error("網路錯誤") }
  }

  const isLatest = doc != null && versions.length > 0 && doc.seq === versions[0].seq

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
              開發流程
            </h1>
            <p className="text-xs sm:text-base text-muted-foreground">
              雙方共同遵循的開案與開發流程規範，作為流程認定的依據
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {doc && isLatest && (
                <Button variant="outline" size="sm" className="h-9 text-red-600 border-red-200 hover:bg-red-50" onClick={handleDeleteLatest}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />刪除此版
                </Button>
              )}
              <Button size="sm" className="h-9" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" />上傳新版本
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />載入中…
          </CardContent></Card>
        ) : !doc ? (
          <Card><CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">尚未上傳流程文件</p>
            {isAdmin && <p className="text-xs text-muted-foreground mt-1">請點右上角「上傳新版本」建立第一版</p>}
          </CardContent></Card>
        ) : (
          <>
            {/* 版本列 */}
            <Card>
              <CardContent className="p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs sm:text-sm text-muted-foreground">版本</span>
                  </div>
                <Select value={String(selectedSeq ?? "")} onValueChange={(v) => load(Number(v))}>
                  <SelectTrigger className="h-8 w-auto min-w-[220px] text-xs sm:text-sm gap-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={String(v.seq)} className="text-xs sm:text-sm">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium">{v.versionLabel}</span>
                          {v.seq === versions[0].seq && <Badge className="text-[10px] bg-emerald-100 text-emerald-700">最新</Badge>}
                          <span className="text-muted-foreground">
                            {new Date(v.createdAt).toLocaleDateString("zh-TW")}
                            {v.uploadedBy ? ` · ${v.uploadedBy.name}` : ""}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!isLatest && (
                  <Badge className="bg-amber-100 text-amber-700 text-[10px] sm:text-xs">檢視歷史版本</Badge>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="sm" variant={mode === "doc" ? "default" : "ghost"}
                    className="h-8 text-xs" onClick={() => setMode("doc")}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" />文件
                  </Button>
                  <Button
                    size="sm" variant={mode === "diff" ? "default" : "ghost"}
                    className="h-8 text-xs" onClick={() => setMode("diff")}
                    disabled={!previous}
                    title={previous ? undefined : "第一版沒有可比對的前一版"}
                  >
                    <GitCompare className="h-3.5 w-3.5 mr-1" />
                    版本差異
                    {diff && !diff.stats.identical && (
                      <span className="ml-1 text-[10px]">
                        <span className="text-emerald-600">+{diff.stats.added}</span>
                        {" "}
                        <span className="text-red-600">−{diff.stats.removed}</span>
                      </span>
                    )}
                  </Button>
                  </div>
                </div>

                {/* 本版修改摘要：與版本資訊同屬「這一版是什麼」，不另開卡片 */}
                {doc.changeNote && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-indigo-800 mb-1 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" />{doc.versionLabel} 修改摘要
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line">{doc.changeNote}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {mode === "doc" ? (
              <Card className="relative overflow-hidden">
                {/* 浮水印疊層：不攔截捲動與點擊 */}
                <div
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }}
                />
                <CardContent
                  className={cn("p-4 sm:p-6", !isAdmin && "select-none")}
                  onContextMenu={(e) => { if (!isAdmin) e.preventDefault() }}
                >
                  <div className="prose prose-sm sm:prose-base prose-neutral max-w-none
                    prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1
                    prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1
                    prose-img:rounded-lg prose-headings:scroll-mt-20">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      rehypePlugins={[rehypeRaw]}
                      remarkRehypeOptions={{ allowDangerousHtml: true }}
                      components={mermaidMarkdownComponents}
                    >
                      {doc.content}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <DiffView
                diff={diff}
                fromLabel={previous?.versionLabel ?? ""}
                toLabel={doc.versionLabel}
                watermarkBg={watermarkBg}
                selectable={isAdmin}
              />
            )}

            <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              本文件為線上檢視之機密規範，不提供下載；內容以最新版本為準。
            </p>
          </>
        )}
      </div>

      {/* 上傳新版本 */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!uploading) setUploadOpen(o) }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>上傳新版本</DialogTitle>
            <DialogDescription>
              可上傳 .md 檔或直接貼上內容。送出後會自動與前一版比對差異，供各方查看改了哪些區塊。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">版本號 <span className="text-red-500">*</span></Label>
                <Input value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="例如 v1.4" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">文件標題</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="留空沿用上一版" className="h-8" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">本版修改摘要</Label>
              <Textarea value={changeNote} onChange={(e) => setChangeNote(e.target.value)} rows={2}
                placeholder="例如：MVP 架構確認次數改為三次、新增結案 SP 需董事會簽核" className="text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">上傳 .md 檔</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1" />選擇檔案
                </Button>
                <span className="text-xs text-muted-foreground truncate">{file?.name || "尚未選擇"}</span>
                {file && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = "" }}>
                    清除
                  </Button>
                )}
              </div>
              <input
                ref={fileRef} type="file" accept=".md,.markdown,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPasted("") } }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">或直接貼上 Markdown</Label>
              <Textarea
                value={pasted}
                onChange={(e) => { setPasted(e.target.value); if (e.target.value.trim()) setFile(null) }}
                rows={8} placeholder="貼上 Markdown 內容…（與上傳檔案擇一）" className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">兩者擇一即可；若同時提供，以貼上的內容為準。</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={uploading} onClick={() => setUploadOpen(false)}>取消</Button>
            <Button disabled={uploading} onClick={handleUpload}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              建立版本
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

/** 版本差異檢視：GitHub 風格的行級對照 */
function DiffView({ diff, fromLabel, toLabel, watermarkBg, selectable }: {
  diff: { lines: ReturnType<typeof diffLines>; stats: ReturnType<typeof diffStats>; hunks: ReturnType<typeof toHunks>; sections: string[] } | null
  fromLabel: string
  toLabel: string
  watermarkBg: string
  selectable: boolean
}) {
  if (!diff) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">第一版沒有可比對的前一版</CardContent></Card>
  }
  if (diff.stats.identical) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">與前一版內容相同</CardContent></Card>
  }

  return (
    <div className="space-y-3">
      {/* 摘要：改了哪些區塊 */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
            <Badge variant="outline" className="font-mono">{fromLabel}</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge className="font-mono bg-indigo-100 text-indigo-700">{toLabel}</Badge>
            <span className="ml-2 text-emerald-600 font-medium">+{diff.stats.added} 行</span>
            <span className="text-red-600 font-medium">−{diff.stats.removed} 行</span>
          </div>
          {diff.sections.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">變更區塊</p>
              <div className="flex flex-wrap gap-1.5">
                {diff.sections.map((s) => (
                  <span key={s} className="text-[11px] rounded border bg-muted/40 px-1.5 py-0.5">{s}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 逐行差異 */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-10" style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }} />
        <CardContent
          className={cn("p-0", !selectable && "select-none")}
          onContextMenu={(e) => { if (!selectable) e.preventDefault() }}
        >
          <div className="overflow-x-auto">
            {diff.hunks.map((h, hi) => (
              <div key={hi} className="border-b last:border-b-0">
                <div className="bg-muted/50 px-3 py-1 text-[11px] font-mono text-muted-foreground">
                  @@ 舊版 第 {h.oldStart} 行 · 新版 第 {h.newStart} 行 @@
                </div>
                <table className="w-full border-collapse font-mono text-[11px] sm:text-xs">
                  <tbody>
                    {h.lines.map((l, li) => (
                      <tr
                        key={li}
                        className={cn(
                          l.op === "add" && "bg-emerald-50",
                          l.op === "del" && "bg-red-50",
                        )}
                      >
                        <td className="w-10 sm:w-12 select-none text-right pr-2 text-muted-foreground/50 align-top">{l.oldNo ?? ""}</td>
                        <td className="w-10 sm:w-12 select-none text-right pr-2 text-muted-foreground/50 align-top">{l.newNo ?? ""}</td>
                        <td className={cn(
                          "w-4 select-none text-center align-top font-bold",
                          l.op === "add" && "text-emerald-600",
                          l.op === "del" && "text-red-600",
                        )}>
                          {l.op === "add" ? "+" : l.op === "del" ? "−" : ""}
                        </td>
                        <td className="py-0.5 pr-3 whitespace-pre-wrap break-words align-top">{l.text || " "}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
