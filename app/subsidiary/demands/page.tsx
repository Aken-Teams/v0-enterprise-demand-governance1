"use client"

import { useState, useMemo } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const ITEMS_PER_PAGE = 9

// 狀態定義
// 待審核分類：pending（待審核）, evaluating（評估中）
// 進行中分類：discussing（需求討論中）, unassigned（待分配）, developing（開發中）, testing（測試中）
// 待驗收分類：acceptance（待驗收）
// 已完成分類：completed（已完成）
// 已駁回分類：rejected（已駁回）
type DemandStatus = "pending" | "evaluating" | "discussing" | "unassigned" | "developing" | "testing" | "acceptance" | "completed" | "rejected"

interface Demand {
  id: string
  title: string
  description: string
  status: DemandStatus
  sp: number
  submittedDate: string
  expectedDate?: string
  sprintNumber?: number
  pm?: string
  developer?: string
  rejectReason?: string
}

// SP 統計對應儀表板:
// 已使用 244 SP = 已完成 (completed)
// 已承諾 100 SP = 進行中 (developing, testing, discussing, unassigned) + 待驗收 (acceptance)
// 剩餘可用 156 SP

const demands: Demand[] = [
  // === 進行中的需求 (developing, testing) ===
  {
    id: "REQ-2024-001",
    title: "客戶管理系統優化",
    description: "優化現有客戶管理介面，新增批次匯入功能與進階搜尋篩選",
    status: "developing",
    sp: 21,
    submittedDate: "2024-01-15",
    expectedDate: "2024-02-15",
    sprintNumber: 3,
    pm: "張治理",
    developer: "王小明",
  },
  {
    id: "REQ-2024-008",
    title: "庫存管理系統",
    description: "開發庫存管理模組，支援進銷存追蹤與低庫存警示",
    status: "testing",
    sp: 21,
    submittedDate: "2024-01-12",
    expectedDate: "2024-02-20",
    sprintNumber: 3,
    pm: "張治理",
    developer: "林小美",
  },
  {
    id: "REQ-2024-006",
    title: "員工考勤系統整合",
    description: "整合現有考勤系統 API，自動同步出勤紀錄",
    status: "developing",
    sp: 13,
    submittedDate: "2024-01-25",
    expectedDate: "2024-02-28",
    sprintNumber: 4,
    pm: "張治理",
    developer: "黃小強",
  },
  {
    id: "REQ-2024-010",
    title: "訂單追蹤系統",
    description: "開發訂單即時追蹤功能，支援狀態通知與物流整合",
    status: "developing",
    sp: 21,
    submittedDate: "2024-01-22",
    expectedDate: "2024-03-01",
    sprintNumber: 4,
    pm: "張治理",
    developer: "周小龍",
  },
  // === 待驗收的需求 (acceptance) - 24 SP ===
  {
    id: "REQ-2024-002",
    title: "報表匯出功能",
    description: "支援將報表匯出為 Excel 與 PDF 格式，含自訂欄位選擇",
    status: "acceptance",
    sp: 13,
    submittedDate: "2024-01-10",
    expectedDate: "2024-02-08",
    sprintNumber: 2,
    pm: "張治理",
    developer: "李小華",
  },
  {
    id: "REQ-2024-015",
    title: "客戶滿意度調查模組",
    description: "建立問卷調查功能，自動發送並統計客戶回饋",
    status: "acceptance",
    sp: 11,
    submittedDate: "2024-01-08",
    expectedDate: "2024-02-05",
    sprintNumber: 2,
    pm: "張治理",
    developer: "吳小芳",
  },
  // === 待審核的需求 (pending, evaluating) ===
  {
    id: "REQ-2024-003",
    title: "行動版介面開發",
    description: "開發響應式行動版網頁，支援主要業務功能操作",
    status: "evaluating",
    sp: 34,
    submittedDate: "2024-01-20",
    pm: "張治理",
  },
  {
    id: "REQ-2024-007",
    title: "客戶通知自動化",
    description: "建立自動化通知機制，支援 Email 與簡訊發送",
    status: "pending",
    sp: 5,
    submittedDate: "2024-01-28",
  },
  {
    id: "REQ-2024-009",
    title: "電子簽核流程",
    description: "建立線上簽核流程，支援多層級審批與電子簽章",
    status: "pending",
    sp: 13,
    submittedDate: "2024-01-30",
  },
  // === 已駁回的需求 (rejected) ===
  {
    id: "REQ-2024-005",
    title: "資料備份自動化",
    description: "建立自動化備份機制，每日備份重要資料至雲端",
    status: "rejected",
    sp: 8,
    submittedDate: "2024-01-18",
    rejectReason: "需求範圍過大，建議拆分為多個小需求後重新提交",
  },
  // === 已完成的需求 (completed) - 244 SP ===
  {
    id: "REQ-2024-004",
    title: "權限管理模組",
    description: "建立角色權限管理機制，支援細粒度功能權限控管",
    status: "completed",
    sp: 21,
    submittedDate: "2023-12-05",
    expectedDate: "2024-01-10",
    sprintNumber: 12,
    pm: "張治理",
    developer: "陳大文",
  },
  {
    id: "REQ-2023-042",
    title: "財務報表系統",
    description: "開發月結財務報表自動產出功能，含損益表與資產負債表",
    status: "completed",
    sp: 34,
    submittedDate: "2023-10-15",
    expectedDate: "2023-11-30",
    sprintNumber: 10,
    pm: "張治理",
    developer: "陳大文",
  },
  {
    id: "REQ-2023-038",
    title: "員工入職系統",
    description: "建立線上入職流程，含資料填寫、合約簽署、設備申請",
    status: "completed",
    sp: 21,
    submittedDate: "2023-09-20",
    expectedDate: "2023-10-25",
    sprintNumber: 9,
    pm: "張治理",
    developer: "王小明",
  },
  {
    id: "REQ-2023-035",
    title: "客戶資料分析平台",
    description: "建立客戶行為分析儀表板，支援 RFM 分析與客群分類",
    status: "completed",
    sp: 34,
    submittedDate: "2023-08-10",
    expectedDate: "2023-09-30",
    sprintNumber: 8,
    pm: "張治理",
    developer: "李小華",
  },
  {
    id: "REQ-2023-031",
    title: "電子發票串接",
    description: "整合財政部電子發票 API，自動開立與作廢發票",
    status: "completed",
    sp: 21,
    submittedDate: "2023-07-05",
    expectedDate: "2023-08-15",
    sprintNumber: 7,
    pm: "張治理",
    developer: "林小美",
  },
  {
    id: "REQ-2023-028",
    title: "供應商管理系統",
    description: "建立供應商資料庫，含評鑑機制與合約管理",
    status: "completed",
    sp: 21,
    submittedDate: "2023-06-01",
    expectedDate: "2023-07-10",
    sprintNumber: 6,
    pm: "張治理",
    developer: "陳大文",
  },
  {
    id: "REQ-2023-024",
    title: "會議室預約系統",
    description: "開發會議室線上預約功能，含衝突檢查與通知提醒",
    status: "completed",
    sp: 13,
    submittedDate: "2023-05-10",
    expectedDate: "2023-06-05",
    sprintNumber: 5,
    pm: "張治理",
    developer: "王小明",
  },
  {
    id: "REQ-2023-020",
    title: "請假系統優化",
    description: "優化請假申請流程，新增代理人機制與假別餘額查詢",
    status: "completed",
    sp: 13,
    submittedDate: "2023-04-15",
    expectedDate: "2023-05-10",
    sprintNumber: 4,
    pm: "張治理",
    developer: "李小華",
  },
  {
    id: "REQ-2023-016",
    title: "客戶合約管理",
    description: "建立合約到期提醒、續約追蹤與合約檔案管理",
    status: "completed",
    sp: 21,
    submittedDate: "2023-03-20",
    expectedDate: "2023-04-25",
    sprintNumber: 3,
    pm: "張治理",
    developer: "林小美",
  },
  {
    id: "REQ-2023-012",
    title: "銷售業績儀表板",
    description: "開發即時銷售數據儀表板，含目標達成率與趨勢分析",
    status: "completed",
    sp: 21,
    submittedDate: "2023-02-10",
    expectedDate: "2023-03-15",
    sprintNumber: 2,
    pm: "張治理",
    developer: "陳大文",
  },
  {
    id: "REQ-2023-008",
    title: "客戶聯絡紀錄",
    description: "建立客戶拜訪與聯絡紀錄功能，含跟進提醒",
    status: "completed",
    sp: 13,
    submittedDate: "2023-01-15",
    expectedDate: "2023-02-10",
    sprintNumber: 1,
    pm: "張治理",
    developer: "王小明",
  },
  {
    id: "REQ-2023-004",
    title: "基礎資料管理",
    description: "建立系統基礎資料維護功能，含部門、職位、幣別等",
    status: "completed",
    sp: 11,
    submittedDate: "2022-12-20",
    expectedDate: "2023-01-15",
    sprintNumber: 12,
    pm: "張治理",
    developer: "李小華",
  },
]

const statusConfig: Record<DemandStatus, { label: string; bgColor: string; textColor: string }> = {
  pending: { label: "待審核", bgColor: "bg-amber-500", textColor: "text-white" },
  evaluating: { label: "評估中", bgColor: "bg-amber-600", textColor: "text-white" },
  discussing: { label: "需求討論中", bgColor: "bg-blue-500", textColor: "text-white" },
  unassigned: { label: "待分配", bgColor: "bg-slate-500", textColor: "text-white" },
  developing: { label: "開發中", bgColor: "bg-violet-500", textColor: "text-white" },
  testing: { label: "測試中", bgColor: "bg-cyan-500", textColor: "text-white" },
  acceptance: { label: "待驗收", bgColor: "bg-orange-500", textColor: "text-white" },
  completed: { label: "已完成", bgColor: "bg-gray-400", textColor: "text-white" },
  rejected: { label: "已駁回", bgColor: "bg-red-500", textColor: "text-white" },
}

// 篩選分類
const filterTabs = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待審核" },      // pending, evaluating
  { key: "active", label: "進行中" },       // discussing, unassigned, developing, testing
  { key: "acceptance", label: "待驗收" },   // acceptance
  { key: "completed", label: "已完成" },    // completed
  { key: "rejected", label: "已駁回" },     // rejected
]

// 狀態分類對應
const statusCategories = {
  pending: ["pending", "evaluating"],
  active: ["discussing", "unassigned", "developing", "testing"],
  acceptance: ["acceptance"],
  completed: ["completed"],
  rejected: ["rejected"],
}

function DemandCard({ demand }: { demand: Demand }) {
  const config = statusConfig[demand.status]
  const isRejected = demand.status === "rejected"

  // 白話日期顯示
  const formatDateReadable = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month} 月 ${day} 日`
  }

  // 負責人顯示
  const getOwnerInfo = () => {
    if (demand.pm && demand.developer) {
      return `PM ${demand.pm} / 開發 ${demand.developer}`
    } else if (demand.pm) {
      return `PM ${demand.pm}`
    }
    return null
  }

  const cardContent = (
    <>
      {/* 狀態標籤 */}
      <div className={cn("inline-block px-2 py-0.5 rounded text-[11px] font-medium mb-2", config.bgColor, config.textColor)}>
        {config.label}
      </div>

      {/* 需求 ID */}
      <div className="text-[11px] text-muted-foreground mb-1">{demand.id}</div>

      {/* 專案名稱 */}
      <h3 className="font-semibold text-foreground text-sm leading-snug mb-1.5 group-hover:text-primary transition-colors">
        {demand.title}
      </h3>

      {/* 專案說明 */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
        {demand.description}
      </p>

      {/* 駁回原因 */}
      {isRejected && demand.rejectReason && (
        <div className="mb-3 p-2 bg-red-50 rounded-lg border border-red-100">
          <p className="text-[11px] text-red-600 line-clamp-2">{demand.rejectReason}</p>
        </div>
      )}

      {/* 負責人 */}
      {getOwnerInfo() && (
        <div className="text-[11px] text-muted-foreground mb-2">
          {getOwnerInfo()}
        </div>
      )}

      {/* 底部資訊 */}
      <div className="flex items-end justify-between pt-2 border-t border-gray-100">
        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          {demand.sprintNumber && (
            <div>第 {demand.sprintNumber} 期開發</div>
          )}
          {demand.expectedDate && (
            <div>預計 {formatDateReadable(demand.expectedDate)} 完成</div>
          )}
          {!demand.sprintNumber && !demand.expectedDate && (
            <div>{formatDateReadable(demand.submittedDate)} 提交</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-foreground">{demand.sp} <span className="text-xs font-normal text-muted-foreground">SP</span></div>
        </div>
      </div>
    </>
  )

  return (
    <Link
      href={`/subsidiary/demands/${demand.id}`}
      className="group block relative rounded-xl border bg-white p-4 transition-all hover:shadow-md hover:border-primary/30"
    >
      {cardContent}
    </Link>
  )
}

export default function MyDemandsPage() {
  const [activeTab, setActiveTab] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)

  const filteredDemands = demands.filter((demand) => {
    const matchesSearch = demand.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          demand.id.toLowerCase().includes(searchQuery.toLowerCase())

    // 細項狀態篩選
    const matchesStatus = statusFilter === "all" || demand.status === statusFilter

    // 分類標籤篩選
    let matchesTab = true
    if (activeTab === "pending") matchesTab = statusCategories.pending.includes(demand.status)
    else if (activeTab === "active") matchesTab = statusCategories.active.includes(demand.status)
    else if (activeTab === "acceptance") matchesTab = statusCategories.acceptance.includes(demand.status)
    else if (activeTab === "completed") matchesTab = statusCategories.completed.includes(demand.status)
    else if (activeTab === "rejected") matchesTab = statusCategories.rejected.includes(demand.status)

    return matchesSearch && matchesStatus && matchesTab
  })

  // 分頁計算
  const totalPages = Math.ceil(filteredDemands.length / ITEMS_PER_PAGE)
  const paginatedDemands = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredDemands.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredDemands, currentPage])

  // 當篩選條件改變時重置頁碼
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setStatusFilter("all")
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status)
    setCurrentPage(1)
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  // 根據當前分類標籤決定可用的狀態選項
  const getAvailableStatuses = () => {
    if (activeTab === "all") return Object.keys(statusConfig) as DemandStatus[]
    if (activeTab === "pending") return statusCategories.pending as DemandStatus[]
    if (activeTab === "active") return statusCategories.active as DemandStatus[]
    if (activeTab === "acceptance") return statusCategories.acceptance as DemandStatus[]
    if (activeTab === "completed") return statusCategories.completed as DemandStatus[]
    if (activeTab === "rejected") return statusCategories.rejected as DemandStatus[]
    return Object.keys(statusConfig) as DemandStatus[]
  }

  const counts = {
    all: demands.length,
    pending: demands.filter(d => statusCategories.pending.includes(d.status)).length,
    active: demands.filter(d => statusCategories.active.includes(d.status)).length,
    acceptance: demands.filter(d => statusCategories.acceptance.includes(d.status)).length,
    completed: demands.filter(d => statusCategories.completed.includes(d.status)).length,
    rejected: demands.filter(d => statusCategories.rejected.includes(d.status)).length,
  }

  // 計算已承諾 SP（進行中 + 待驗收）- 對應儀表板的「已承諾」
  const committedStatuses = [...statusCategories.active, ...statusCategories.acceptance]
  const committedSP = demands.filter(d => committedStatuses.includes(d.status)).reduce((sum, d) => sum + d.sp, 0)

  // 計算已使用 SP（已完成）- 對應儀表板的「已使用」
  const usedSP = demands.filter(d => d.status === "completed").reduce((sum, d) => sum + d.sp, 0)

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">我的需求</h1>
            <p className="text-sm text-muted-foreground mt-0.5">追蹤您提交的所有需求狀態</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{committedSP}</div>
              <div className="text-xs text-muted-foreground">已承諾 SP</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{usedSP}</div>
              <div className="text-xs text-muted-foreground">已使用 SP</div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-3 border-b border-border pt-3 pb-3 overflow-x-auto">
          {filterTabs.map((tab) => {
            const count = counts[tab.key as keyof typeof counts]
            const isActive = activeTab === tab.key
            const hasUrgent = tab.key === "acceptance" && count > 0

            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "relative px-5 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab.label}
                <span className={cn(
                  "ml-2",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  {count}
                </span>
                {hasUrgent && !isActive && (
                  <span className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 bg-orange-500 rounded-full" />
                )}
              </button>
            )
          })}
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[160px] h-10">
              <SelectValue placeholder="篩選狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              {getAvailableStatuses().map((status) => (
                <SelectItem key={status} value={status}>
                  {statusConfig[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜尋需求..."
              className="pl-9 h-10"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        {/* Demand Grid - 3 columns */}
        {filteredDemands.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>沒有符合條件的需求</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedDemands.map((demand) => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-9 px-3"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一頁
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="h-9 w-9 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-9 px-3"
                >
                  下一頁
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Page info */}
            <div className="text-center text-sm text-muted-foreground">
              顯示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredDemands.length)} 筆，共 {filteredDemands.length} 筆需求
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
