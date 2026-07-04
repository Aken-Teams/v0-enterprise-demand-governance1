"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  FileEdit, Plus, ChevronDown, ChevronRight, Check, X, Paperclip, Loader2,
  History, CircleDollarSign, FileText, ListChecks, Maximize2, Trash2, FileIcon, Eye, ClipboardCheck, Upload, Ban,
} from "lucide-react"
import { DESIGN_CHANGE_STATUS_MAP, CHECKLIST_MARK_MAP, STATUS_MAP } from "@/lib/constants/demand"
import { DesignChangeEditorDialog } from "@/components/demand/design-change-editor-dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Mark = "PENDING" | "CONFIRMED" | "CROSS" | "WARN"

interface Feedback { reviewerId: string; reviewer: { id: string; name: string }; mark: Mark; comment: string | null }
interface Item { id: string; orderIndex: number; text: string; devChecked: boolean; feedback: Feedback[] }
interface Review { reviewerId: string; reviewer: { id: string; name: string }; role: string; decision: string; comment: string | null; decidedAt: string | null }
interface DcDocument { id: string; fileName: string; fileUrl: string | null; fileSize: number | null; docGroup: string | null; fileVersion: number; checklistItemId: string | null; uploadedBy: { id: string; name: string }; createdAt: string }

const SEG: { m: Mark; label: string; icon: string; active: string }[] = [
  { m: "CONFIRMED", label: "確認", icon: "✓", active: "bg-emerald-600 text-white" },
  { m: "WARN", label: "疑慮", icon: "!", active: "bg-amber-500 text-white" },
  { m: "CROSS", label: "問題", icon: "✕", active: "bg-red-600 text-white" },
]
interface Revision {
  id: string; version: number; summary: string; checklistMd: string | null
  affectsSp: boolean; spCurrent: number | null; spDelta: number | null; spNote: string | null; status: string
  submittedBy: { name: string }; submittedAt: string; decidedAt: string | null
  items: Item[]; reviews: Review[]; documents: DcDocument[]
}
interface DesignChange {
  id: string; seq: number; title: string; phase: string; status: string
  currentVersion: number; createdBy: { name: string }; createdAt: string; revisions: Revision[]
}

export interface PreviewableDoc { id: string; type: string; fileName: string; fileUrl: string | null; fileSize: number | null }
const ROLE_LABELS: Record<string, string> = { REQUESTER: "需求窗口", MANAGER: "需求主管", BOARD: "董事會" }
const MAX_FILE_SIZE = 10 * 1024 * 1024

function StatusBadge({ status }: { status: string }) {
  const s = DESIGN_CHANGE_STATUS_MAP[status] ?? { label: status, color: "bg-gray-100 text-gray-600" }
  return <Badge className={cn("text-[10px] sm:text-xs", s.color)}>{s.label}</Badge>
}
function fmt(d: string | null) {
  if (!d) return ""
  return new Date(d).toLocaleString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

type Selection = { kind: "file"; id: string } | { kind: "checklist" }
type DraftState = {
  items: Record<string, { mark: Mark; comment: string }>
  comment: string
  files: File[]
  itemFiles: Record<string, File[]>
}
const emptyDraft = (): DraftState => ({ items: {}, comment: "", files: [], itemFiles: {} })

interface Props {
  demandId: string
  demandNumber: string
  phaseLabel: string
  token: string | null
  currentUserId: string | undefined
  canManage: boolean
  /** 需求目前 SP，供設計變更的 SP 影響評估 */
  currentSp?: number
  watermarkBg?: string
  onPreviewDoc?: (doc: PreviewableDoc) => void
}

export function DesignChangeTab({ demandId, demandNumber, phaseLabel, token, currentUserId, canManage, currentSp = 0, watermarkBg, onPreviewDoc }: Props) {
  const [changes, setChanges] = useState<DesignChange[]>([])
  const [canPropose, setCanPropose] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedVer, setSelectedVer] = useState<Record<string, number>>({})
  const [sel, setSel] = useState<Record<string, Selection>>({})
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<"create" | "revise">("create")
  const [reviseTarget, setReviseTarget] = useState<DesignChange | null>(null)
  const [cancelTarget, setCancelTarget] = useState<DesignChange | null>(null)
  const [draft, setDraft] = useState<Record<string, DraftState>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch(`/api/demands/${demandId}/design-changes`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setChanges(data.designChanges ?? [])
        setCanPropose(!!data.canPropose)
        setExpanded((prev) => {
          const list: DesignChange[] = data.designChanges ?? []
          if (list.length > 0 && Object.keys(prev).length === 0) return { [list[list.length - 1].id]: true }
          return prev
        })
      }
    } finally { setLoading(false) }
  }, [demandId, token])

  useEffect(() => { load() }, [load])

  const getRev = (dc: DesignChange) => {
    const ver = selectedVer[dc.id] ?? dc.currentVersion
    return dc.revisions.find((r) => r.version === ver) ?? dc.revisions[dc.revisions.length - 1]
  }
  const latestRevOf = (dc: DesignChange) => dc.revisions[dc.revisions.length - 1]
  const myPendingReview = (rev: Revision) => rev.status === "PENDING" && rev.reviews.some((r) => r.reviewerId === currentUserId && r.decision === "PENDING")

  const selOf = (dc: DesignChange, rev: Revision): Selection | null => {
    const s = sel[dc.id]
    if (s) {
      if (s.kind === "file" && rev.documents.some((d) => d.id === s.id)) return s
      if (s.kind === "checklist" && rev.items.length > 0) return s
    }
    return null
  }

  const dd = (dcId: string): DraftState => draft[dcId] ?? emptyDraft()
  const setItemMark = (dcId: string, itemId: string, mark: Mark) => setDraft((d) => {
    const cur = d[dcId] ?? emptyDraft()
    const item = cur.items[itemId] ?? { mark: "PENDING" as Mark, comment: "" }
    return { ...d, [dcId]: { ...cur, items: { ...cur.items, [itemId]: { ...item, mark } } } }
  })
  const setItemComment = (dcId: string, itemId: string, comment: string) => setDraft((d) => {
    const cur = d[dcId] ?? emptyDraft()
    const item = cur.items[itemId] ?? { mark: "PENDING" as Mark, comment: "" }
    return { ...d, [dcId]: { ...cur, items: { ...cur.items, [itemId]: { ...item, comment } } } }
  })
  const setOverall = (dcId: string, comment: string) => setDraft((d) => ({ ...d, [dcId]: { ...(d[dcId] ?? emptyDraft()), comment } }))
  const addFiles = (dcId: string, list: File[]) => {
    const arr = list.filter((f) => f.size <= MAX_FILE_SIZE)
    setDraft((d) => ({ ...d, [dcId]: { ...(d[dcId] ?? emptyDraft()), files: [...(d[dcId]?.files ?? []), ...arr] } }))
  }
  const removeFile = (dcId: string, idx: number) => setDraft((d) => ({ ...d, [dcId]: { ...(d[dcId] ?? emptyDraft()), files: (d[dcId]?.files ?? []).filter((_, i) => i !== idx) } }))
  const addItemFiles = (dcId: string, itemId: string, list: File[]) => {
    const arr = list.filter((f) => f.size <= MAX_FILE_SIZE)
    setDraft((d) => {
      const cur = d[dcId] ?? emptyDraft()
      return { ...d, [dcId]: { ...cur, itemFiles: { ...cur.itemFiles, [itemId]: [...(cur.itemFiles[itemId] ?? []), ...arr] } } }
    })
  }
  const removeItemFile = (dcId: string, itemId: string, idx: number) => setDraft((d) => {
    const cur = d[dcId] ?? emptyDraft()
    return { ...d, [dcId]: { ...cur, itemFiles: { ...cur.itemFiles, [itemId]: (cur.itemFiles[itemId] ?? []).filter((_, i) => i !== idx) } } }
  })

  const submitReview = async (dc: DesignChange, rev: Revision, decision: "APPROVED" | "REJECTED") => {
    if (!token) return
    const cur = dd(dc.id)
    const items = rev.items.map((it) => ({ itemId: it.id, mark: (cur.items[it.id]?.mark ?? "PENDING") as Mark, comment: cur.items[it.id]?.comment ?? "" }))
    const fd = new FormData()
    fd.append("revisionId", rev.id); fd.append("decision", decision); fd.append("comment", cur.comment); fd.append("items", JSON.stringify(items))
    // 依序附加：總回饋附件(itemId="") + 各檢查項附件(itemId=該項)；fileItemIds 與 files 同序
    const ordered: { file: File; itemId: string }[] = []
    cur.files.forEach((f) => ordered.push({ file: f, itemId: "" }))
    Object.entries(cur.itemFiles).forEach(([itemId, arr]) => arr.forEach((f) => ordered.push({ file: f, itemId })))
    ordered.forEach((o) => fd.append("files", o.file))
    fd.append("fileItemIds", JSON.stringify(ordered.map((o) => o.itemId)))
    setSubmitting(dc.id)
    try {
      const res = await fetch(`/api/demands/${demandId}/design-changes/${dc.id}/reviews`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      if (res.ok) { setDraft((d) => ({ ...d, [dc.id]: emptyDraft() })); await load() }
      else { const e = await res.json().catch(() => ({})); alert(e.error || "送出失敗") }
    } finally { setSubmitting(null) }
  }

  const openFilePicker = (target: string) => { uploadTargetRef.current = target; fileInputRef.current?.click() }

  const doCancelDesignChange = async () => {
    const dc = cancelTarget
    if (!token || !dc) return
    setSubmitting(dc.id)
    try {
      const res = await fetch(`/api/demands/${demandId}/design-changes/${dc.id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) { setCancelTarget(null); await load() }
      else { const e = await res.json().catch(() => ({})); alert(e.error || "撤銷失敗") }
    } finally { setSubmitting(null) }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />載入中…</div>

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileEdit className="h-4 w-4 text-indigo-600" />
          <h3 className="font-semibold text-sm sm:text-base">設計變更</h3>
          <span className="text-xs text-muted-foreground">{changes.length} 筆</span>
        </div>
        {canManage && canPropose && (
          <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => { setEditorMode("create"); setReviseTarget(null); setEditorOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />新增設計變更
          </Button>
        )}
      </div>

      {changes.length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted-foreground">尚無設計變更紀錄。{canManage && canPropose ? "點右上「新增設計變更」開始。" : ""}</Card>
      ) : (
        changes.map((dc) => {
          const rev = getRev(dc)
          const latest = latestRevOf(dc)
          const isOpen = !!expanded[dc.id]
          const iReview = myPendingReview(latest) && rev.version === dc.currentVersion
          const selection = selOf(dc, rev)
          const cur = dd(dc.id)
          const allConfirmed = rev.items.length > 0 && rev.items.every((it) => (cur.items[it.id]?.mark ?? "PENDING") === "CONFIRMED")
          // 版本層級附件依上傳者分類：需求方(審核人)佐證 vs 開發端文件
          const reviewerIds = new Set(rev.reviews.map((r) => r.reviewerId))
          const versionDocs = rev.documents.filter((d) => !d.checklistItemId)
          const devDocs = versionDocs.filter((d) => !reviewerIds.has(d.uploadedBy.id))
          const reviewerDocs = versionDocs.filter((d) => reviewerIds.has(d.uploadedBy.id))
          const decidedReviews = rev.reviews.filter((r) => r.decision !== "PENDING")
          return (
            <Card key={dc.id} className="overflow-hidden p-0">
              {/* Header */}
              <button className="w-full flex items-center gap-2 px-3 sm:px-4 py-3 text-left hover:bg-muted/40"
                onClick={() => setExpanded((e) => ({ ...e, [dc.id]: !e[dc.id] }))}>
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="font-mono text-xs text-muted-foreground shrink-0">DC-{String(dc.seq).padStart(2, "0")}</span>
                <span className="font-medium text-sm truncate flex-1">{dc.title}</span>
                <Badge variant="outline" className="text-[10px] shrink-0 bg-slate-50">{STATUS_MAP[dc.phase]?.label ?? dc.phase} 提出</Badge>
                {latest.affectsSp && <Badge className="bg-amber-100 text-amber-700 text-[10px] gap-0.5 shrink-0"><CircleDollarSign className="h-3 w-3" />影響SP</Badge>}
                <Badge variant="outline" className="text-[10px] shrink-0">v{dc.currentVersion}</Badge>
                <StatusBadge status={dc.status} />
                {dc.status === "PENDING" && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="待確認" />}
              </button>

              {isOpen && (
                <div className="border-t">
                  {/* Meta bar */}
                  <div className="px-3 sm:px-4 py-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-muted-foreground border-b bg-muted/20">
                    <span>提出人：<span className="text-foreground font-medium">{rev.submittedBy.name}</span></span>
                    <span>·</span>
                    <span>v{rev.version} · {fmt(rev.submittedAt)}</span>
                    <StatusBadge status={rev.status} />
                    {dc.revisions.length > 1 && (
                      <div className="flex items-center gap-1 ml-auto">
                        <span>版本：</span>
                        {dc.revisions.map((r) => (
                          <button key={r.id} onClick={() => setSelectedVer((s) => ({ ...s, [dc.id]: r.version }))}
                            className={cn("text-[11px] px-1.5 py-0.5 rounded border", r.version === rev.version ? "bg-indigo-600 text-white border-indigo-600" : "bg-background hover:bg-muted")}>v{r.version}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 變更摘要 */}
                  <div className="px-3 sm:px-4 py-2.5 border-b">
                    <p className="text-[11px] font-semibold text-indigo-600 mb-1">變更摘要</p>
                    <div className="prose prose-sm prose-neutral max-w-none text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{rev.summary}</ReactMarkdown></div>
                    {rev.affectsSp && (
                      <div className="flex items-start gap-2 mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                        <CircleDollarSign className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium">影響 SP（已納入董事會審核）</span>
                          {rev.spDelta != null && rev.spCurrent != null && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span>目前 <strong>{rev.spCurrent}</strong></span>
                              <span>→ 調整後 <strong className={rev.spDelta > 0 ? "text-emerald-700" : rev.spDelta < 0 ? "text-red-700" : ""}>{rev.spCurrent + rev.spDelta}</strong></span>
                              <Badge className={cn("text-[10px]", rev.spDelta > 0 ? "bg-emerald-100 text-emerald-700" : rev.spDelta < 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600")}>
                                {rev.spDelta > 0 ? `上調 +${rev.spDelta}` : rev.spDelta < 0 ? `下降 ${rev.spDelta}` : "±0"} SP
                              </Badge>
                            </div>
                          )}
                          {rev.spNote ? <p className="mt-1 text-amber-700 whitespace-pre-line">{rev.spNote}</p> : null}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 左右工作區（左預覽卡、右導覽卡，參考「文件」tab） */}
                  <div className="grid gap-3 sm:gap-4 lg:grid-cols-5 p-3 sm:p-4">
                    {/* LEFT: 預覽卡 */}
                    <Card className="lg:col-span-3 min-h-[320px]">
                      <CardContent className="p-3 sm:p-4 h-full overflow-y-auto max-h-[70vh] lg:max-h-[560px]">
                      {!selection ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-muted-foreground">
                          <Eye className="h-10 w-10 sm:h-12 sm:w-12 mb-3 opacity-20" />
                          <p className="text-xs sm:text-sm">請從右側選擇檔案或檢查項目以檢視</p>
                        </div>
                      ) : selection.kind === "file" ? (
                        (() => {
                          const doc = rev.documents.find((d) => d.id === selection.id)
                          return doc ? <InlinePreview doc={doc} watermarkBg={watermarkBg} onFullScreen={onPreviewDoc} /> : <Empty text="選擇左側檔案預覽" />
                        })()
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 border-b">
                            <ListChecks className="h-4 w-4" />檢查清單 · 共 {rev.items.length} 項{iReview ? "（逐條選：確認 / 疑慮 / 問題）" : ""}
                          </div>
                          {rev.items.map((it, idx) => {
                            const myMark = cur.items[it.id]?.mark ?? "PENDING"
                            const hasIssue = myMark === "CROSS" || myMark === "WARN"
                            const itemDocs = rev.documents.filter((d) => d.checklistItemId === it.id)
                            const draftFiles = cur.itemFiles[it.id] ?? []
                            // 唯讀時前方框框代表「需求方是否確認」，不是開發端的 [x]
                            const reviewerMark: Mark = it.feedback.some((f) => f.mark === "CROSS") ? "CROSS"
                              : it.feedback.some((f) => f.mark === "WARN") ? "WARN"
                              : it.feedback.some((f) => f.mark === "CONFIRMED") ? "CONFIRMED" : "PENDING"
                            return (
                              <div key={it.id} className={cn("rounded-md border p-3", iReview && myMark === "PENDING" && "border-amber-200 bg-amber-50/40")}>
                                <div className="flex items-start gap-3">
                                  {!iReview && (
                                    <span className="mt-0.5 shrink-0" title="需求方確認狀態">
                                      {reviewerMark === "CONFIRMED" ? (
                                        <span className="flex items-center justify-center h-[18px] w-[18px] rounded-md bg-emerald-500 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>
                                      ) : reviewerMark === "CROSS" ? (
                                        <span className="flex items-center justify-center h-[18px] w-[18px] rounded-md bg-red-500 text-white"><X className="h-3 w-3" strokeWidth={3} /></span>
                                      ) : reviewerMark === "WARN" ? (
                                        <span className="flex items-center justify-center h-[18px] w-[18px] rounded-md bg-amber-500 text-white text-[11px] font-bold leading-none">!</span>
                                      ) : (
                                        <span className="block h-[18px] w-[18px] rounded-md border-2 border-slate-300 bg-white" />
                                      )}
                                    </span>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[15px] font-medium">
                                      {idx + 1}. {it.text}
                                      {iReview && myMark === "PENDING" && <Badge className="ml-2 bg-amber-100 text-amber-700 text-[10px] align-middle">待確認</Badge>}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">開發端：{it.devChecked ? <span className="text-emerald-600">已完成</span> : "未標記完成"}</p>
                                  </div>
                                  {iReview && (
                                    <div className="flex items-stretch rounded-md border overflow-hidden shrink-0 text-sm">
                                      {SEG.map((s, si) => {
                                        const active = myMark === s.m
                                        return (
                                          <button key={s.m} onClick={() => setItemMark(dc.id, it.id, s.m)}
                                            className={cn("px-2.5 py-1.5 flex items-center gap-1", si > 0 && "border-l", active ? s.active : "text-muted-foreground hover:bg-muted")}>
                                            <span className="font-bold">{s.icon}</span>{s.label}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* 疑慮/問題 → 說明 + 佐證附件（審核中可刪除） */}
                                {iReview && hasIssue && (
                                  <div className="mt-2.5 space-y-2">
                                    <Textarea value={cur.items[it.id]?.comment ?? ""} onChange={(e) => setItemComment(dc.id, it.id, e.target.value)}
                                      placeholder={`說明${CHECKLIST_MARK_MAP[myMark].label}點（必填）...`} rows={2} className="text-sm" />
                                    {draftFiles.map((f, i) => (
                                      <div key={`${f.name}-${i}`} className="flex items-center gap-1.5 text-xs rounded bg-muted/40 border px-2 py-1">
                                        <FileIcon className="h-3 w-3 shrink-0" /><span className="truncate flex-1">{f.name}</span>
                                        <button onClick={() => removeItemFile(dc.id, it.id, i)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                                      </div>
                                    ))}
                                    <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => openFilePicker(`item:${dc.id}:${it.id}`)}>
                                      <Paperclip className="h-3.5 w-3.5" />附加佐證檔案
                                    </button>
                                  </div>
                                )}

                                {/* 已提交的需求方回應 + 綁定佐證文件 */}
                                {(it.feedback.length > 0 || itemDocs.length > 0) && (
                                  <div className="mt-2.5 pt-2.5 border-t space-y-1.5">
                                    {it.feedback.map((fb) => {
                                      const fmk = CHECKLIST_MARK_MAP[fb.mark]
                                      return (
                                        <div key={fb.reviewerId} className="text-sm flex items-start gap-1.5">
                                          <span className={cn("font-bold", fmk.color)}>{fmk.icon}</span>
                                          <span className="text-muted-foreground">{fb.reviewer.name}</span>
                                          {fb.comment && <span>— {fb.comment}</span>}
                                        </div>
                                      )
                                    })}
                                    {itemDocs.map((d) => (
                                      <div key={d.id} className="flex items-center gap-1.5 text-xs">
                                        <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                                        {onPreviewDoc ? (
                                          <button onClick={() => onPreviewDoc({ id: d.id, type: "ATTACHMENT", fileName: d.fileName, fileUrl: d.fileUrl, fileSize: d.fileSize })} className="text-indigo-600 hover:underline truncate text-left">{d.fileName}</button>
                                        ) : (
                                          <a href={d.fileUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">{d.fileName}</a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      </CardContent>
                    </Card>

                    {/* RIGHT: 導覽卡（檔案優先、checklist 最後）+ 審核 */}
                    <Card className="lg:col-span-2 flex flex-col max-h-[70vh] lg:max-h-[560px]">
                      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
                        {/* 檔案（開發端文件） */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><FileText className="h-4 w-4" />開發端文件</p>
                            {canManage && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openFilePicker(dc.id)}>
                                <Upload className="h-3.5 w-3.5 mr-1" />上傳
                              </Button>
                            )}
                          </div>
                          {devDocs.length === 0 ? <p className="text-xs text-muted-foreground">無附件</p> : (
                            <div className="space-y-1">
                              {devDocs.map((d) => {
                                const active = selection?.kind === "file" && selection.id === d.id
                                return (
                                  <button key={d.id} onClick={() => setSel((s) => ({ ...s, [dc.id]: { kind: "file", id: d.id } }))}
                                    className={cn("w-full flex items-center gap-2 px-2.5 py-2 rounded text-sm text-left", active ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "hover:bg-muted")}>
                                    <Paperclip className="h-4 w-4 shrink-0" />
                                    <span className="truncate flex-1">{d.fileName}</span>
                                    {d.fileVersion > 1 && <Badge variant="outline" className="text-[10px]">v{d.fileVersion}</Badge>}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* 檢查清單（單一群組，點開左邊看全部逐條） */}
                        {rev.items.length > 0 && (() => {
                          const active = selection?.kind === "checklist"
                          const confirmedCount = iReview
                            ? rev.items.filter((it) => (cur.items[it.id]?.mark ?? "PENDING") === "CONFIRMED").length
                            : rev.items.filter((it) => it.feedback.some((f) => f.mark === "CONFIRMED")).length
                          const issueCount = iReview
                            ? rev.items.filter((it) => ["CROSS", "WARN"].includes(cur.items[it.id]?.mark ?? "PENDING")).length
                            : rev.items.filter((it) => it.feedback.some((f) => f.mark === "CROSS" || f.mark === "WARN")).length
                          const pendingCount = iReview ? rev.items.filter((it) => (cur.items[it.id]?.mark ?? "PENDING") === "PENDING").length : 0
                          return (
                            <div className="border-t pt-3">
                              <p className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><ListChecks className="h-4 w-4" />檢查清單</p>
                              <button onClick={() => setSel((s) => ({ ...s, [dc.id]: { kind: "checklist" } }))}
                                className={cn("w-full flex items-center gap-2 px-2.5 py-2.5 rounded text-sm text-left border", active ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "hover:bg-muted border-transparent")}>
                                <ListChecks className="h-4 w-4 shrink-0" />
                                <span className="flex-1">共 {rev.items.length} 項</span>
                                {confirmedCount > 0 && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">✓ {confirmedCount}</Badge>}
                                {issueCount > 0 && <Badge className="bg-red-100 text-red-700 text-[10px]">! {issueCount}</Badge>}
                                {pendingCount > 0 && <Badge className="bg-amber-100 text-amber-700 text-[10px]">待確認 {pendingCount}</Badge>}
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              </button>
                            </div>
                          )
                        })()}

                        {/* 審核結果（需求方裁決 + 說明 + 佐證） */}
                        {(decidedReviews.length > 0 || reviewerDocs.length > 0) && (
                          <div className="border-t pt-3">
                            <p className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" />審核結果</p>
                            <div className="space-y-2">
                              {decidedReviews.map((r) => (
                                <div key={r.reviewerId} className="rounded-md border p-2">
                                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                    <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[r.role] ?? r.role}</Badge>
                                    <span className="text-muted-foreground">{r.reviewer.name}</span>
                                    <StatusBadge status={r.decision} />
                                    {r.decidedAt && <span className="text-muted-foreground ml-auto">{fmt(r.decidedAt)}</span>}
                                  </div>
                                  {r.comment && <p className="text-xs mt-1.5 whitespace-pre-line">{r.comment}</p>}
                                </div>
                              ))}
                              {reviewerDocs.length > 0 && (
                                <div>
                                  <p className="text-[11px] text-muted-foreground mb-1">需求方佐證</p>
                                  <div className="space-y-1">
                                    {reviewerDocs.map((d) => (
                                      <div key={d.id} className="flex items-center gap-1.5 text-xs">
                                        <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                                        {onPreviewDoc ? (
                                          <button onClick={() => onPreviewDoc({ id: d.id, type: "ATTACHMENT", fileName: d.fileName, fileUrl: d.fileUrl, fileSize: d.fileSize })} className="text-indigo-600 hover:underline truncate text-left">{d.fileName}</button>
                                        ) : (
                                          <a href={d.fileUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">{d.fileName}</a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 審核動作 */}
                      {iReview && (
                        <div className="border-t p-3 space-y-2 mt-auto">
                          <p className="text-[11px] font-semibold text-muted-foreground">審核</p>
                          <Textarea value={cur.comment} onChange={(e) => setOverall(dc.id, e.target.value)} placeholder="回饋／總回應（選填；駁回請說明或標記問題項目）..." rows={2} className="text-xs" />
                          {cur.files.length > 0 && (
                            <div className="space-y-1">
                              {cur.files.map((f, i) => (
                                <div key={`${f.name}-${i}`} className="flex items-center gap-1.5 text-[11px] rounded bg-muted/40 border px-2 py-1">
                                  <FileIcon className="h-3 w-3 shrink-0" /><span className="truncate flex-1">{f.name}</span>
                                  <button onClick={() => removeFile(dc.id, i)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                          {!allConfirmed && (
                            <p className="text-[11px] text-amber-600">需將全部檢查項目標記為「確認」才能通過（有疑慮/問題請駁回）。</p>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => openFilePicker("review:" + dc.id)}>
                              <Paperclip className="h-3.5 w-3.5" />附加檔案
                            </button>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" disabled={submitting === dc.id} onClick={() => submitReview(dc, rev, "REJECTED")}>
                                {submitting === dc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <X className="h-3.5 w-3.5 mr-1" />}駁回
                              </Button>
                              <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50" disabled={submitting === dc.id || !allConfirmed} title={!allConfirmed ? "需全部項目確認" : ""} onClick={() => submitReview(dc, rev, "APPROVED")}>
                                {submitting === dc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}通過
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* 版本歷程 + 動作（重送 / 撤銷） */}
                  {((canManage && (dc.status === "REJECTED" || dc.status === "PENDING") && rev.version === dc.currentVersion) || dc.revisions.length > 1) && (
                    <div className="px-3 sm:px-4 py-3 border-t space-y-3">
                      {canManage && (dc.status === "REJECTED" || dc.status === "PENDING") && rev.version === dc.currentVersion && (
                        <div className="flex justify-end gap-2">
                          {dc.status === "REJECTED" && (
                            <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={submitting === dc.id} onClick={() => { setReviseTarget(dc); setEditorMode("revise"); setEditorOpen(true) }}>
                              <FileEdit className="h-3.5 w-3.5 mr-1" />重新送出變更申請
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" disabled={submitting === dc.id} onClick={() => setCancelTarget(dc)}>
                            <Ban className="h-3.5 w-3.5 mr-1" />撤銷此設計變更
                          </Button>
                        </div>
                      )}
                      {dc.revisions.length > 1 && (
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><History className="h-3 w-3" />版本歷程</p>
                          <div className="space-y-1">
                            {dc.revisions.map((r) => (
                              <div key={r.id} className="flex items-center gap-2 text-[11px]">
                                <span className="font-medium">v{r.version}</span>
                                <span className="text-muted-foreground">{r.submittedBy.name} · {fmt(r.submittedAt)}</span>
                                <StatusBadge status={r.status} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })
      )}

      {/* shared file input for uploads / review attachments */}
      <input ref={fileInputRef} type="file" multiple className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp"
        onChange={async (e) => {
          // 先複製成陣列，因為 e.target.value="" 會清空 e.target.files 這個 live FileList
          const picked = e.target.files ? Array.from(e.target.files) : []
          const target = uploadTargetRef.current
          e.target.value = ""; uploadTargetRef.current = null
          if (!picked.length || !target) return
          if (target.startsWith("review:")) { addFiles(target.slice(7), picked); return }
          if (target.startsWith("item:")) { const [, dcId, itemId] = target.split(":"); addItemFiles(dcId, itemId, picked); return }
          // 上傳到該版本的檔案（開發端）
          if (!token) return
          const fd = new FormData(); picked.forEach((f) => fd.append("files", f))
          const res = await fetch(`/api/demands/${demandId}/design-changes/${target}/documents`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
          if (res.ok) await load(); else { const err = await res.json().catch(() => ({})); alert(err.error || "上傳失敗") }
        }} />

      <DesignChangeEditorDialog
        open={editorOpen} onOpenChange={setEditorOpen}
        demandId={demandId} demandNumber={demandNumber} phaseLabel={phaseLabel} token={token} currentSp={currentSp}
        mode={editorMode} dcId={reviseTarget?.id}
        initial={editorMode === "revise" && reviseTarget ? {
          title: reviseTarget.title,
          summary: latestRevOf(reviseTarget).summary,
          checklistMd: latestRevOf(reviseTarget).checklistMd ?? "",
          affectsSp: latestRevOf(reviseTarget).affectsSp,
          spNote: latestRevOf(reviseTarget).spNote ?? "",
          spDelta: latestRevOf(reviseTarget).spDelta,
        } : undefined}
        onComplete={load}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤銷此設計變更？</AlertDialogTitle>
            <AlertDialogDescription>
              將設計變更「{cancelTarget?.title}」設為已撤銷。撤銷後將不再需要審核，也不會再擋住階段簽核；此設計變更的紀錄仍會保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={doCancelDesignChange}>確定撤銷</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="h-full min-h-[240px] flex items-center justify-center text-sm text-muted-foreground">{text}</div>
}

function InlinePreview({ doc, watermarkBg, onFullScreen }: { doc: DcDocument; watermarkBg?: string; onFullScreen?: (d: PreviewableDoc) => void }) {
  const [text, setText] = useState("")
  const [loadingText, setLoadingText] = useState(false)
  const ext = doc.fileName.split(".").pop()?.toLowerCase() || ""
  const isText = ["md", "txt"].includes(ext)
  const isImg = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
  const isPdf = ext === "pdf"

  useEffect(() => {
    if (!isText || !doc.fileUrl) { setText(""); return }
    setLoadingText(true)
    fetch(doc.fileUrl).then((r) => (r.ok ? r.text() : "")).then((t) => setText(t || "")).catch(() => setText("")).finally(() => setLoadingText(false))
  }, [doc.fileUrl, isText])

  const toPreview = (): PreviewableDoc => ({ id: doc.id, type: "ATTACHMENT", fileName: doc.fileName, fileUrl: doc.fileUrl, fileSize: doc.fileSize })

  let body: React.ReactNode
  if (isText) {
    body = loadingText
      ? <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" />載入中…</div>
      : <div className="prose prose-sm prose-neutral max-w-none text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>
  } else if (isImg) {
    body = <img src={doc.fileUrl ?? ""} alt={doc.fileName} className="max-w-full rounded" />
  } else if (isPdf) {
    body = <iframe src={`${doc.fileUrl}#toolbar=0&navpanes=0`} className="w-full h-[420px] border rounded" title={doc.fileName} />
  } else {
    body = (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{doc.fileName}</p>
        {onFullScreen && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onFullScreen(toPreview())}><Maximize2 className="h-3.5 w-3.5 mr-1" />開啟預覽</Button>}
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <span className="text-sm font-medium truncate">{doc.fileName}</span>
        {onFullScreen && (isText || isImg || isPdf) && (
          <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0" onClick={() => onFullScreen(toPreview())}><Maximize2 className="h-3.5 w-3.5" />全螢幕</button>
        )}
      </div>
      <div className="relative">
        {body}
        {watermarkBg && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }} />}
      </div>
    </div>
  )
}
