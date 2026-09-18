"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { TodoEditor, DUE_RE, type TodoPerson } from "@/components/demand/todo-editor"
import { TodoSidebar, type UpcomingItem } from "@/components/demand/todo-sidebar"
import { useAuth } from "@/hooks/use-auth"
import { STATUS_MAP, demandStatusKey } from "@/lib/constants/demand"
import { DATA_GAP_KINDS, type DerivedTodoItem } from "@/lib/demand-todo"
import { cn } from "@/lib/utils"
import {
  Loader2, Inbox, Search, AlertTriangle, ExternalLink, CheckCircle2,
  CalendarDays, Building2, NotebookPen, X,
} from "lucide-react"

interface TodoRow {
  id: string
  demandNumber: string
  title: string
  status: string
  isTerminated?: boolean
  vendor: string
  organization: string
  developer: { id: string; name: string } | null
  expectedDate: string | null
  desiredDate: string | null
  completedDate: string | null
  currentPhasePlan: {
    phase: string
    plannedStart: string | null
    plannedEnd: string | null
    actualStart: string | null
    actualEnd: string | null
  } | null
  phasePlans?: { phase: string; actualStart: string | null }[]
  contactPerson: { id: string; name: string } | null
  pm: { id: string; name: string } | null
  subTasks: {
    id: string
    name: string
    status: string
    plannedStart: string | null
    plannedEnd: string | null
    actualStart: string | null
    actualEnd: string | null
    assignee: { id: string; name: string } | null
  }[]
  /** 該廠人員（Scrum Master／需求方），供 @ 標註挑人 */
  orgPeople?: { role: string; name: string }[]
  todo: {
    content: string
    overdueNote: string | null
    updatedAt: string
    updatedBy: { id: string; name: string } | null
  } | null
  derived: DerivedTodoItem[]
}

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" }) : "—"
/** 逐行解析 checklist 用 */
const NEWLINE = String.fromCharCode(10)

const toInput = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "")

/**
 * 已結束的狀態預設收起來——追蹤時看的幾乎都是還在跑的案子，
 * 結案／取消／終止留在清單裡只會稀釋注意力，需要時再打開。
 */
const FINISHED = new Set(["CLOSED", "CANCELLED", "TERMINATED"])

/** 清單排序：進行中的排前面，已結束的沉到最下方 */
const PHASE_ORDER = ["SUBMITTED", "PRD_REVIEW", "SP_REVIEW", "DEVELOPING", "ACCEPTANCE", "ON_HOLD"]

/**
 * 篩選選單的分組——與需求列表一致。
 * 已結案屬於流程的最後一個階段（走完全程），與「中途停掉」的終止、取消不同類。
 */
const PIPELINE_STATUSES = ["SUBMITTED", "PRD_REVIEW", "SP_REVIEW", "DEVELOPING", "ACCEPTANCE", "CLOSED"]
const INACTIVE_STATUSES = ["ON_HOLD", "TERMINATED", "CANCELLED"]

/**
 * 專案待辦（內部用）。
 *
 * 版面刻意做成「左側專案清單 + 右側一頁筆記」，而不是一長串可收合的列表：
 * 這頁的使用情境是「挑一個專案、專心寫它的待辦」，兩欄式讓右邊有完整空間，
 * 寫起來才像記事本而不是填表格。
 *
 * 定位仍是團隊自我管理：不指派、不簽核、不影響 SP，也不對需求方與 Scrum Master 開放。
 */
export default function TodoPage() {
  const { token, user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [rows, setRows] = useState<TodoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [onlyTodo, setOnlyTodo] = useState(false)
  const [showFinished, setShowFinished] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [pickedDate, setPickedDate] = useState<Date | null>(null)
  /** 開發任務區塊的展開覆寫；未設定時依「是否填完」決定預設 */
  const [taskOpen, setTaskOpen] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/todos", { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        const list: TodoRow[] = data.todos ?? []
        setRows(list)
        setActiveId((prev) => prev ?? list[0]?.id ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const patch = useCallback(async (
    demandId: string,
    payload: { content?: string; overdueNote?: string; actualEnd?: string | null },
  ) => {
    if (!token) return
    const res = await fetch(`/api/demands/${demandId}/todo`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return
    const data = await res.json()
    setRows((prev) =>
      prev.map((r) =>
        r.id === demandId
          ? {
              ...r,
              todo: data.todo,
              currentPhasePlan:
                payload.actualEnd !== undefined && r.currentPhasePlan
                  ? { ...r.currentPhasePlan, actualEnd: payload.actualEnd }
                  : r.currentPhasePlan,
            }
          : r
      )
    )
  }, [token])

  /** 顯示用狀態鍵：已終止與已結案要分開（資料庫狀態都是 CLOSED） */
  const keyOf = (r: TodoRow) => demandStatusKey(r.status, r.isTerminated)

  /** 子任務的實際完成日：直接寫回甘特圖細項，與需求頁同一份資料 */
  const saveSubTask = useCallback(async (demandId: string, taskId: string, actualEnd: string | null) => {
    if (!token) return
    const res = await fetch(`/api/demands/${demandId}/sub-tasks/${taskId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ actualEnd }),
    })
    if (!res.ok) return
    setRows((prev) =>
      prev.map((r) =>
        r.id === demandId
          ? { ...r, subTasks: r.subTasks.map((t) => (t.id === taskId ? { ...t, actualEnd } : t)) }
          : r
      )
    )
  }, [token])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    const list = rows.filter((r) => {
      const key = keyOf(r)
      if (statusFilter !== "all" && key !== statusFilter) return false
      if (statusFilter === "all" && !showFinished && FINISHED.has(key)) return false
      if (onlyTodo && r.derived.length === 0 && !r.todo?.content?.trim()) return false
      if (pickedDate) {
        // 月曆上的點包含兩種來源：階段預計完成日、以及自己壓在待辦上的日期，
        // 兩者都要能篩到，否則點下去會出現空清單。
        const want = pickedDate.toDateString()
        const phaseDue = r.currentPhasePlan?.plannedEnd
        const hit =
          (!!phaseDue && new Date(phaseDue).toDateString() === want) ||
          (r.todo?.content ?? "")
            .split(NEWLINE)
            .some((line) => {
              if (/^\s*[-*]\s+\[[xX]\]/.test(line)) return false
              return [...line.matchAll(new RegExp(DUE_RE.source, "g"))].some(
                (m) => new Date(m[1]).toDateString() === want
              )
            })
        if (!hit) return false
      }
      if (!kw) return true
      return (
        r.demandNumber.toLowerCase().includes(kw) ||
        r.title.toLowerCase().includes(kw) ||
        r.organization.toLowerCase().includes(kw)
      )
    })
    // 進行中優先，已結束的沉底
    return list.sort((a, b) => {
      const ai = PHASE_ORDER.indexOf(a.status)
      const bi = PHASE_ORDER.indexOf(b.status)
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
  }, [rows, search, onlyTodo, showFinished, statusFilter, pickedDate])

  /** 各狀態筆數，供篩選器顯示 */
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(keyOf(r), (m.get(keyOf(r)) ?? 0) + 1)
    return m
  }, [rows])

  const active = useMemo(
    () => filtered.find((r) => r.id === activeId) ?? filtered[0] ?? null,
    [filtered, activeId]
  )
  const totalDerived = rows.reduce((s, r) => s + r.derived.length, 0)

  /**
   * 開發任務的展開規則。
   *
   * 子任務是開案後才會建立的，開案前（需求確認／PRD／開案確認）談「還沒填」沒有意義，
   * 故一律預設收起、也不標紅點；開案之後（開發中／驗收中／已結案）才視填寫狀況提醒。
   */
  const tasksRelevant =
    !!active &&
    (["DEVELOPING", "ACCEPTANCE"].includes(active.status) ||
      // 已結案／已終止者，只有真的進過開發階段才該有子任務
      !!active.phasePlans?.find((p) => p.phase === "DEVELOPING")?.actualStart)
  const tasksDone = !!active && active.subTasks.length > 0 && active.subTasks.every((t) => !!t.actualEnd)
  const tasksOpen = active ? (taskOpen[active.id] ?? (tasksRelevant && !tasksDone)) : false

  /**
   * 自己在待辦上壓的日期（!YYYY-MM-DD）。
   * 不限定要寫在打勾項目上——隨手記一行「9/25 要給客戶」也該進月曆；
   * 只有已勾掉的項目會略過（那件事做完了）。
   */
  const selfDueDates = useMemo(() => {
    const out: Date[] = []
    const all = new RegExp(DUE_RE.source, "g")
    for (const r of rows) {
      for (const line of (r.todo?.content ?? "").split(NEWLINE)) {
        if (/^\s*[-*]\s+\[[xX]\]/.test(line)) continue
        for (const m of line.matchAll(all)) out.push(new Date(m[1]))
      }
    }
    return out
  }, [rows])

  // 月曆標記：各專案本階段的預計完成日（待辦自壓的日期分開標色）
  const markedDates = useMemo(
    () =>
      rows
        .map((r) => r.currentPhasePlan?.plannedEnd)
        .filter((d): d is string => !!d)
        .map((d) => new Date(d)),
    [rows]
  )

  /**
   * 「接下來要做」：跨專案取尚未勾選的 checklist 項目，依預計完成日由近到遠。
   * 純顯示用，不改動任何資料。
   */
  const upcoming = useMemo<UpcomingItem[]>(() => {
    const items: UpcomingItem[] = []
    for (const r of rows) {
      const content = r.todo?.content ?? ""
      if (!content.trim()) continue
      for (const line of content.split(NEWLINE)) {
        const m = line.match(/^\s*[-*]\s+\[\s\]\s*(.+)$/)
        if (!m) continue
        // 自己壓的日期優先；沒壓才退回本階段預計完成日（後者只是參考，會標「階段」）
        const dueToken = m[1].match(DUE_RE)
        items.push({
          demandId: r.id,
          demandNumber: r.demandNumber,
          demandTitle: r.title,
          text: m[1].replace(DUE_RE, "").replace(/[*_`~]/g, "").trim(),
          due: dueToken ? dueToken[1] : (r.currentPhasePlan?.plannedEnd ?? null),
          selfDue: !!dueToken,
        })
      }
    }
    return items.sort((a, b) => {
      if (!a.due) return 1
      if (!b.due) return -1
      return new Date(a.due).getTime() - new Date(b.due).getTime()
    })
  }, [rows])

  /** 供 @ 標註的人員：本案實際的角色 + 甲特圖細項的負責人（去重） */
  const people = useMemo<TodoPerson[]>(() => {
    if (!active) return []
    const list: TodoPerson[] = []
    const add = (role: string, name?: string | null) => {
      if (name && !list.some((x) => x.name === name)) list.push({ role, name })
    }
    // 自己排第一個：這本來就是自己的記事本，「這件事我要做」是最常寫的一種
    add("我", user?.name)
    add("PM", active.pm?.name)
    add("開發者", active.developer?.name)
    add("需求窗口", active.contactPerson?.name)
    for (const t of active.subTasks) add("任務負責人", t.assignee?.name)
    // Scrum Master 每廠不同人，IT 之類的窗口也只能從該廠人員裡挑
    for (const p of active.orgPeople ?? []) add(p.role, p.name)
    return list
  }, [active, user])

  return (
    <AppLayout userRole={isAdmin ? "admin" : "delivery"}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl">專案待辦</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {isAdmin ? "所有專案" : "您負責的專案"}——內部記事本，需求方與 Scrum Master 看不到
            </p>
          </div>
          {totalDerived > 0 && (
            <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-700">
              {totalDerived} 項待處理
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border bg-card py-20 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />載入中…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card py-20 text-center text-muted-foreground">
            <Inbox className="mx-auto mb-2 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm">目前沒有需要處理的專案</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            {/* 左：專案清單 */}
            <aside className="w-full shrink-0 lg:w-80">
              <div className="rounded-xl border bg-card">
                <div className="space-y-2 border-b p-2.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="搜尋專案…"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  {/* 開關做成 segmented：有邊框與底色，開／關一眼看得出 */}
                  <div className="flex gap-1 rounded-md border p-0.5">
                    <ToggleChip active={onlyTodo} onClick={() => setOnlyTodo((v) => !v)}>
                      只看有待辦
                    </ToggleChip>
                    <ToggleChip
                      active={showFinished}
                      onClick={() => setShowFinished((v) => !v)}
                      title="已結案、已取消、已終止預設隱藏"
                    >
                      含已結束
                    </ToggleChip>
                  </div>

                  {/* 狀態篩選：與需求列表同一套分組樣式 */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder="全部狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">全部狀態（{rows.length}）</SelectItem>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />流程階段
                        </SelectLabel>
                        {/* 所有狀態都列出（含 0 筆），才看得出「這個階段目前沒有案子」 */}
                        {PIPELINE_STATUSES.map((k) => (
                          <SelectItem
                            key={k}
                            value={k}
                            className={cn("text-xs", !statusCounts.get(k) && "text-muted-foreground/60")}
                          >
                            {(STATUS_MAP[k] ?? { label: k }).label}（{statusCounts.get(k) ?? 0}）
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />已結束 / 非進行中
                        </SelectLabel>
                        {INACTIVE_STATUSES.map((k) => (
                            <SelectItem
                              key={k}
                              value={k}
                              className={cn("text-xs", !statusCounts.get(k) && "text-muted-foreground/60")}
                            >
                              {(STATUS_MAP[k] ?? { label: k }).label}（{statusCounts.get(k) ?? 0}）
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  {pickedDate && (
                    <button
                      type="button"
                      onClick={() => setPickedDate(null)}
                      className="flex w-full items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800"
                    >
                      <span>
                        只看 {pickedDate.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })} 到期
                      </span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="max-h-[calc(100vh-18rem)] overflow-y-auto p-1.5 lg:max-h-[calc(100vh-14rem)]">
                  {filtered.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">沒有符合條件的專案</p>
                  ) : (
                    filtered.map((r) => {
                      const st = STATUS_MAP[keyOf(r)] ?? { label: r.status, color: "" }
                      const isActive = active?.id === r.id
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setActiveId(r.id)}
                          className={cn(
                            "mb-1 w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                            isActive ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/60",
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-muted-foreground">{r.demandNumber}</span>
                            <Badge className={cn("h-4 px-1 text-[9px] font-normal", st.color)}>{st.label}</Badge>
                            <span className="ml-auto flex items-center gap-1">
                              {/* 紅點：甘特圖該填未填（缺預計日、過期未登記、結案未補登） */}
                              {r.derived.some((d) => DATA_GAP_KINDS.includes(d.kind)) && (
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                                  title="甘特圖的預計／實際完成日尚未填齊"
                                />
                              )}
                              {r.derived.length > 0 && (
                                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 text-[9px] font-medium text-amber-700">
                                  {r.derived.length}
                                </span>
                              )}
                            </span>
                          </div>
                          <p className={cn("mt-0.5 line-clamp-2 text-xs leading-snug", isActive ? "font-medium text-foreground" : "text-foreground/80")}>
                            {r.title}
                          </p>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </aside>

            {/* 中：單一專案的筆記頁。篩選不到時仍保留版面，避免整塊消失 */}
            {!active ? (
              <section className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border bg-card py-20 text-muted-foreground">
                <Inbox className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">沒有符合條件的專案</p>
                <p className="text-xs text-muted-foreground/70">調整左側的搜尋或篩選條件</p>
                {(pickedDate || statusFilter !== "all" || onlyTodo) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 h-7 text-xs"
                    onClick={() => { setPickedDate(null); setStatusFilter("all"); setOnlyTodo(false) }}
                  >
                    清除所有篩選
                  </Button>
                )}
              </section>
            ) : (
              <section className="min-w-0 flex-1 rounded-xl border bg-card">
                <div className="space-y-4 p-5 sm:p-7">
                  {/* 標題區 */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{active.demandNumber}</span>
                      <Badge className={cn("text-[10px]", (STATUS_MAP[keyOf(active)] ?? {}).color)}>
                        {(STATUS_MAP[keyOf(active)] ?? { label: active.status }).label}
                      </Badge>
                      {/* 開發任務改成收合式：填完就收起來，沒填才預設展開並標紅點 */}
                      <button
                        type="button"
                        onClick={() => setTaskOpen((prev) => ({ ...prev, [active.id]: !tasksOpen }))}
                        title={tasksOpen ? "收合開發任務" : "展開開發任務"}
                        className={cn(
                          "relative ml-auto shrink-0 rounded-md border p-1.5 transition-colors",
                          tasksOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        {active.derived.some((d) => DATA_GAP_KINDS.includes(d.kind)) && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </button>
                      <Button asChild variant="outline" size="sm" className="h-7 shrink-0 text-xs">
                        <Link href={`/governance/demands/${active.id}`}>
                          <ExternalLink className="mr-1 h-3 w-3" />開啟需求
                        </Link>
                      </Button>
                    </div>
                    <h2 className="text-lg font-semibold leading-snug sm:text-2xl">{active.title}</h2>
                    {/* 誰是誰寫清楚，以 | 分隔——只寫公司名稱會分不出需求方與開發方 */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        需求公司 <span className="font-medium text-foreground">{active.organization}</span>
                      </span>
                      <span className="text-border">|</span>
                      <span>開發公司 <span className="font-medium text-foreground">{active.vendor}</span></span>
                      <span className="text-border">|</span>
                      <span>PM <span className="font-medium text-foreground">{active.pm?.name ?? "未指派"}</span></span>
                      <span className="text-border">|</span>
                      <span>開發者 <span className="font-medium text-foreground">{active.developer?.name ?? "未指派"}</span></span>
                      <span className="text-border">|</span>
                      <span>需求窗口 <span className="font-medium text-foreground">{active.contactPerson?.name ?? "未指派"}</span></span>
                    </div>
                  </div>

                  {/* 逾期說明：逾期時才出現，避免平時多一個沒人填的欄位 */}
                  {active.derived.some((d) => d.kind === "OVERDUE") && (
                    <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-red-800">
                        <AlertTriangle className="h-3.5 w-3.5" />逾期說明
                      </p>
                      <textarea
                        defaultValue={active.todo?.overdueNote ?? ""}
                        onBlur={(e) => patch(active.id, { overdueNote: e.target.value })}
                        placeholder="為什麼逾期？例如：等客戶回測試結果、等強茂 IT 開權限…"
                        className="min-h-[56px] w-full resize-y rounded-md border border-red-200 bg-white/70 p-2 text-xs outline-none focus:border-red-300"
                      />
                    </div>
                  )}

                  {/* 系統自動待辦 */}
                  {active.derived.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-800 sm:text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" />系統偵測到的待辦
                        <span className="font-normal text-amber-700/70">（補上後自動消失，不需手動勾選）</span>
                      </p>
                      <ul className="space-y-1.5">
                        {active.derived.map((d, i) => (
                          <li key={i} className="flex gap-2 text-xs text-amber-900">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                            <span>
                              <span className="font-medium">{d.label}</span>
                              {d.detail && <span className="text-amber-800/70"> — {d.detail}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" />系統層面沒有待處理事項
                    </p>
                  )}

                  {/* 甘特圖細項：預計日於需求頁排程（此處唯讀），實際完成日可就地補登 */}
                  {tasksOpen && (
                  <div className="rounded-lg border">
                    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-medium sm:text-xs">開發任務</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        希望完成 {fmt(active.desiredDate)}
                      </span>
                    </div>
                    {active.subTasks.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        尚未建立開發任務——請於需求頁的甘特圖新增
                      </p>
                    ) : (
                      <div className="divide-y">
                        {active.subTasks.map((t) => {
                          const late = !!t.plannedEnd && !t.actualEnd && new Date(t.plannedEnd) < new Date()
                          return (
                            <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                              <span className={cn("min-w-0 flex-1 truncate text-xs", late && "text-red-700")}>
                                {t.name}
                                {t.assignee && (
                                  <span className="ml-1.5 text-[10px] text-muted-foreground">{t.assignee.name}</span>
                                )}
                              </span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                預計 {fmt(t.plannedEnd)}
                              </span>
                              <Input
                                type="date"
                                value={toInput(t.actualEnd)}
                                onChange={(e) => saveSubTask(active.id, t.id, e.target.value || null)}
                                className={cn("h-7 w-[8.5rem] shrink-0 text-xs", late && "border-red-300")}
                                title="實際完成日"
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* 自己寫的筆記 */}
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
                      <NotebookPen className="h-3.5 w-3.5" />我的待辦
                    </p>
                    <TodoEditor
                      key={active.id}
                      value={active.todo?.content ?? ""}
                      people={people}
                      onSave={(content) => patch(active.id, { content })}
                    />
                    {active.todo?.updatedBy && (
                      <p className="text-right text-[10px] text-muted-foreground/70">
                        最後編輯：{active.todo.updatedBy.name} · {new Date(active.todo.updatedAt).toLocaleString("zh-TW")}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* 右：行事曆與近期待辦 */}
            <TodoSidebar
              markedDates={markedDates}
              todoDates={selfDueDates}
              upcoming={upcoming}
              onSelect={(id) => setActiveId(id)}
              selectedDate={pickedDate}
              onSelectDate={setPickedDate}
            />
          </div>
        )}
      </div>
    </AppLayout>
  )
}

/** 小型開關：有底色與邊框，開／關狀態一眼看得出來 */
function ToggleChip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded px-2 py-1 text-[11px] transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
