"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TodoEditor } from "@/components/demand/todo-editor"
import { useAuth } from "@/hooks/use-auth"
import { STATUS_MAP, demandStatusKey } from "@/lib/constants/demand"
import type { DerivedTodoItem } from "@/lib/demand-todo"
import { cn } from "@/lib/utils"
import {
  Loader2, Inbox, Search, AlertTriangle, ExternalLink, CheckCircle2,
  CalendarDays, Building2, NotebookPen,
} from "lucide-react"

interface TodoRow {
  id: string
  demandNumber: string
  title: string
  status: string
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
const toInput = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "")

/** 由 Markdown 內容算出打勾進度，與編輯器的統計同一套規則 */
function countChecks(content: string) {
  const boxes = content.match(/^\s*[-*]\s+\[([ xX])\]/gm) ?? []
  return { done: boxes.filter((b) => /\[[xX]\]/.test(b)).length, total: boxes.length }
}

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

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (onlyTodo && r.derived.length === 0 && !r.todo?.content?.trim()) return false
      if (!kw) return true
      return (
        r.demandNumber.toLowerCase().includes(kw) ||
        r.title.toLowerCase().includes(kw) ||
        r.organization.toLowerCase().includes(kw)
      )
    })
  }, [rows, search, onlyTodo])

  const active = useMemo(
    () => filtered.find((r) => r.id === activeId) ?? filtered[0] ?? null,
    [filtered, activeId]
  )
  const totalDerived = rows.reduce((s, r) => s + r.derived.length, 0)

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
                  <Button
                    variant={onlyTodo ? "default" : "ghost"}
                    size="sm"
                    className="h-7 w-full text-[11px]"
                    onClick={() => setOnlyTodo((v) => !v)}
                  >
                    只看有待辦的
                  </Button>
                </div>

                <div className="max-h-[calc(100vh-18rem)] overflow-y-auto p-1.5 lg:max-h-[calc(100vh-14rem)]">
                  {filtered.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">沒有符合條件的專案</p>
                  ) : (
                    filtered.map((r) => {
                      const st = STATUS_MAP[demandStatusKey(r.status)] ?? { label: r.status, color: "" }
                      const checks = countChecks(r.todo?.content ?? "")
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
                            {r.derived.length > 0 && (
                              <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 text-[9px] font-medium text-amber-700">
                                {r.derived.length}
                              </span>
                            )}
                          </div>
                          <p className={cn("mt-0.5 line-clamp-2 text-xs leading-snug", isActive ? "font-medium text-foreground" : "text-foreground/80")}>
                            {r.title}
                          </p>
                          {checks.total > 0 && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${(checks.done / checks.total) * 100}%` }}
                                />
                              </div>
                              <span className="text-[9px] tabular-nums text-muted-foreground">
                                {checks.done}/{checks.total}
                              </span>
                            </div>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </aside>

            {/* 右：單一專案的筆記頁 */}
            {active && (
              <section className="min-w-0 flex-1 rounded-xl border bg-card">
                <div className="space-y-4 p-5 sm:p-7">
                  {/* 標題區 */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{active.demandNumber}</span>
                      <Badge className={cn("text-[10px]", (STATUS_MAP[demandStatusKey(active.status)] ?? {}).color)}>
                        {(STATUS_MAP[demandStatusKey(active.status)] ?? { label: active.status }).label}
                      </Badge>
                      <Link
                        href={`/governance/demands/${active.id}`}
                        className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        開啟需求<ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <h2 className="text-lg font-semibold leading-snug sm:text-2xl">{active.title}</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />{active.organization} · {active.vendor}
                      </span>
                      {active.developer && <span>開發：{active.developer.name}</span>}
                    </div>
                  </div>

                  {/* 時程：預計唯讀、實際可填 */}
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
                      <CalendarDays className="h-3.5 w-3.5" />本階段預計完成
                      <span className="font-medium text-foreground">{fmt(active.currentPhasePlan?.plannedEnd)}</span>
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
                      實際完成
                      <Input
                        type="date"
                        value={toInput(active.currentPhasePlan?.actualEnd)}
                        onChange={(e) => patch(active.id, { actualEnd: e.target.value || null })}
                        className="h-7 w-[8.5rem] text-xs"
                      />
                    </label>
                    <span className="text-[11px] text-muted-foreground sm:text-xs">
                      希望完成 <span className="font-medium text-foreground">{fmt(active.desiredDate)}</span>
                    </span>
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

                  {/* 自己寫的筆記 */}
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
                      <NotebookPen className="h-3.5 w-3.5" />我的待辦
                    </p>
                    <TodoEditor
                      key={active.id}
                      value={active.todo?.content ?? ""}
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
          </div>
        )}
      </div>
    </AppLayout>
  )
}
