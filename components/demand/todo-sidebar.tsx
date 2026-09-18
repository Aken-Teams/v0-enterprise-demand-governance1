"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { CalendarDays, ChevronDown, ListTodo, PanelRightClose, PanelRightOpen } from "lucide-react"

/** 月曆標點的共用樣式（顏色與偏移另外接） */
const DOT = "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:rounded-full"

/** 依專案分組，組內維持原本（依日期）的順序 */
function groupByDemand(items: UpcomingItem[]) {
  const groups: { id: string; number: string; title: string; items: UpcomingItem[] }[] = []
  for (const it of items) {
    const g = groups.find((x) => x.id === it.demandId)
    if (g) g.items.push(it)
    else groups.push({ id: it.demandId, number: it.demandNumber, title: it.demandTitle, items: [it] })
  }
  return groups
}

/** 日期標籤：逾期紅、三天內橘，其餘灰 */
function dueChip(due: string, self?: boolean) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const d = new Date(due)
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today) / 86400000)
  const text =
    diff < 0 ? `逾期 ${-diff} 天` : diff === 0 ? "今天" : diff === 1 ? "明天" : `${d.getMonth() + 1}/${d.getDate()}`
  const tone =
    diff < 0 ? "bg-red-50 text-red-600" : diff <= 3 ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"
  return { text: self ? text : text + "（階段）", tone }
}

export interface UpcomingItem {
  demandId: string
  demandNumber: string
  demandTitle: string
  /** checklist 裡尚未勾選的文字 */
  text: string
  /** 日期（自己壓的優先，否則用本階段預計完成日），供排序與顯示 */
  due: string | null
  /** true 代表這個日期是自己在待辦上壓的，不是階段計畫的 */
  selfDue?: boolean
}

interface TodoSidebarProps {
  /** 階段預計完成日，會在月曆上標琥珀點 */
  markedDates: Date[]
  /** 自己在待辦上壓的日期，標天藍點（同一天兩種都有就並排兩點） */
  todoDates?: Date[]
  upcoming: UpcomingItem[]
  onSelect?: (demandId: string) => void
  /** 點選月曆日期時回傳；再點一次同一天即取消（回傳 null） */
  selectedDate?: Date | null
  onSelectDate?: (d: Date | null) => void
}

/** 收合狀態記在 localStorage，下次進來維持使用者的選擇 */
function useSticky(key: string, initial: boolean) {
  const [open, setOpen] = useState(initial)
  useEffect(() => {
    const v = localStorage.getItem(key)
    if (v != null) setOpen(v === "1")
  }, [key])
  return [
    open,
    () => setOpen((v) => { localStorage.setItem(key, v ? "0" : "1"); return !v }),
  ] as const
}

/**
 * 待辦頁右欄：小月曆 + 近期待辦。
 *
 * 月曆標出各專案本階段的預計完成日，讓人一眼看出這個月哪幾天要交件；
 * 下方列出跨專案、尚未勾選的待辦前五筆，當作「接下來要做什麼」的提醒。
 * 兩塊都可收合，狀態記在 localStorage。
 */
export function TodoSidebar({ markedDates, todoDates = [], upcoming, onSelect, selectedDate, onSelectDate }: TodoSidebarProps) {
  const [panelOpen, togglePanel] = useSticky("todo-side-open", true)
  const [calOpen, toggleCal] = useSticky("todo-cal-open", true)
  const [listOpen, toggleList] = useSticky("todo-upcoming-open", true)
  const [month, setMonth] = useState<Date>(new Date())

  /**
   * 月曆標點分三種：只有階段日、只有待辦日、兩者都有。
   * 分開算是因為同一天兩種都有時要並排兩顆點——共用同一個 after 偽元素會互相蓋掉。
   */
  const { phaseOnly, todoOnly, both, marked } = useMemo(() => {
    const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const key = (d: Date) => d.getTime()
    const phaseSet = new Set(markedDates.map((d) => key(day(d))))
    const todoSet = new Set(todoDates.map((d) => key(day(d))))
    const all = new Set([...phaseSet, ...todoSet])
    const phaseOnly: Date[] = []
    const todoOnly: Date[] = []
    const both: Date[] = []
    for (const t of all) {
      const d = new Date(t)
      if (phaseSet.has(t) && todoSet.has(t)) both.push(d)
      else if (phaseSet.has(t)) phaseOnly.push(d)
      else todoOnly.push(d)
    }
    return { phaseOnly, todoOnly, both, marked: [...all].map((t) => new Date(t)) }
  }, [markedDates, todoDates])

  // 收合狀態：整欄往右縮成一條窄軌，寬度以 transition 動畫過渡
  if (!panelOpen) {
    return (
      <aside className="w-full shrink-0 transition-[width] duration-300 lg:w-10">
        <button
          type="button"
          onClick={togglePanel}
          title="展開行事曆"
          className="flex w-full items-center justify-center gap-2 rounded-xl border bg-card py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-full lg:flex-col lg:py-3"
        >
          <PanelRightOpen className="h-4 w-4 shrink-0" />
          <span className="text-[11px] lg:[writing-mode:vertical-rl]">行事曆</span>
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-full shrink-0 space-y-3 transition-[width] duration-300 lg:w-72">
      {/* 月曆 */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-1 px-2 py-2">
          <button
            type="button"
            onClick={toggleCal}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/60"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">行事曆</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{marked.length} 個到期日</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !calOpen && "-rotate-90")} />
          </button>
          {/* 收合整欄：常駐的獨立按鈕，不做成 hover 才出現（找不到就等於沒有） */}
          <button
            type="button"
            onClick={togglePanel}
            title="收合側欄"
            className="shrink-0 rounded-md border p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </button>
        </div>

        {calOpen && (
          <div className="border-t px-1 pb-2">
            <Calendar
              mode="single"
              month={month}
              onMonthChange={setMonth}
              selected={selectedDate ?? undefined}
              onSelect={(d) => {
                // 點同一天代表取消篩選
                if (!d) return onSelectDate?.(null)
                const same = selectedDate && d.toDateString() === selectedDate.toDateString()
                onSelectDate?.(same ? null : d)
              }}
              modifiers={{ phase: phaseOnly, todo: todoOnly, both }}
              modifiersClassNames={{
                phase: DOT + " after:-translate-x-1/2 after:bg-amber-500",
                todo: DOT + " after:-translate-x-1/2 after:bg-sky-500",
                both:
                  DOT +
                  " after:-translate-x-[3.5px] after:bg-amber-500" +
                  " before:absolute before:bottom-1 before:left-1/2 before:h-1 before:w-1 before:translate-x-[0.5px] before:rounded-full before:bg-sky-500",
              }}
              className="w-full"
            />
            <p className="space-y-0.5 px-3 pb-1 text-[10px] text-muted-foreground">
              <span className="mr-2 whitespace-nowrap">
                <span className="mr-1 inline-block h-1 w-1 rounded-full bg-amber-500 align-middle" />
                階段預計完成日
              </span>
              <span className="whitespace-nowrap">
                <span className="mr-1 inline-block h-1 w-1 rounded-full bg-sky-500 align-middle" />
                待辦壓的日期
              </span>
              <span className="block">
                {selectedDate ? "點同一天可取消篩選" : "點日期可篩選左側清單"}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* 近期待辦 */}
      <div className="rounded-xl border bg-card">
        <button
          type="button"
          onClick={toggleList}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        >
          <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">接下來要做</span>
          {upcoming.length > 0 && (
            <span className="text-[11px] text-muted-foreground">{upcoming.length}</span>
          )}
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !listOpen && "-rotate-90")} />
        </button>
        {listOpen && (
          <div className="border-t p-1.5">
            {upcoming.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                沒有未勾選的待辦
                <br />
                <span className="text-muted-foreground/70">在「我的待辦」用工具列的待辦鍵建立可打勾項目，這裡就會帶出來</span>
              </p>
            ) : (
              /* 依專案分組：只列事情看不出是誰家的事，專案名稱才是定位點 */
              groupByDemand(upcoming.slice(0, 8)).map((g) => (
                <div key={g.id} className="mb-1 last:mb-0">
                  <button
                    type="button"
                    onClick={() => onSelect?.(g.id)}
                    className="flex w-full items-baseline gap-1.5 rounded px-2 py-1 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{g.number}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{g.title}</span>
                  </button>
                  {g.items.map((item, i) => {
                    const chip = item.due ? dueChip(item.due, item.selfDue) : null
                    return (
                      <button
                        key={`${g.id}-${i}`}
                        type="button"
                        onClick={() => onSelect?.(item.demandId)}
                        className="flex w-full items-start gap-2 rounded-lg py-1 pl-4 pr-2 text-left transition-colors hover:bg-muted/60"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        <span className="min-w-0 flex-1 text-xs leading-snug">
                          <span className="align-middle">{item.text}</span>
                          {chip && (
                            <span className={cn("ml-1.5 shrink-0 rounded px-1 py-0.5 align-middle text-[10px]", chip.tone)}>
                              {chip.text}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
