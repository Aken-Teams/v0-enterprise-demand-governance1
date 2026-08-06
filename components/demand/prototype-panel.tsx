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
import {
  MonitorPlay, Upload, Trash2, Loader2, FileCode2, ImageOff, X,
} from "lucide-react"

interface PrototypeScreen {
  id: string
  name: string
  order: number
  screenshotUrl: string | null
}
interface Prototype {
  id: string
  version: number
  note: string | null
  createdAt: string
  screenCount: number
  screens: PrototypeScreen[]
}

export function PrototypePanel({
  demandId,
  token,
  shareToken,
  canManage = false,
  onRefresh,
}: {
  demandId: string
  token?: string | null
  shareToken?: string
  canManage?: boolean
  onRefresh?: () => void
}) {
  const [protos, setProtos] = useState<Prototype[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>("")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Prototype | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [preview, setPreview] = useState<{ proto: Prototype; screenId: string } | null>(null)

  const authQuery = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : ""
  const authHeaders: Record<string, string> = shareToken ? {} : (token ? { Authorization: `Bearer ${token}` } : {})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/demands/${demandId}/prototypes${authQuery}`, { headers: authHeaders })
      const data = await res.json()
      if (res.ok) {
        const list: Prototype[] = data.prototypes ?? []
        setProtos(list)
        setSelectedId((prev) => (list.some((p) => p.id === prev) ? prev : (list[0]?.id ?? "")))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandId, authQuery])

  useEffect(() => { load() }, [load])

  const selected = protos.find((p) => p.id === selectedId) ?? null

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/prototypes/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || "刪除失敗"); return }
      toast.success(`已刪除原型 v${deleteTarget.version}`)
      setDeleteTarget(null)
      await load()
      onRefresh?.()
    } finally {
      setDeleting(false)
    }
  }

  // 沒有原型且不可管理 → 不顯示卡片
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }
  if (protos.length === 0 && !canManage) return null

  return (
    <Card>
      <CardContent className="space-y-3 p-3 sm:p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <MonitorPlay className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold sm:text-base">原型 Prototype</span>
          {protos.length > 0 && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-7 w-auto min-w-[80px] gap-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {protos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>v{p.version}（{p.screenCount} 畫面）</SelectItem>
                ))}
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

        <p className="text-xs text-muted-foreground">
          可上傳一組 HTML 畫面供客戶點擊互動預覽（選填、分版本）。
        </p>

        {selected?.note && (
          <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground" title={selected.note}>
            {selected.note}
          </p>
        )}

        {/* Screen grid */}
        {!selected || selected.screens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-sm text-muted-foreground">
            <MonitorPlay className="h-8 w-8 text-muted-foreground/30" />
            {canManage ? "尚無原型，點右上角「上傳」加入 HTML 畫面" : "尚無原型"}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {selected.screens.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPreview({ proto: selected, screenId: s.id })}
                className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-muted/40">
                  {s.screenshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.screenshotUrl} alt={s.name} className="h-full w-full object-cover object-top" />
                  ) : (
                    <FileCode2 className="h-7 w-7 text-muted-foreground/40" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-indigo-600/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-indigo-600/70 group-hover:opacity-100">
                    <MonitorPlay className="mr-1 h-4 w-4" />互動預覽
                  </span>
                </div>
                <span className="truncate px-2 py-1.5 text-xs font-medium" title={s.name}>{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {/* Upload dialog */}
      {canManage && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          demandId={demandId}
          headers={authHeaders}
          onDone={() => { load(); onRefresh?.() }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除原型 v{deleteTarget?.version}？</AlertDialogTitle>
            <AlertDialogDescription>
              將刪除此版本的所有畫面（{deleteTarget?.screenCount} 個 HTML）與截圖，無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doDelete() }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Interactive preview modal */}
      {preview && (
        <PreviewModal
          demandId={demandId}
          proto={preview.proto}
          initialScreenId={preview.screenId}
          authQuery={authQuery}
          headers={authHeaders}
          onClose={() => setPreview(null)}
        />
      )}
    </Card>
  )
}

// ── Upload dialog ──────────────────────────────────────────────
function UploadDialog({
  open, onOpenChange, demandId, headers, onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  demandId: string
  headers: Record<string, string>
  onDone: () => void
}) {
  const [htmlFiles, setHtmlFiles] = useState<File[]>([])
  const [shots, setShots] = useState<File[]>([])
  const [note, setNote] = useState("")
  const [uploading, setUploading] = useState(false)
  const htmlRef = useRef<HTMLInputElement>(null)
  const shotRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { setHtmlFiles([]); setShots([]); setNote(""); setUploading(false) }
  }, [open])

  const submit = async () => {
    if (htmlFiles.length === 0) { toast.error("請至少選擇一個 HTML 檔"); return }
    setUploading(true)
    try {
      const fd = new FormData()
      if (note.trim()) fd.append("note", note.trim())
      htmlFiles.forEach((f) => fd.append("html", f))
      shots.forEach((f) => fd.append("screenshot", f))
      const res = await fetch(`/api/demands/${demandId}/prototypes`, { method: "POST", headers, body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || "上傳失敗"); return }
      toast.success(`已上傳原型 v${data.version}（${htmlFiles.length} 畫面）`)
      onOpenChange(false)
      onDone()
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>上傳原型（新版本）</DialogTitle>
          <DialogDescription className="text-xs">
            選擇一組 HTML 畫面（每個檔＝一個畫面，畫面名稱取自檔名）。截圖選填，會依「同檔名」自動配對（如 login.html ↔ login.png）。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium">HTML 畫面（必填、可多選）</p>
            <input ref={htmlRef} type="file" accept=".html,.htm" multiple className="hidden"
              onChange={(e) => { setHtmlFiles(Array.from(e.target.files ?? [])); }} />
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => htmlRef.current?.click()}>
              <FileCode2 className="mr-2 h-4 w-4" />
              {htmlFiles.length > 0 ? `已選 ${htmlFiles.length} 個 HTML` : "選擇 HTML 檔…"}
            </Button>
            {htmlFiles.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {htmlFiles.map((f, i) => (
                  <Badge key={i} variant="secondary" className="max-w-[10rem] gap-1 text-[10px]">
                    <span className="truncate">{f.name}</span>
                    <X className="h-3 w-3 shrink-0 cursor-pointer" onClick={() => setHtmlFiles((p) => p.filter((_, j) => j !== i))} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">截圖（選填、可多選）</p>
            <input ref={shotRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
              onChange={(e) => setShots(Array.from(e.target.files ?? []))} />
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => shotRef.current?.click()}>
              {shots.length > 0 ? <><ImageOff className="mr-2 h-4 w-4 opacity-0" />已選 {shots.length} 張截圖</> : "選擇截圖…（可略過）"}
            </Button>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">版本說明（選填）</p>
            <Textarea rows={2} placeholder="例如：v2 調整登入流程與工作台版面" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>取消</Button>
          <Button onClick={submit} disabled={uploading || htmlFiles.length === 0}>
            {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}上傳
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Interactive preview modal ──────────────────────────────────
function PreviewModal({
  demandId, proto, initialScreenId, authQuery, headers, onClose,
}: {
  demandId: string
  proto: Prototype
  initialScreenId: string
  authQuery: string
  headers: Record<string, string>
  onClose: () => void
}) {
  const [screenId, setScreenId] = useState(initialScreenId)
  const [html, setHtml] = useState<string>("")
  const [loadingHtml, setLoadingHtml] = useState(true)

  useEffect(() => {
    let alive = true
    setLoadingHtml(true)
    setHtml("")
    fetch(`/api/demands/${demandId}/prototypes/${proto.id}/screens/${screenId}${authQuery}`, { headers })
      .then((r) => r.ok ? r.text() : Promise.reject())
      .then((t) => { if (alive) setHtml(t) })
      .catch(() => { if (alive) setHtml("<div style='font-family:sans-serif;padding:24px;color:#71717a'>無法載入此畫面</div>") })
      .finally(() => { if (alive) setLoadingHtml(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandId, proto.id, screenId])

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex h-[90vh] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[92vw]">
        <DialogHeader className="border-b px-4 py-2.5">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MonitorPlay className="h-4 w-4 text-indigo-600" />
            原型預覽 · v{proto.version}
            <Badge variant="secondary" className="text-[10px]">{proto.screens.length} 畫面</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          {/* Screen list */}
          <div className="w-40 shrink-0 space-y-0.5 overflow-y-auto border-r bg-muted/20 p-2 sm:w-52">
            {proto.screens.map((s) => (
              <button
                key={s.id}
                onClick={() => setScreenId(s.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition",
                  s.id === screenId ? "bg-indigo-100 font-medium text-indigo-800" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
          {/* Preview iframe */}
          <div className="relative min-w-0 flex-1 bg-white">
            {loadingHtml && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <iframe
              title="原型預覽"
              srcDoc={html}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
