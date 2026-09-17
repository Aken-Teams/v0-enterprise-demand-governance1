"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { CalendarDays, ChevronDown, ListTodo, PanelRightClose, PanelRightOpen } from "lucide-react"

export interface UpcomingItem {
  demandId: string
  demandNumber: string
  /** checklist 裡尚未勾選的文字 */
  text: string
  /** 該專案本階段預計完成日，供排序與顯示 */
  due: string | null
}

interface TodoSidebarProps {
  /** 有預計完成日的日期，會在月曆上標點 */
  markedDates: Date[]
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
export function TodoSidebar({ markedDates, upcoming, onSelect, selectedDate, onSelectDate }: TodoSidebarProps) {
  const [panelOpen, togglePanel] = useSticky("todo-side-open", true)
  const [calOpen, toggleCal] = useSticky("todo-cal-open", true)
  const [listOpen, toggleList] = useSticky("todo-upcoming-open", true)
  const [month, setMonth] = useState<Date>(new Date())

  const marked = useMemo(
    () => markedDates.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())),
    [markedDates]
  )

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
            <span className="shrink-0 text-[11px] text-muted-foreground">{marked.length} 個交件日</span>
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
              modifiers={{ due: marked }}
              modifiersClassNames={{
                due: "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-amber-500",
              }}
              className="w-full"
            />
            <p className="px-3 pb-1 text-[10px] text-muted-foreground">
              <span className="mr-1 inline-block h-1 w-1 rounded-full bg-amber-500 align-middle" />
              有專案預計於該日完成{selectedDate ? "．點同一天可取消篩選" : "．點日期可篩選左側清單"}
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
              upcoming.slice(0, 5).map((item, i) => (
                <button
                  key={`${item.demandId}-${i}`}
                  type="button"
                  onClick={() => onSelect?.(item.demandId)}
                  className="mb-0.5 flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs leading-snug">{item.text}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="font-mono">{item.demandNumber}</span>
                      {item.due && (
                        <span>
                          · {new Date(item.due).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })} 到期
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
