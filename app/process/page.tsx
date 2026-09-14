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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { diffLines, diffStats, toHunks, changedSections } from "@/lib/diff"
import { preprocessMarkdown } from "@/lib/markdown"
import {
  FileText, GitCompare, Loader2, Upload, History, ShieldAlert, Trash2, Info, X, FileUp, ClipboardType, CheckCircle2, ChevronRight,
  Share2, Copy, Check, Link2,
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

interface ShareRow {
  id: string
  token: string
  expiresAt: string
  viewCount: number
  createdAt: string
  createdBy: { id: string; name: string } | null
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
  /** 內容來源：兩種方式擇一，避免同時填造成「以哪個為準」的疑慮 */
  const [sourceMode, setSourceMode] = useState<"file" | "paste">("file")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 分享連結（公開、7 天到期、固定顯示最新版）
  const [shareOpen, setShareOpen] = useState(false)
  const [shares, setShares] = useState<ShareRow[]>([])
  const [shareLoading, setShareLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const shareUrlOf = (t: string) =>
    typeof window === "undefined" ? `/process/share/${t}` : `${window.location.origin}/process/share/${t}`

  const loadShares = useCallback(async () => {
    if (!token) return
    setShareLoading(true)
    try {
      const res = await fetch("/api/process-docs/share", { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setShares((await res.json()).shares ?? [])
    } catch { /* 略過：對話框仍可建立新連結 */ } finally {
      setShareLoading(false)
    }
  }, [token])

  const createShare = async () => {
    if (!token) return
    setCreating(true)
    try {
      const res = await fetch("/api/process-docs/share", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        await loadShares()
        // 建立後直接複製，省去再點一次
        try {
          await navigator.clipboard.writeText(shareUrlOf(data.token))
          setCopiedToken(data.token)
          toast.success("已建立分享連結並複製到剪貼簿")
        } catch {
          toast.success("已建立分享連結")
        }
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "建立失敗")
      }
    } catch {
      toast.error("網路錯誤")
    } finally {
      setCreating(false)
    }
  }

  const revokeShare = async (t: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/process-docs/share?token=${t}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) { toast.success("已撤銷"); await loadShares() }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "撤銷失敗") }
    } catch { toast.error("網路錯誤") }
  }

  const copyShare = async (t: string) => {
    try {
      await navigator.clipboard.writeText(shareUrlOf(t))
      setCopiedToken(t)
      toast.success("已複製連結")
    } catch {
      toast.error("複製失敗，請手動選取")
    }
  }

  const hasContent = sourceMode === "file" ? !!file : !!pasted.trim()
  const canSubmit = !!versionLabel.trim() && hasContent

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
    const hunks = toHunks(lines, 3)
    const sections = changedSections(lines)

    // 依頂層章節收斂：逐條列出所有小節會變成一面牆，
    // 收成「章節 + 變更處數」並可點擊跳轉，才真的幫得上忙。
    const groups: { top: string; count: number; hunkIndex: number }[] = []
    for (const sec of sections) {
      const existing = groups.find((g) => g.top === sec.top)
      if (existing) { existing.count++; continue }
      const hunkIndex = hunks.findIndex((h) => h.lines.includes(sec.firstChanged))
      groups.push({ top: sec.top, count: 1, hunkIndex: hunkIndex < 0 ? 0 : hunkIndex })
    }
    return { lines, stats: diffStats(lines), hunks, sections, groups }
  }, [doc, previous])

  const handleUpload = async () => {
    if (!token) return
    if (!versionLabel.trim()) { toast.error("請填寫版本號"); return }
    if (!hasContent) { toast.error(sourceMode === "file" ? "請選擇 .md 檔" : "請貼上 Markdown 內容"); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("versionLabel", versionLabel.trim())
      fd.append("title", title.trim())
      fd.append("changeNote", changeNote.trim())
      if (sourceMode === "paste") fd.append("content", pasted.trim())
      else if (file) fd.append("file", file)

      const res = await fetch("/api/process-docs", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (res.ok) {
        toast.success("已建立新版本")
        setUploadOpen(false)
        setVersionLabel(""); setTitle(""); setChangeNote(""); setPasted(""); setFile(null); setSourceMode("file")
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
    setDeleting(true)
    try {
      const res = await fetch(`/api/process-docs?seq=${doc.seq}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) { setDeleteOpen(false); toast.success("已刪除"); await load() }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "刪除失敗") }
    } catch { toast.error("網路錯誤") } finally { setDeleting(false) }
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
              {doc && (
                <Button variant="outline" size="sm" className="h-9"
                  onClick={() => { setShareOpen(true); loadShares() }}>
                  <Share2 className="h-3.5 w-3.5 mr-1" />分享
                </Button>
              )}
              <Button size="sm" className="h-9" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" />上傳新版本
              </Button>
              {doc && isLatest && (
                <Button variant="outline" size="sm" className="h-9 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />刪除此版
                </Button>
              )}
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
                      <span className="ml-1.5 text-[10px] font-medium">
                        <span className={mode === "diff" ? "text-emerald-200" : "text-emerald-600"}>+{diff.stats.added}</span>
                        <span className={cn("mx-0.5", mode === "diff" ? "text-primary-foreground/40" : "text-muted-foreground/40")}>/</span>
                        <span className={mode === "diff" ? "text-rose-200" : "text-red-600"}>−{diff.stats.removed}</span>
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
                      {preprocessMarkdown(doc.content)}
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

      {/* 分享連結 */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>分享開發流程</DialogTitle>
            <DialogDescription>
              產生公開連結，供沒有平台帳號者檢視。連結固定顯示<strong>最新版本</strong>，7 天後自動失效。
            </DialogDescription>
          </DialogHeader>


          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {shareLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                <Loader2 className="h-4 w-4 animate-spin inline mr-1" />載入中…
              </p>
            ) : shares.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">目前沒有有效的分享連結</p>
            ) : (
              shares.map((sh) => (
                <div key={sh.id} className="rounded-lg border p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <code className="text-xs truncate flex-1 bg-muted/50 rounded px-1.5 py-0.5">
                      {shareUrlOf(sh.token)}
                    </code>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0"
                      title="複製連結" onClick={() => copyShare(sh.token)}>
                      {copiedToken === sh.token
                        ? <Check className="h-4 w-4 text-emerald-600" />
                        : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost"
                      className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-red-600"
                      title="撤銷連結" onClick={() => revokeShare(sh.token)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pl-5 flex-wrap">
                    <span>{new Date(sh.expiresAt).toLocaleDateString("zh-TW")} 到期</span>
                    <span>已開啟 {sh.viewCount} 次</span>
                    {sh.createdBy && <span>由 {sh.createdBy.name} 建立</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>關閉</Button>
            <Button disabled={creating} onClick={createShare}>
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Share2 className="h-4 w-4 mr-1" />}
              建立新連結
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除版本確認 */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => { if (!deleting) setDeleteOpen(o) }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>刪除版本 {doc?.versionLabel}？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>此操作無法復原，該版本的內容與修改摘要將永久移除。</p>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-800">
                  刪除後，開發流程將回到前一版；若此為唯一版本，頁面會回到「尚未上傳流程文件」。
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteLatest() }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                placeholder="例如：PRD 文件確認次數改為三次、新增結案 SP 需 Scrum Master 簽核" className="text-sm" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">文件內容 <span className="text-red-500">*</span>（擇一）</Label>
              {/* 兩種來源擇一，只顯示選中的那個輸入區，避免誤以為兩個都要填 */}
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {([
                  { k: "file" as const, label: "上傳 .md 檔", Icon: FileUp },
                  { k: "paste" as const, label: "貼上 Markdown", Icon: ClipboardType },
                ]).map(({ k, label, Icon }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSourceMode(k)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      sourceMode === k ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {sourceMode === "file" ? (
                file ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                    <Button
                      type="button" variant="ghost" size="sm"
                      className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-red-600"
                      title="移除檔案"
                      onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = "" }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40 transition-colors py-6 flex flex-col items-center gap-1.5"
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">點擊選擇 .md 檔</span>
                    <span className="text-[11px] text-muted-foreground">支援 .md / .markdown / .txt，上限 500KB</span>
                  </button>
                )
              ) : (
                <Textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={10} placeholder="貼上 Markdown 內容…" className="text-xs font-mono"
                />
              )}
              <input
                ref={fileRef} type="file" accept=".md,.markdown,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {!canSubmit && (
              <span className="text-[11px] text-muted-foreground mr-auto self-center">
                {!versionLabel.trim()
                  ? "請填寫版本號"
                  : sourceMode === "file" ? "請選擇 .md 檔" : "請貼上 Markdown 內容"}
              </span>
            )}
            <Button variant="outline" disabled={uploading} onClick={() => setUploadOpen(false)}>取消</Button>
            <Button disabled={uploading || !canSubmit} onClick={handleUpload}>
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
  diff: {
    lines: ReturnType<typeof diffLines>
    stats: ReturnType<typeof diffStats>
    hunks: ReturnType<typeof toHunks>
    sections: ReturnType<typeof changedSections>
    groups: { top: string; count: number; hunkIndex: number }[]
  } | null
  fromLabel: string
  toLabel: string
  watermarkBg: string
  selectable: boolean
}) {
  // 變更區塊預設收起：多數時候只需看到「改了幾行」，需要導覽時才展開
  const [sectionsOpen, setSectionsOpen] = useState(false)

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
          {diff.groups.length > 0 && (
            <div className="border-t pt-2.5">
              <button
                type="button"
                onClick={() => setSectionsOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", sectionsOpen && "rotate-90")} />
                變更區塊
                <span className="rounded bg-muted px-1.5 py-px text-[11px] font-normal">{diff.groups.length} 個章節</span>
                {!sectionsOpen && (
                  <span className="text-[11px] font-normal text-muted-foreground/60">展開可跳至該處</span>
                )}
              </button>
              <div className={cn("flex flex-wrap gap-1.5 mt-2", !sectionsOpen && "hidden")}>
                {diff.groups.map((g) => (
                  <button
                    key={g.top}
                    type="button"
                    onClick={() => {
                      document.getElementById(`hunk-${g.hunkIndex}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                    className="inline-flex items-center gap-1.5 text-xs rounded-md border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 hover:border-indigo-300 transition-colors px-2 py-1 max-w-full"
                  >
                    <span className="font-medium text-indigo-900 truncate">{g.top}</span>
                    <span className="shrink-0 rounded bg-indigo-200/70 text-indigo-800 text-[10px] px-1">{g.count}</span>
                  </button>
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
              <div key={hi} id={`hunk-${hi}`} className="border-b last:border-b-0 scroll-mt-4">
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
