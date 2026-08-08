"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import JSZip from "jszip"
import {
  MonitorPlay, Upload, Trash2, Loader2, FileCode2, X, FolderOpen, ImageIcon, Maximize2, ArrowLeft, Smartphone,
  Monitor, ChevronLeft, ChevronRight, FileArchive,
} from "lucide-react"

export interface PrototypeScreen {
  id: string
  name: string
  order: number
  hasMobile?: boolean
  screenshotUrl: string | null
}
export interface Prototype {
  id: string
  version: number
  note: string | null
  createdAt: string
  screenCount: number
  screens: PrototypeScreen[]
}

function authFetch(token?: string | null, shareToken?: string) {
  const authQuery = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : ""
  const headers: Record<string, string> = shareToken ? {} : (token ? { Authorization: `Bearer ${token}` } : {})
  return { authQuery, headers }
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "畫面"
}

type PendingScreen = { name: string; html: File; htmlMobile: File | null; shot: File | null }

// 由「路徑 + 檔案」清單（資料夾或 ZIP）建立畫面：每個子資料夾＝一個畫面，_mobile 併為手機版
function buildScreensFromPaths(items: { path: string; file: File }[]): PendingScreen[] {
  const groups = new Map<string, File[]>()
  for (const { path, file } of items) {
    const parts = path.split("/").filter(Boolean)
    const folder = parts.length >= 2 ? parts[parts.length - 2] : "根目錄"
    if (!groups.has(folder)) groups.set(folder, [])
    groups.get(folder)!.push(file)
  }
  const info = new Map<string, { html?: File; shot?: File }>()
  for (const [folder, fs] of groups) {
    info.set(folder, {
      html: fs.find((f) => /\.html?$/i.test(f.name)),
      shot: fs.find((f) => /\.(png|jpe?g|webp)$/i.test(f.name)),
    })
  }
  const out: PendingScreen[] = []
  for (const [folder, v] of info) {
    if (folder.endsWith("_mobile") || !v.html) continue
    const mobile = info.get(`${folder}_mobile`)
    out.push({ name: folder, html: v.html, htmlMobile: mobile?.html ?? null, shot: v.shot ?? null })
  }
  for (const [folder, v] of info) {
    if (!folder.endsWith("_mobile") || !v.html) continue
    const base = folder.replace(/_mobile$/, "")
    if (info.get(base)?.html) continue
    out.push({ name: base, html: v.html, htmlMobile: null, shot: v.shot ?? null })
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant", { numeric: true }))
  return out
}

// ── Panel (card in 文件 tab) ────────────────────────────────────
export function PrototypePanel({
  demandId, token, shareToken, canManage = false, onRefresh, onPreview, watermarkBg,
}: {
  demandId: string
  token?: string | null
  shareToken?: string
  canManage?: boolean
  onRefresh?: () => void
  /** 有提供時：點畫面改由父層在左側預覽窗呈現（不跳自帶 modal） */
  onPreview?: (proto: Prototype, screenId: string) => void
  watermarkBg?: string
}) {
  const [protos, setProtos] = useState<Prototype[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>("")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Prototype | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [modalPreview, setModalPreview] = useState<{ proto: Prototype; screenId: string } | null>(null)

  const { authQuery, headers } = authFetch(token, shareToken)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/demands/${demandId}/prototypes${authQuery}`, { headers })
      const data = await res.json()
      if (res.ok) {
        const list: Prototype[] = data.prototypes ?? []
        setProtos(list)
        setSelectedId((prev) => (list.some((p) => p.id === prev) ? prev : (list[0]?.id ?? "")))
      }
    } catch { /* ignore */ } finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandId, authQuery])

  useEffect(() => { load() }, [load])

  const selected = protos.find((p) => p.id === selectedId) ?? null

  const openScreen = (proto: Prototype, screenId: string) => {
    if (onPreview) onPreview(proto, screenId)
    else setModalPreview({ proto, screenId })
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/prototypes/${deleteTarget.id}`, { method: "DELETE", headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || "刪除失敗"); return }
      toast.success(`已刪除原型 v${deleteTarget.version}`)
      setDeleteTarget(null)
      await load(); onRefresh?.()
    } finally { setDeleting(false) }
  }

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
  }
  if (protos.length === 0 && !canManage) return null

  return (
    <Card>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <MonitorPlay className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold sm:text-base">原型 Prototype</span>
          {protos.length > 0 && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-7 w-auto min-w-[84px] gap-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {protos.map((p) => <SelectItem key={p.id} value={p.id}>v{p.version}（{p.screenCount} 畫面）</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {canManage && selected && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(selected)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {canManage && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-1 h-3.5 w-3.5" />上傳
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">可上傳一組 HTML 畫面供客戶點擊互動預覽（選填、分版本）。</p>

        {selected?.note && (
          <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground" title={selected.note}>{selected.note}</p>
        )}

        {!selected || selected.screens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
            <MonitorPlay className="h-8 w-8 text-muted-foreground/30" />
            {canManage ? "尚無原型，點右上角「上傳」加入 HTML 畫面" : "尚無原型"}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {selected.screens.map((s) => (
              <button key={s.id} type="button" onClick={() => openScreen(selected, s.id)}
                className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:border-indigo-300 hover:shadow-sm">
                <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-muted/40">
                  {s.screenshotUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.screenshotUrl} alt={s.name} className="h-full w-full object-cover object-top" />
                    : <FileCode2 className="h-7 w-7 text-muted-foreground/40" />}
                  <span className="absolute inset-0 flex items-center justify-center bg-indigo-600/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-indigo-600/70 group-hover:opacity-100">
                    <MonitorPlay className="mr-1 h-4 w-4" />預覽
                  </span>
                </div>
                <span className="truncate px-2 py-1.5 text-xs font-medium" title={s.name}>{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {canManage && (
        <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} demandId={demandId} headers={headers} onDone={() => { load(); onRefresh?.() }} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除原型 v{deleteTarget?.version}？</AlertDialogTitle>
            <AlertDialogDescription>將刪除此版本的所有畫面（{deleteTarget?.screenCount} 個 HTML）與截圖，無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doDelete() }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 自帶 modal（僅在未提供 onPreview 時使用，如子公司／分享頁） */}
      {modalPreview && (
        <PrototypePreviewModal demandId={demandId} proto={modalPreview.proto} screenId={modalPreview.screenId}
          token={token} shareToken={shareToken} watermarkBg={watermarkBg}
          onScreenChange={(sid) => setModalPreview((p) => p ? { ...p, screenId: sid } : p)}
          onClose={() => setModalPreview(null)} />
      )}
    </Card>
  )
}

// 網頁版／手機版切換小工具
function VersionToggle({ variant, setVariant, hasMobile }: {
  variant: "web" | "mobile"; setVariant: (v: "web" | "mobile") => void; hasMobile?: boolean
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
      <button onClick={() => setVariant("web")}
        className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition", variant === "web" ? "bg-white font-medium text-indigo-700 shadow-sm" : "text-muted-foreground")}>
        <Monitor className="h-3 w-3" />網頁版
      </button>
      {hasMobile && (
        <button onClick={() => setVariant("mobile")}
          className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition", variant === "mobile" ? "bg-white font-medium text-indigo-700 shadow-sm" : "text-muted-foreground")}>
          <Smartphone className="h-3 w-3" />手機版
        </button>
      )}
    </div>
  )
}

// ── Fullscreen preview modal（放大＝全螢幕，像操作原稿） ─────────
export function PrototypePreviewModal({
  demandId, proto, screenId, token, shareToken, watermarkBg, onScreenChange, onClose,
}: {
  demandId: string; proto: Prototype; screenId: string; token?: string | null; shareToken?: string; watermarkBg?: string
  onScreenChange: (id: string) => void; onClose: () => void
}) {
  const [variant, setVariant] = useState<"web" | "mobile">("web")
  const idx = Math.max(0, proto.screens.findIndex((s) => s.id === screenId))
  const cur = proto.screens[idx]
  useEffect(() => { if (variant === "mobile" && !cur?.hasMobile) setVariant("web") }, [screenId, cur?.hasMobile, variant])
  const go = (delta: number) => {
    const n = (idx + delta + proto.screens.length) % proto.screens.length
    onScreenChange(proto.screens[n].id)
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="left-0 top-0 flex h-screen max-h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-none" showCloseButton={false}>
        {/* 頂部工具列：版本切換 + 畫面導覽 */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
          <DialogTitle className="flex shrink-0 items-center gap-1.5 text-sm">
            <MonitorPlay className="h-4 w-4 text-indigo-600" />原型 v{proto.version}
          </DialogTitle>
          <VersionToggle variant={variant} setVariant={setVariant} hasMobile={cur?.hasMobile} />
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => go(-1)} disabled={proto.screens.length < 2}>
              <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">上一頁</span>
            </Button>
            <Select value={cur?.id} onValueChange={onScreenChange}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[60vh]">
                {proto.screens.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-1.5">{s.name}{s.hasMobile && <Smartphone className="h-3 w-3 text-muted-foreground/50" />}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => go(1)} disabled={proto.screens.length < 2}>
              <span className="hidden sm:inline">下一頁</span><ChevronRight className="h-4 w-4" />
            </Button>
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{idx + 1}/{proto.screens.length}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="關閉"><X className="h-4 w-4" /></Button>
          </div>
        </div>
        {/* 全螢幕預覽 */}
        <PrototypeFrame demandId={demandId} protoId={proto.id} screenId={cur?.id ?? screenId} variant={cur?.hasMobile ? variant : "web"} token={token} shareToken={shareToken} watermarkBg={watermarkBg} />
      </DialogContent>
    </Dialog>
  )
}

// ── Left-pane inline preview（供父層放進預覽窗） ─────────────────
export function PrototypeInlinePreview({
  demandId, proto, screenId, token, shareToken, watermarkBg, onScreenChange, onMaximize, onClose,
}: {
  demandId: string
  proto: Prototype
  screenId: string
  token?: string | null
  shareToken?: string
  watermarkBg?: string
  onScreenChange: (screenId: string) => void
  onMaximize?: () => void
  onClose?: () => void
}) {
  const cur = proto.screens.find((s) => s.id === screenId)
  const [variant, setVariant] = useState<"web" | "mobile">("web")
  useEffect(() => { if (variant === "mobile" && !cur?.hasMobile) setVariant("web") }, [screenId, cur?.hasMobile, variant])
  return (
    <div className="relative flex h-full min-h-[300px] flex-col sm:min-h-[520px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 lg:hidden" onClick={onClose}><ArrowLeft className="h-3.5 w-3.5" /></Button>
          )}
          <MonitorPlay className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
          <span className="truncate text-[10px] font-medium sm:text-xs">v{proto.version} · {cur?.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <VersionToggle variant={variant} setVariant={setVariant} hasMobile={cur?.hasMobile} />
          {onMaximize && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMaximize} title="放大（全螢幕）"><Maximize2 className="h-3.5 w-3.5" /></Button>
          )}
        </div>
      </div>
      {/* Screen switcher */}
      {proto.screens.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b bg-background px-2 py-1.5">
          {proto.screens.map((s) => (
            <button key={s.id} onClick={() => onScreenChange(s.id)}
              className={cn("shrink-0 rounded-md px-2 py-1 text-[11px] transition", s.id === screenId ? "bg-indigo-100 font-medium text-indigo-800" : "text-muted-foreground hover:bg-muted")}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <PrototypeFrame demandId={demandId} protoId={proto.id} screenId={screenId} variant={cur?.hasMobile ? variant : "web"} token={token} shareToken={shareToken} watermarkBg={watermarkBg} />
    </div>
  )
}

// ── Sandboxed iframe that fetches + renders one screen ─────────
// 網頁版＝滿版填滿；手機版＝置中 390px 手機框。內建垂直捲軸（寬度合身→捲軸在畫面上）。
function PrototypeFrame({
  demandId, protoId, screenId, variant, token, shareToken, watermarkBg,
}: {
  demandId: string; protoId: string; screenId: string; variant: "web" | "mobile"
  token?: string | null; shareToken?: string; watermarkBg?: string
}) {
  const [html, setHtml] = useState("")
  const [loading, setLoading] = useState(true)
  const { authQuery, headers } = authFetch(token, shareToken)

  useEffect(() => {
    let alive = true
    setLoading(true); setHtml("")
    const q = variant === "mobile" ? (authQuery ? `${authQuery}&variant=mobile` : "?variant=mobile") : authQuery
    fetch(`/api/demands/${demandId}/prototypes/${protoId}/screens/${screenId}${q}`, { headers })
      .then((r) => r.ok ? r.text() : Promise.reject())
      .then((t) => { if (alive) setHtml(t) })
      .catch(() => { if (alive) setHtml("<div style='font-family:sans-serif;padding:24px;color:#71717a'>無法載入此畫面</div>") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandId, protoId, screenId, variant])

  const isMobile = variant === "mobile"
  return (
    <div className={cn("relative min-h-0 flex-1 overflow-auto", isMobile ? "flex justify-center bg-muted/40 py-3" : "bg-white")}>
      {loading && <div className="absolute inset-0 z-20 flex items-center justify-center bg-white"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      <iframe
        title="原型預覽"
        srcDoc={html}
        className={cn("block border-0 bg-white", isMobile && "self-start rounded-lg shadow-lg")}
        style={isMobile ? { width: 390, minWidth: 390, height: "100%", minHeight: 640 } : { width: "100%", height: "100%" }}
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
      />
      {watermarkBg && <div className="pointer-events-none absolute inset-0 z-10" style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }} />}
    </div>
  )
}

// ── Upload dialog (ZIP / folder / multi-file) ─────────────────
function UploadDialog({
  open, onOpenChange, demandId, headers, onDone,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; demandId: string; headers: Record<string, string>; onDone: () => void
}) {
  const [screens, setScreens] = useState<PendingScreen[]>([])
  const [note, setNote] = useState("")
  const [uploading, setUploading] = useState(false)
  const [reading, setReading] = useState(false)
  const folderRef = useRef<HTMLInputElement | null>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { setScreens([]); setNote(""); setUploading(false); setReading(false) }
  }, [open])

  // 資料夾 input 需在掛載當下就設定 webkitdirectory（useEffect 會太晚 → 變成一般檔案選取）
  const setFolderInput = useCallback((el: HTMLInputElement | null) => {
    folderRef.current = el
    if (el) {
      el.setAttribute("webkitdirectory", "")
      el.setAttribute("directory", "")
      el.setAttribute("mozdirectory", "")
    }
  }, [])

  const handleFolder = (fileList: FileList | null) => {
    const items = Array.from(fileList ?? []).map((f) => ({
      path: (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name,
      file: f,
    }))
    const out = buildScreensFromPaths(items)
    if (out.length === 0) { toast.error("此資料夾內找不到 HTML 檔"); return }
    setScreens(out)
  }

  // ZIP：於瀏覽器解壓 → 重用同一套資料夾分組（避免瀏覽器「上傳資料夾」確認框）
  const handleZip = async (file: File | null) => {
    if (!file) return
    setReading(true)
    try {
      const zip = await JSZip.loadAsync(file)
      const entries = Object.values(zip.files).filter((e) => !e.dir && /\.(html?|png|jpe?g|webp)$/i.test(e.name))
      const items = await Promise.all(entries.map(async (e) => {
        const blob = await e.async("blob")
        const leaf = e.name.split("/").pop() || e.name
        return { path: e.name, file: new File([blob], leaf) }
      }))
      const out = buildScreensFromPaths(items)
      if (out.length === 0) { toast.error("ZIP 內找不到 HTML 檔（需為每個畫面一個子資料夾）"); return }
      setScreens(out)
    } catch {
      toast.error("無法讀取 ZIP 檔")
    } finally {
      setReading(false)
    }
  }

  const handleFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    const htmls = files.filter((f) => /\.html?$/i.test(f.name))
    const shots = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name))
    const shotByBase = new Map<string, File>()
    for (const s of shots) shotByBase.set(baseName(s.name).toLowerCase(), s)
    if (htmls.length === 0) { toast.error("請選擇至少一個 HTML 檔"); return }
    // 以檔名配對 X.html ↔ X_mobile.html
    const htmlByBase = new Map<string, File>()
    for (const h of htmls) htmlByBase.set(baseName(h.name).toLowerCase(), h)
    const out: PendingScreen[] = []
    for (const h of htmls) {
      const base = baseName(h.name)
      if (base.toLowerCase().endsWith("_mobile")) continue
      const mobile = htmlByBase.get(`${base}_mobile`.toLowerCase()) || null
      out.push({ name: base, html: h, htmlMobile: mobile, shot: shotByBase.get(base.toLowerCase()) || null })
    }
    // 孤兒 _mobile
    for (const h of htmls) {
      const base = baseName(h.name)
      if (!base.toLowerCase().endsWith("_mobile")) continue
      const plain = base.replace(/_mobile$/i, "")
      if (htmlByBase.get(plain.toLowerCase())) continue
      out.push({ name: plain, html: h, htmlMobile: null, shot: shotByBase.get(base.toLowerCase()) || null })
    }
    setScreens(out)
  }

  const submit = async () => {
    if (screens.length === 0) { toast.error("請先選擇 HTML 畫面"); return }
    setUploading(true)
    try {
      const fd = new FormData()
      if (note.trim()) fd.append("note", note.trim())
      fd.append("count", String(screens.length))
      screens.forEach((s, i) => {
        fd.append(`html_${i}`, s.html)
        fd.append(`name_${i}`, s.name)
        if (s.htmlMobile) fd.append(`htmlMobile_${i}`, s.htmlMobile)
        if (s.shot) fd.append(`shot_${i}`, s.shot)
      })
      const res = await fetch(`/api/demands/${demandId}/prototypes`, { method: "POST", headers, body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || "上傳失敗"); return }
      toast.success(`已上傳原型 v${data.version}（${data.screens} 畫面）`)
      onOpenChange(false); onDone()
    } finally { setUploading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>上傳原型（新版本）</DialogTitle>
          <DialogDescription className="text-xs">
            每個子資料夾＝一個畫面（含 HTML＋選填截圖）。資料夾名結尾 <b>_mobile</b> 會自動併為該畫面的手機版（如 1._login ＋ 1._login_mobile）。整批＝同一版本。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input ref={zipRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { handleZip(e.target.files?.[0] ?? null); e.target.value = "" }} />
          <input ref={setFolderInput} type="file" className="hidden" onChange={(e) => { handleFolder(e.target.files); e.target.value = "" }} />
          <input ref={filesRef} type="file" accept=".html,.htm,image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = "" }} />

          <Button variant="outline" className="w-full justify-start" onClick={() => zipRef.current?.click()} disabled={reading}>
            {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4 text-indigo-600" />}
            選擇 ZIP 檔（推薦，免瀏覽器確認）
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => folderRef.current?.click()}><FolderOpen className="mr-1.5 h-4 w-4" />選擇資料夾</Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => filesRef.current?.click()}><FileCode2 className="mr-1.5 h-4 w-4" />選擇 HTML 檔</Button>
          </div>

          {screens.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              <p className="mb-1 text-[11px] text-muted-foreground">將建立 {screens.length} 個畫面：</p>
              {screens.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s.name}</span>
                  {s.htmlMobile && <Smartphone className="h-3 w-3 shrink-0 text-indigo-500" aria-label="含手機版" />}
                  {s.shot && <ImageIcon className="h-3 w-3 shrink-0 text-emerald-500" aria-label="含截圖" />}
                  <X className="ml-auto h-3.5 w-3.5 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => setScreens((p) => p.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-medium">版本說明（選填）</p>
            <Textarea rows={2} placeholder="例如：v2 調整登入流程與工作台版面" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>取消</Button>
          <Button onClick={submit} disabled={uploading || screens.length === 0}>
            {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}上傳（{screens.length}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
