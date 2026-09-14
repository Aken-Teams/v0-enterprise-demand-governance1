"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  FileText, FileSpreadsheet, FileImage, FileVideo2, FileAudio, File, Presentation,
  Download, Upload, Loader2, Check, Circle, ExternalLink, Link, Trash2,
  ChevronRight, ChevronLeft, History, FileEdit, Plus, ClipboardCheck,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  STATUS_MAP,
  PIPELINE_STEPS,
  PHASE_COLORS,
  PHASE_DOCUMENT_MAP,
  DOCUMENT_TYPE_LABELS,
  SIGNOFF_STATUS_MAP,
} from "@/lib/constants/demand"
import { cn } from "@/lib/utils"

interface Document {
  id: string
  type: string
  phase: string | null
  fileName: string
  fileUrl: string | null
  fileSize: number | null
  uploadedBy: string
  createdAt: string
  version?: number
  docGroup?: string | null
  changeNote?: string | null
  designChangeId?: string | null
  designChange?: { id: string; seq: number; title: string } | null
  /** 此檔案是簽核往返的附件：request = 我方提出時附的、response = 需求方回應時附的 */
  signoffSource?: "request" | "response" | null
  /** 所屬的簽核往返（同一次送簽與其回覆），供依審核日期分組 */
  signoffRound?: { key: string; date: string; status: string } | null
}

/** 文件清單的一個區塊：一般文件，或某一次簽核往返 */
interface DocSection {
  key: string
  /** null = 一般階段文件，不加標題、恆常展開 */
  title: string | null
  status?: string
  /** 預設展開：最近一次往返展開，更早的收合 */
  defaultOpen?: boolean
  groups: DocGroup[]
}

/** 簽核附件的來源標籤——避免雙方的檔案混在同一份清單裡看不出是誰給的 */
const SIGNOFF_SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  request: { label: "簽核送出附件", className: "border-blue-200 bg-blue-50 text-blue-600" },
  response: { label: "需求方回饋", className: "border-amber-200 bg-amber-50 text-amber-700" },
}

interface DesignChangeOption {
  id: string
  seq: number
  title: string
}

interface PhaseDocumentsProps {
  documents: Document[]
  currentPhase: string
  demandId: string
  canUpload: boolean
  canDownload?: boolean
  token: string | null
  onRefresh: () => void
  uploadTriggerSelector?: string
  onDocumentSelect?: (doc: Document) => void
  selectedDocId?: string | null
  userId?: string
  userRole?: string
  /** 供「關聯設計變更」下拉選單使用（選填綁定） */
  designChanges?: DesignChangeOption[]
  /** 目前檢視（點進）的階段變動時通知父層；回到階段清單為 null */
  onActivePhaseChange?: (phase: string | null) => void
}

/** 版本群組：同一份邏輯文件的多個版本 */
interface DocGroup {
  groupId: string
  versions: Document[] // 由新到舊
  latest: Document
}

function getFileIconAndColor(fileName: string): { icon: typeof File; color: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  switch (ext) {
    case "xls": case "xlsx": case "csv":
      return { icon: FileSpreadsheet, color: "text-emerald-600" }
    case "ppt": case "pptx":
      return { icon: Presentation, color: "text-orange-500" }
    case "jpg": case "jpeg": case "png": case "gif": case "webp": case "svg":
      return { icon: FileImage, color: "text-violet-500" }
    case "mp4": case "webm": case "mov": case "avi":
      return { icon: FileVideo2, color: "text-rose-500" }
    case "mp3": case "wav": case "ogg": case "m4a":
      return { icon: FileAudio, color: "text-sky-500" }
    case "pdf": case "doc": case "docx": case "txt": case "md":
      return { icon: FileText, color: "text-blue-500" }
    default:
      return { icon: File, color: "text-muted-foreground" }
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

/** 依 docGroup 分組（舊資料無 docGroup → 各自獨立），同組內由新到舊排序 */
function groupDocs(docs: Document[]): DocGroup[] {
  const map = new Map<string, Document[]>()
  for (const d of docs) {
    const key = d.docGroup || `solo:${d.id}`
    const arr = map.get(key)
    if (arr) arr.push(d)
    else map.set(key, [d])
  }
  const groups: DocGroup[] = []
  for (const [groupId, versions] of map) {
    versions.sort((a, b) => (b.version || 1) - (a.version || 1))
    groups.push({ groupId, versions, latest: versions[0] })
  }
  groups.sort((a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime())
  return groups
}

/**
 * 依「簽核往返」把文件分區：一般階段文件排前面，其後每一次送簽各成一區，
 * 以審核日期為標題。否則同一階段裡我方送簽的附件與需求方回覆的附件會
 * 跟真正的階段文件混在一起，看不出哪幾份屬於同一次往返。
 */
function sectionizeDocs(groups: DocGroup[]): DocSection[] {
  const plain: DocGroup[] = []
  const rounds = new Map<string, { date: string; status: string; groups: DocGroup[] }>()

  for (const g of groups) {
    const r = g.latest.signoffRound
    if (!r) { plain.push(g); continue }
    const cur = rounds.get(r.key)
    if (cur) cur.groups.push(g)
    else rounds.set(r.key, { date: r.date, status: r.status, groups: [g] })
  }

  const sections: DocSection[] = []
  if (plain.length > 0) sections.push({ key: "plain", title: null, groups: plain })
  const sorted = [...rounds.entries()].sort(
    (a, b) => new Date(b[1].date).getTime() - new Date(a[1].date).getTime()
  )
  sorted.forEach(([key, r], i) => {
    sections.push({
      key,
      title: `${fmtDate(r.date)} 簽核往返`,
      status: r.status,
      // 最近一次預設展開，較早的收起來，避免往返多了以後整頁都是附件
      defaultOpen: i === 0,
      groups: r.groups,
    })
  })
  return sections
}

export function PhaseDocuments({
  documents,
  currentPhase,
  onActivePhaseChange,
  demandId,
  canUpload,
  canDownload = true,
  token,
  onRefresh,
  uploadTriggerSelector,
  onDocumentSelect,
  selectedDocId,
  userId,
  userRole,
  designChanges = [],
}: PhaseDocumentsProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadPhase, setUploadPhase] = useState(currentPhase)
  const [uploadType, setUploadType] = useState("ATTACHMENT")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [appResultUrl, setAppResultUrl] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<string | null>(null)
  useEffect(() => { onActivePhaseChange?.(activePhase) }, [activePhase]) // eslint-disable-line react-hooks/exhaustive-deps
  // 版本更新相關
  const [changeNote, setChangeNote] = useState("")
  const [uploadDcId, setUploadDcId] = useState<string>("")
  const [versioning, setVersioning] = useState<{ groupId: string; fileName: string; nextVersion: number; typeLabel: string; phaseLabel: string; isLink: boolean } | null>(null)
  // 每個群組目前檢視的版本
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({})

  const LINK_TYPES = new Set(["APP_RESULT", "GITHUB_REPO"])
  const INTERNAL_ONLY_TYPES = new Set(["GITHUB_REPO"])
  const isLinkType = versioning ? versioning.isLink : LINK_TYPES.has(uploadType)
  const isSubsidiary = userRole === "subsidiary"

  // Bind external upload trigger button
  useEffect(() => {
    if (!uploadTriggerSelector) return
    const el = document.querySelector(uploadTriggerSelector)
    if (!el) return
    const handler = () => openNewUpload()
    el.addEventListener("click", handler)
    return () => el.removeEventListener("click", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadTriggerSelector])

  /** 簽核往返區塊的展開狀態；未設定者依 defaultOpen */
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({})

  const resetUploadFields = () => {
    setSelectedFiles([])
    setAppResultUrl("")
    setChangeNote("")
    setUploadDcId("")
    setUploadError("")
  }

  const openNewUpload = () => {
    setVersioning(null)
    setUploadPhase(activePhase && activePhase !== "OTHER" ? activePhase : currentPhase)
    setUploadType("ATTACHMENT")
    resetUploadFields()
    setShowUploadDialog(true)
  }

  const openVersionUpload = (group: DocGroup) => {
    const latest = group.latest
    setVersioning({
      groupId: group.groupId,
      fileName: latest.fileName,
      nextVersion: (latest.version || 1) + 1,
      typeLabel: DOCUMENT_TYPE_LABELS[latest.type] || latest.type,
      phaseLabel: latest.phase ? (STATUS_MAP[latest.phase]?.label || latest.phase) : "其他",
      isLink: LINK_TYPES.has(latest.type),
    })
    resetUploadFields()
    setShowUploadDialog(true)
  }

  const getPhaseDocuments = (phase: string) =>
    documents.filter((d) => d.phase === phase && !(isSubsidiary && INTERNAL_ONLY_TYPES.has(d.type)))

  const getUnassignedDocuments = () =>
    documents.filter((d) => !d.phase && !(isSubsidiary && INTERNAL_ONLY_TYPES.has(d.type)))

  const getRequiredStatus = (phase: string) => {
    const config = PHASE_DOCUMENT_MAP[phase]
    if (!config) return []
    return config.required
      .filter((type) => !(isSubsidiary && INTERNAL_ONLY_TYPES.has(type)))
      .map((type) => ({
        type,
        label: DOCUMENT_TYPE_LABELS[type] || type,
        uploaded: documents.some((d) => d.phase === phase && d.type === type),
      }))
  }

  const handleUpload = async () => {
    if (!token || selectedFiles.length === 0) return
    setUploading(true)
    setUploadError("")
    try {
      const formData = new FormData()
      if (versioning) {
        formData.set("docGroup", versioning.groupId)
      } else {
        if (uploadPhase !== "OTHER") formData.set("phase", uploadPhase)
        formData.set("type", uploadType)
      }
      if (changeNote.trim()) formData.set("changeNote", changeNote.trim())
      if (uploadDcId) formData.set("designChangeId", uploadDcId)
      for (const file of selectedFiles) {
        formData.append("files", file)
      }
      const res = await fetch(`/api/demands/${demandId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        setShowUploadDialog(false)
        resetUploadFields()
        setVersioning(null)
        onRefresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setUploadError(data.error || `上傳失敗 (${res.status})`)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "網路錯誤")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitLink = async () => {
    if (!token || !appResultUrl.trim()) return
    setUploading(true)
    setUploadError("")
    try {
      const payload: Record<string, unknown> = { url: appResultUrl.trim() }
      if (versioning) {
        payload.docGroup = versioning.groupId
      } else {
        payload.phase = uploadPhase !== "OTHER" ? uploadPhase : null
        payload.type = uploadType
      }
      if (changeNote.trim()) payload.changeNote = changeNote.trim()
      if (uploadDcId) payload.designChangeId = uploadDcId
      const res = await fetch(`/api/demands/${demandId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowUploadDialog(false)
        resetUploadFields()
        setVersioning(null)
        onRefresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setUploadError(data.error || `儲存失敗 (${res.status})`)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "網路錯誤")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!token) return
    setDeletingId(docId)
    try {
      const res = await fetch(`/api/demands/${demandId}/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) onRefresh()
    } catch { /* ignore */ } finally {
      setDeletingId(null)
    }
  }

  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleDownload = useCallback(async (doc: Document) => {
    if (!token) return
    setDownloadingId(doc.id)
    try {
      const res = await fetch(`/api/demands/${demandId}/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.fileName.replace(/\.[^.]+$/, ".pdf")
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* ignore */ } finally {
      setDownloadingId(null)
    }
  }, [token, demandId])

  // Get available doc types for selected phase
  const availableTypes = () => {
    const config = PHASE_DOCUMENT_MAP[uploadPhase]
    if (!config) return [{ value: "ATTACHMENT", label: "一般附件" }]
    const all = [...config.required, ...config.optional]
    const unique = [...new Set(all)]
    return unique.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] || t }))
  }

  const renderDocGroup = (group: DocGroup) => {
    const activeId = selectedVersions[group.groupId] || group.latest.id
    const active = group.versions.find((v) => v.id === activeId) || group.latest
    const hasVersions = group.versions.length > 1
    const isViewingHistory = active.id !== group.latest.id

    const isExternalLink = LINK_TYPES.has(active.type) && active.fileUrl?.startsWith("http")
    const { icon: Icon, color: iconColor } = isExternalLink
      ? { icon: ExternalLink, color: "text-blue-500" }
      : getFileIconAndColor(active.fileName)
    const isOwnDoc = userId && active.uploadedBy === userId
    const isAdmin = userRole === "admin"
    const docCanDownload = canDownload && (isAdmin || isOwnDoc)
    const docCanDelete = canUpload && (isAdmin || isOwnDoc)
    const linkedDc = active.designChange

    return (
      <div
        key={group.groupId}
        className={cn(
          "rounded-md border transition-colors overflow-hidden",
          selectedDocId === active.id && "ring-2 ring-primary/40 bg-primary/[0.03]",
        )}
      >
        {/* Main row */}
        <div
          className={cn(
            "flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2.5 overflow-hidden",
            onDocumentSelect && "cursor-pointer hover:bg-muted/50",
          )}
          onClick={() => onDocumentSelect?.(active)}
        >
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0", iconColor)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {isExternalLink ? (
                  <a
                    href={active.fileUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs sm:text-sm font-medium text-blue-600 hover:underline truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {active.fileUrl}
                  </a>
                ) : (
                  <p className="text-xs sm:text-sm font-medium truncate">{active.fileName}</p>
                )}
                {!hasVersions && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-4 px-1 rounded shrink-0 font-semibold tabular-nums bg-primary/10 text-primary"
                  >
                    v{active.version || 1}
                  </Badge>
                )}
                {active.signoffSource && SIGNOFF_SOURCE_BADGE[active.signoffSource] && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] h-4 px-1 rounded shrink-0 font-normal",
                      SIGNOFF_SOURCE_BADGE[active.signoffSource].className,
                    )}
                  >
                    {SIGNOFF_SOURCE_BADGE[active.signoffSource].label}
                  </Badge>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {DOCUMENT_TYPE_LABELS[active.type] || active.type}
                {active.fileSize ? ` · ${formatFileSize(active.fileSize)}` : ""}
                {` · ${fmtDate(active.createdAt)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0 sm:gap-0.5 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
            {/* Version switcher */}
            {hasVersions && (
              <Select
                value={activeId}
                onValueChange={(v) => setSelectedVersions((prev) => ({ ...prev, [group.groupId]: v }))}
              >
                <SelectTrigger className={cn(
                  "h-6 sm:h-7 w-auto gap-1 px-1.5 text-[10px] sm:text-xs shrink-0 [&>svg:last-child]:h-3 [&>svg:last-child]:w-3",
                  isViewingHistory ? "border-amber-300 bg-amber-50 text-amber-700" : "border-muted-foreground/20",
                )}>
                  <History className="h-3 w-3 shrink-0 opacity-70" />
                  <span className="font-semibold tabular-nums">v{active.version || 1}</span>
                </SelectTrigger>
                <SelectContent align="end">
                  {group.versions.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      <span className="font-semibold tabular-nums">v{v.version || 1}</span>
                      <span className="text-muted-foreground ml-1.5">{fmtDate(v.createdAt)}</span>
                      {v.id === group.latest.id && <span className="text-primary ml-1">· 最新</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {docCanDownload && active.fileUrl && !isExternalLink && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 sm:h-8 sm:w-8"
                onClick={() => handleDownload(active)}
                disabled={downloadingId === active.id}
                title="下載 PDF"
              >
                {downloadingId === active.id
                  ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  : <Download className="h-3 w-3 sm:h-4 sm:w-4" />}
              </Button>
            )}
            {docCanDownload && isExternalLink && (
              <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8" asChild>
                <a href={active.fileUrl!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                </a>
              </Button>
            )}
            {canUpload && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/60 hover:text-primary"
                onClick={() => openVersionUpload(group)}
                title="上傳新版本"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            )}
            {docCanDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/40 hover:text-destructive"
                onClick={() => handleDelete(active.id)}
                disabled={deletingId === active.id}
                title="刪除此版本"
              >
                {deletingId === active.id ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" /> : <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
              </Button>
            )}
          </div>
        </div>

        {/* Change note / linked design change for the active version */}
        {(active.changeNote || linkedDc) && (
          <div className="border-t bg-muted/20 px-2.5 sm:px-3 py-1.5 space-y-1">
            {active.changeNote && (
              <div className="flex items-start gap-1.5">
                <FileEdit className="h-3 w-3 text-muted-foreground/60 mt-0.5 shrink-0" />
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/70">v{active.version || 1} 更新說明：</span>
                  {active.changeNote}
                </p>
              </div>
            )}
            {linkedDc && (
              <div className="flex items-center gap-1.5">
                <History className="h-3 w-3 text-indigo-500/70 shrink-0" />
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-indigo-50 text-indigo-700 border-indigo-200 font-normal">
                  因 DC-{String(linkedDc.seq).padStart(2, "0")}「{linkedDc.title}」而更新
                </Badge>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const allPhases = [
    ...PIPELINE_STEPS.map((phase) => ({
      key: phase,
      label: STATUS_MAP[phase]?.label || phase,
      color: PHASE_COLORS[phase],
      docs: getPhaseDocuments(phase),
      required: getRequiredStatus(phase),
    })),
    ...(getUnassignedDocuments().length > 0
      ? [{ key: "OTHER", label: "其他", color: "oklch(0.6 0 0)", docs: getUnassignedDocuments(), required: [] as ReturnType<typeof getRequiredStatus> }]
      : []),
  ]

  const activeData = allPhases.find((p) => p.key === activePhase)
  const activeGroups = activeData ? groupDocs(activeData.docs) : []

  return (
    <div className="min-w-0 overflow-hidden">
      {!activeData ? (
        /* ── Phase list ── */
        allPhases.map((phase, idx) => {
          const groupCount = groupDocs(phase.docs).length
          const reqDone = phase.required.filter((r) => r.uploaded).length
          const reqTotal = phase.required.length
          return (
            <div key={phase.key}>
              {idx > 0 && <Separator />}
              <button
                className="flex items-center w-full gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-2.5 sm:py-3 text-left transition-colors hover:bg-muted/40"
                onClick={() => setActivePhase(phase.key)}
              >
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: phase.color }}
                />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  {phase.label}
                </span>
                {groupCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full font-medium">
                    {groupCount}
                  </Badge>
                )}
                <span className="flex-1" />
                {reqTotal > 0 && (
                  <span className={cn(
                    "text-[11px] font-medium tabular-nums",
                    reqDone === reqTotal ? "text-emerald-600" : "text-muted-foreground/50",
                  )}>
                    {reqDone}/{reqTotal}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </button>
            </div>
          )
        })
      ) : (
        /* ── Selected phase detail ── */
        <div>
          {/* Back + phase title */}
          <button
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            onClick={() => setActivePhase(null)}
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>返回</span>
          </button>
          <Separator />
          <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-2.5 sm:py-3">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: activeData.color }}
            />
            <span className="text-xs sm:text-sm font-semibold">{activeData.label}</span>
            {activeGroups.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full font-medium">
                {activeGroups.length}
              </Badge>
            )}
            {canUpload && activeData.key !== "OTHER" && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-6 sm:h-7 text-[11px] sm:text-xs px-2"
                onClick={() => { setActivePhase(activeData.key); openNewUpload() }}
              >
                <Upload className="h-3 w-3 mr-1" />
                上傳
              </Button>
            )}
          </div>

          <div className="px-2.5 sm:px-3 pb-3 space-y-2 min-w-0 overflow-hidden">
            {/* Required checklist */}
            {activeData.required.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3 space-y-1.5 sm:space-y-2">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground">必要文件</p>
                {activeData.required.map((item) => (
                  <div key={item.type} className="flex items-center gap-2 sm:gap-2.5">
                    {item.uploaded ? (
                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/30 shrink-0" />
                    )}
                    <span className={cn("text-xs sm:text-sm", item.uploaded ? "text-foreground" : "text-muted-foreground/50")}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Document groups —— 一般文件在前，其後依簽核往返分區 */}
            {activeGroups.length > 0 ? (
              <div className="space-y-1.5 min-w-0">
                {sectionizeDocs(activeGroups).map((sec) => {
                  const open = sec.title ? (sectionOpen[sec.key] ?? !!sec.defaultOpen) : true
                  return (
                    <div key={sec.key} className="space-y-1.5">
                      {sec.title && (
                        <button
                          type="button"
                          onClick={() => setSectionOpen((prev) => ({ ...prev, [sec.key]: !open }))}
                          className="flex w-full items-center gap-1.5 pt-1.5 text-left"
                          title={open ? "收合此次往返" : "展開此次往返"}
                        >
                          <ChevronRight
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform",
                              open && "rotate-90",
                            )}
                          />
                          <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                          <span className="shrink-0 text-xs font-medium text-foreground/80 sm:text-[13px]">{sec.title}</span>
                          {sec.status && SIGNOFF_STATUS_MAP[sec.status] && (
                            <Badge className={cn("h-[18px] shrink-0 px-1.5 text-[11px] font-normal", SIGNOFF_STATUS_MAP[sec.status].color)}>
                              {SIGNOFF_STATUS_MAP[sec.status].label}
                            </Badge>
                          )}
                          <span className="shrink-0 text-[11px] text-muted-foreground/60">{sec.groups.length} 份</span>
                          <span className="h-px flex-1 bg-border/60" />
                        </button>
                      )}
                      {open && sec.groups.map(renderDocGroup)}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/40 text-center py-4">尚無文件</p>
            )}
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => { setShowUploadDialog(open); if (!open) { resetUploadFields(); setVersioning(null) } }}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-md p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {versioning ? "上傳新版本" : isLinkType ? `新增${DOCUMENT_TYPE_LABELS[uploadType] || "連結"}` : "上傳文件"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {versioning ? (
              /* 更新既有文件 → 顯示鎖定的目標資訊 */
              <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  更新文件
                </div>
                <p className="text-sm font-medium truncate">{versioning.fileName}</p>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">{versioning.phaseLabel} · {versioning.typeLabel}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                  <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-primary/10 text-primary font-semibold">新版本 v{versioning.nextVersion}</Badge>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium">所屬階段</label>
                  <Select value={uploadPhase} onValueChange={setUploadPhase}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STEPS.map((phase) => (
                        <SelectItem key={phase} value={phase}>
                          {STATUS_MAP[phase]?.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="OTHER">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">文件類型</label>
                  <Select value={uploadType} onValueChange={setUploadType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes().map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {isLinkType ? (
              <div>
                <label className="text-sm font-medium">{versioning?.typeLabel || DOCUMENT_TYPE_LABELS[uploadType] || "連結"}</label>
                <Input
                  className="mt-1"
                  placeholder={uploadType === "GITHUB_REPO" ? "https://github.com/..." : "https://..."}
                  value={appResultUrl}
                  onChange={(e) => setAppResultUrl(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">選擇檔案</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={!versioning}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg,.mp4,.webm"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || [])
                    const videoExts = new Set(["mp4", "webm"])
                    const getLimit = (f: File) => {
                      const ext = f.name.split(".").pop()?.toLowerCase() || ""
                      return videoExts.has(ext) ? 50 * 1024 * 1024 : 20 * 1024 * 1024
                    }
                    const oversized = selected.filter((f) => f.size > getLimit(f))
                    if (oversized.length > 0) {
                      const ext = oversized[0].name.split(".").pop()?.toLowerCase() || ""
                      const limitMB = videoExts.has(ext) ? 50 : 20
                      setUploadError(`檔案「${oversized[0].name}」超過 ${limitMB}MB 限制`)
                    }
                    const ok = selected.filter((f) => f.size <= getLimit(f))
                    setSelectedFiles(versioning ? ok.slice(0, 1) : ok)
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full mt-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {selectedFiles.length > 0
                    ? `已選擇 ${selectedFiles.length} 個檔案`
                    : versioning ? "點擊選擇新版本檔案" : "點擊選擇檔案"}
                </Button>
              </div>
            )}

            {/* 更新說明 —— 讓相關人知道為什麼更新 */}
            <div>
              <label className="text-sm font-medium">更新說明{versioning ? "" : "（選填）"}</label>
              <Textarea
                className="mt-1 text-sm"
                rows={2}
                placeholder="說明這次文件為什麼更新、更新了什麼內容…"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
              />
            </div>

            {/* 關聯設計變更（選填） */}
            {designChanges.length > 0 && (
              <div>
                <label className="text-sm font-medium">關聯設計變更（選填）</label>
                <Select value={uploadDcId || "none"} onValueChange={(v) => setUploadDcId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="不關聯" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不關聯</SelectItem>
                    {designChanges.map((dc) => (
                      <SelectItem key={dc.id} value={dc.id}>
                        DC-{String(dc.seq).padStart(2, "0")}「{dc.title}」
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">若此次更新是因某個設計變更造成，可在此標註以利追溯。</p>
              </div>
            )}
          </div>
          {uploadError && (
            <p className="text-sm text-destructive font-medium">{uploadError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadDialog(false); resetUploadFields(); setVersioning(null) }}>取消</Button>
            {isLinkType ? (
              <Button onClick={handleSubmitLink} disabled={!appResultUrl.trim() || uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link className="h-4 w-4 mr-1" />}
                {versioning ? "儲存新版本" : "儲存連結"}
              </Button>
            ) : (
              <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {versioning ? "上傳新版本" : "上傳"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
