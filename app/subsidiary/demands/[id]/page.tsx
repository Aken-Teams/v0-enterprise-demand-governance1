"use client"

import { use } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, User, FileText, Clock, CheckCircle, MessageSquare, Paperclip, BarChart3 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type DemandStatus = "pending" | "evaluating" | "discussing" | "unassigned" | "developing" | "testing" | "acceptance" | "completed" | "rejected"

interface GanttPhase {
  name: string
  startDate: string
  endDate: string
  status: "completed" | "in_progress" | "pending" | "skipped"
}

interface TimelineEvent {
  date: string
  title: string
  description: string
  user?: string
}

interface Demand {
  id: string
  title: string
  description: string
  businessPurpose: string
  status: DemandStatus
  sp: number
  submittedDate: string
  expectedDate?: string
  completedDate?: string
  sprintNumber?: number
  pm?: string
  developer?: string
  submitter: string
  rejectReason?: string
  timeline: TimelineEvent[]
  attachments?: string[]
  gantt: GanttPhase[]
}

// 模擬資料
const demandsData: Record<string, Demand> = {
  "REQ-2024-001": {
    id: "REQ-2024-001",
    title: "客戶管理系統優化",
    description: "優化現有客戶管理介面，新增批次匯入功能與進階搜尋篩選。主要包含：\n\n1. 新增 Excel 批次匯入客戶資料功能\n2. 進階搜尋篩選（支援多欄位組合查詢）\n3. 客戶列表分頁與排序優化\n4. 客戶詳情頁面重新設計",
    businessPurpose: "提升業務人員處理客戶資料的效率，預估可節省 30% 的資料處理時間。批次匯入功能可解決大量客戶資料建檔的痛點。",
    status: "developing",
    sp: 21,
    submittedDate: "2024-01-15",
    expectedDate: "2024-02-15",
    sprintNumber: 3,
    pm: "張治理",
    developer: "王小明",
    submitter: "李經理",
    timeline: [
      { date: "2024-01-15", title: "需求提交", description: "需求已提交，等待審核", user: "李經理" },
      { date: "2024-01-17", title: "開始評估", description: "治理團隊開始評估需求", user: "張治理" },
      { date: "2024-01-20", title: "評估完成", description: "確認 SP 為 21，排入第 3 期開發", user: "張治理" },
      { date: "2024-01-25", title: "開始開發", description: "已分配開發人員，進入開發階段", user: "王小明" },
    ],
    attachments: ["需求規格書.pdf", "UI 設計稿.fig"],
    gantt: [
      { name: "需求審核", startDate: "2024-01-15", endDate: "2024-01-17", status: "completed" },
      { name: "需求評估", startDate: "2024-01-17", endDate: "2024-01-20", status: "completed" },
      { name: "開發階段", startDate: "2024-01-25", endDate: "2024-02-10", status: "in_progress" },
      { name: "測試階段", startDate: "2024-02-10", endDate: "2024-02-13", status: "pending" },
      { name: "驗收階段", startDate: "2024-02-13", endDate: "2024-02-15", status: "pending" },
    ],
  },
  "REQ-2024-002": {
    id: "REQ-2024-002",
    title: "報表匯出功能",
    description: "支援將報表匯出為 Excel 與 PDF 格式，含自訂欄位選擇。",
    businessPurpose: "讓使用者能夠自由匯出所需報表格式，方便進行離線分析與報告製作。",
    status: "acceptance",
    sp: 13,
    submittedDate: "2024-01-10",
    expectedDate: "2024-02-08",
    sprintNumber: 2,
    pm: "張治理",
    developer: "李小華",
    submitter: "王副理",
    timeline: [
      { date: "2024-01-10", title: "需求提交", description: "需求已提交", user: "王副理" },
      { date: "2024-01-12", title: "評估完成", description: "確認 SP 為 13", user: "張治理" },
      { date: "2024-01-18", title: "開始開發", description: "進入開發階段", user: "李小華" },
      { date: "2024-02-05", title: "開發完成", description: "開發完成，等待驗收", user: "李小華" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2024-01-10", endDate: "2024-01-11", status: "completed" },
      { name: "需求評估", startDate: "2024-01-11", endDate: "2024-01-12", status: "completed" },
      { name: "開發階段", startDate: "2024-01-18", endDate: "2024-02-03", status: "completed" },
      { name: "測試階段", startDate: "2024-02-03", endDate: "2024-02-05", status: "completed" },
      { name: "驗收階段", startDate: "2024-02-05", endDate: "2024-02-08", status: "in_progress" },
    ],
  },
  "REQ-2024-003": {
    id: "REQ-2024-003",
    title: "行動版介面開發",
    description: "開發響應式行動版網頁，支援主要業務功能操作。",
    businessPurpose: "讓外勤人員能透過手機進行基本業務操作，提升工作彈性。",
    status: "evaluating",
    sp: 34,
    submittedDate: "2024-01-20",
    pm: "張治理",
    submitter: "陳主任",
    timeline: [
      { date: "2024-01-20", title: "需求提交", description: "需求已提交", user: "陳主任" },
      { date: "2024-01-22", title: "開始評估", description: "治理團隊開始評估需求範圍", user: "張治理" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2024-01-20", endDate: "2024-01-21", status: "completed" },
      { name: "需求評估", startDate: "2024-01-22", endDate: "2024-01-28", status: "in_progress" },
      { name: "開發階段", startDate: "", endDate: "", status: "pending" },
      { name: "測試階段", startDate: "", endDate: "", status: "pending" },
      { name: "驗收階段", startDate: "", endDate: "", status: "pending" },
    ],
  },
  "REQ-2024-004": {
    id: "REQ-2024-004",
    title: "權限管理模組",
    description: "建立角色權限管理機制，支援細粒度功能權限控管。",
    businessPurpose: "加強系統安全性，確保不同角色只能存取授權的功能。",
    status: "completed",
    sp: 21,
    submittedDate: "2023-12-05",
    expectedDate: "2024-01-10",
    completedDate: "2024-01-08",
    sprintNumber: 12,
    pm: "張治理",
    developer: "陳大文",
    submitter: "IT 部門",
    timeline: [
      { date: "2023-12-05", title: "需求提交", description: "需求已提交", user: "IT 部門" },
      { date: "2023-12-08", title: "評估完成", description: "確認 SP 為 21", user: "張治理" },
      { date: "2023-12-15", title: "開始開發", description: "進入開發階段", user: "陳大文" },
      { date: "2024-01-05", title: "開發完成", description: "開發完成，進入測試", user: "陳大文" },
      { date: "2024-01-08", title: "驗收通過", description: "驗收通過，已上線", user: "IT 部門" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-12-05", endDate: "2023-12-06", status: "completed" },
      { name: "需求評估", startDate: "2023-12-06", endDate: "2023-12-08", status: "completed" },
      { name: "開發階段", startDate: "2023-12-15", endDate: "2024-01-03", status: "completed" },
      { name: "測試階段", startDate: "2024-01-03", endDate: "2024-01-06", status: "completed" },
      { name: "驗收階段", startDate: "2024-01-06", endDate: "2024-01-08", status: "completed" },
    ],
  },
  "REQ-2024-005": {
    id: "REQ-2024-005",
    title: "資料備份自動化",
    description: "建立自動化備份機制，每日備份重要資料至雲端。",
    businessPurpose: "確保資料安全，降低資料遺失風險。",
    status: "rejected",
    sp: 8,
    submittedDate: "2024-01-18",
    submitter: "IT 部門",
    rejectReason: "需求範圍過大，建議拆分為多個小需求後重新提交。建議先完成本地備份機制，再進行雲端同步功能。",
    timeline: [
      { date: "2024-01-18", title: "需求提交", description: "需求已提交", user: "IT 部門" },
      { date: "2024-01-20", title: "評估中", description: "開始評估需求範圍", user: "張治理" },
      { date: "2024-01-22", title: "需求駁回", description: "需求範圍過大，建議拆分後重新提交", user: "張治理" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2024-01-18", endDate: "2024-01-19", status: "completed" },
      { name: "需求評估", startDate: "2024-01-20", endDate: "2024-01-22", status: "skipped" },
      { name: "開發階段", startDate: "", endDate: "", status: "skipped" },
      { name: "測試階段", startDate: "", endDate: "", status: "skipped" },
      { name: "驗收階段", startDate: "", endDate: "", status: "skipped" },
    ],
  },
  "REQ-2024-006": {
    id: "REQ-2024-006",
    title: "員工考勤系統整合",
    description: "整合現有考勤系統 API，自動同步出勤紀錄。\n\n功能包含：\n1. 串接現有打卡系統 API\n2. 自動同步每日出勤資料\n3. 異常出勤自動通知\n4. 請假單電子化處理",
    businessPurpose: "減少人工核對出勤資料的時間，提升 HR 部門工作效率，並降低資料錯誤率。",
    status: "developing",
    sp: 13,
    submittedDate: "2024-01-25",
    expectedDate: "2024-02-28",
    sprintNumber: 4,
    pm: "張治理",
    developer: "黃小強",
    submitter: "HR 部門",
    timeline: [
      { date: "2024-01-25", title: "需求提交", description: "需求已提交", user: "HR 部門" },
      { date: "2024-01-27", title: "評估完成", description: "確認 SP 為 13", user: "張治理" },
      { date: "2024-02-01", title: "開始開發", description: "進入開發階段", user: "黃小強" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2024-01-25", endDate: "2024-01-26", status: "completed" },
      { name: "需求評估", startDate: "2024-01-26", endDate: "2024-01-27", status: "completed" },
      { name: "開發階段", startDate: "2024-02-01", endDate: "2024-02-20", status: "in_progress" },
      { name: "測試階段", startDate: "2024-02-20", endDate: "2024-02-26", status: "pending" },
      { name: "驗收階段", startDate: "2024-02-26", endDate: "2024-02-28", status: "pending" },
    ],
  },
  "REQ-2024-007": {
    id: "REQ-2024-007",
    title: "客戶通知自動化",
    description: "建立自動化通知機制，支援 Email 與簡訊發送。\n\n功能範圍：\n1. Email 模板管理\n2. 簡訊發送整合\n3. 排程通知功能\n4. 發送紀錄查詢",
    businessPurpose: "提升客戶溝通效率，確保重要訊息即時送達，降低人工發送通知的負擔。",
    status: "pending",
    sp: 5,
    submittedDate: "2024-01-28",
    submitter: "業務部",
    timeline: [
      { date: "2024-01-28", title: "需求提交", description: "需求已提交，等待審核", user: "業務部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2024-01-28", endDate: "", status: "in_progress" },
      { name: "需求評估", startDate: "", endDate: "", status: "pending" },
      { name: "開發階段", startDate: "", endDate: "", status: "pending" },
      { name: "測試階段", startDate: "", endDate: "", status: "pending" },
      { name: "驗收階段", startDate: "", endDate: "", status: "pending" },
    ],
  },
  "REQ-2024-008": {
    id: "REQ-2024-008",
    title: "庫存管理系統",
    description: "開發庫存管理模組，支援進銷存追蹤與低庫存警示。\n\n主要功能：\n1. 商品進貨登記\n2. 銷售出貨扣庫\n3. 庫存盤點功能\n4. 低庫存自動警示\n5. 庫存報表產出",
    businessPurpose: "建立完整的庫存管理機制，避免缺貨或庫存過剩，優化資金運用效率。",
    status: "testing",
    sp: 21,
    submittedDate: "2024-01-12",
    expectedDate: "2024-02-20",
    sprintNumber: 3,
    pm: "張治理",
    developer: "林小美",
    submitter: "倉儲部",
    timeline: [
      { date: "2024-01-12", title: "需求提交", description: "需求已提交", user: "倉儲部" },
      { date: "2024-01-15", title: "評估完成", description: "確認 SP 為 21", user: "張治理" },
      { date: "2024-01-22", title: "開始開發", description: "進入開發階段", user: "林小美" },
      { date: "2024-02-10", title: "開發完成", description: "開發完成，進入測試階段", user: "林小美" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2024-01-12", endDate: "2024-01-13", status: "completed" },
      { name: "需求評估", startDate: "2024-01-13", endDate: "2024-01-15", status: "completed" },
      { name: "開發階段", startDate: "2024-01-22", endDate: "2024-02-10", status: "completed" },
      { name: "測試階段", startDate: "2024-02-10", endDate: "2024-02-18", status: "in_progress" },
      { name: "驗收階段", startDate: "2024-02-18", endDate: "2024-02-20", status: "pending" },
    ],
  },
  "REQ-2024-009": {
    id: "REQ-2024-009",
    title: "電子簽核流程",
    description: "建立線上簽核流程，支援多層級審批與電子簽章。\n\n功能說明：\n1. 多層級審批流程設定\n2. 電子簽章整合\n3. 簽核進度追蹤\n4. 簽核歷程保存\n5. 逾期提醒通知",
    businessPurpose: "數位化簽核流程，加快文件審批速度，並留下完整稽核軌跡。",
    status: "pending",
    sp: 13,
    submittedDate: "2024-01-30",
    submitter: "總務部",
    timeline: [
      { date: "2024-01-30", title: "需求提交", description: "需求已提交，等待審核", user: "總務部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2024-01-30", endDate: "", status: "in_progress" },
      { name: "需求評估", startDate: "", endDate: "", status: "pending" },
      { name: "開發階段", startDate: "", endDate: "", status: "pending" },
      { name: "測試階段", startDate: "", endDate: "", status: "pending" },
      { name: "驗收階段", startDate: "", endDate: "", status: "pending" },
    ],
  },
  "REQ-2024-010": {
    id: "REQ-2024-010",
    title: "訂單追蹤系統",
    description: "開發訂單即時追蹤功能，支援狀態通知與物流整合。\n\n功能範圍：\n1. 訂單狀態即時更新\n2. 物流系統 API 整合\n3. 配送進度追蹤\n4. 到貨通知發送\n5. 異常訂單處理流程",
    businessPurpose: "提升訂單處理透明度，讓客戶隨時掌握訂單狀態，提升客戶滿意度。",
    status: "developing",
    sp: 21,
    submittedDate: "2024-01-22",
    expectedDate: "2024-03-01",
    sprintNumber: 4,
    pm: "張治理",
    developer: "周小龍",
    submitter: "電商部",
    timeline: [
      { date: "2024-01-22", title: "需求提交", description: "需求已提交", user: "電商部" },
      { date: "2024-01-24", title: "開始評估", description: "治理團隊開始評估", user: "張治理" },
      { date: "2024-01-28", title: "評估完成", description: "確認 SP 為 21，排入第 4 期", user: "張治理" },
      { date: "2024-02-05", title: "開始開發", description: "進入開發階段", user: "周小龍" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2024-01-22", endDate: "2024-01-23", status: "completed" },
      { name: "需求評估", startDate: "2024-01-24", endDate: "2024-01-28", status: "completed" },
      { name: "開發階段", startDate: "2024-02-05", endDate: "2024-02-22", status: "in_progress" },
      { name: "測試階段", startDate: "2024-02-22", endDate: "2024-02-28", status: "pending" },
      { name: "驗收階段", startDate: "2024-02-28", endDate: "2024-03-01", status: "pending" },
    ],
  },
  "REQ-2024-015": {
    id: "REQ-2024-015",
    title: "客戶滿意度調查模組",
    description: "建立問卷調查功能，自動發送並統計客戶回饋。\n\n功能包含：\n1. 問卷模板設計\n2. 自動發送排程\n3. 回饋統計分析\n4. NPS 評分追蹤",
    businessPurpose: "系統化收集客戶意見，持續改善服務品質。",
    status: "acceptance",
    sp: 11,
    submittedDate: "2024-01-08",
    expectedDate: "2024-02-05",
    sprintNumber: 2,
    pm: "張治理",
    developer: "吳小芳",
    submitter: "客服部",
    timeline: [
      { date: "2024-01-08", title: "需求提交", description: "需求已提交", user: "客服部" },
      { date: "2024-01-10", title: "評估完成", description: "確認 SP 為 11", user: "張治理" },
      { date: "2024-01-15", title: "開始開發", description: "進入開發階段", user: "吳小芳" },
      { date: "2024-02-01", title: "開發完成", description: "開發完成，等待驗收", user: "吳小芳" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2024-01-08", endDate: "2024-01-09", status: "completed" },
      { name: "需求評估", startDate: "2024-01-09", endDate: "2024-01-10", status: "completed" },
      { name: "開發階段", startDate: "2024-01-15", endDate: "2024-01-30", status: "completed" },
      { name: "測試階段", startDate: "2024-01-30", endDate: "2024-02-01", status: "completed" },
      { name: "驗收階段", startDate: "2024-02-01", endDate: "2024-02-05", status: "in_progress" },
    ],
  },
  // === 已完成的需求 ===
  "REQ-2023-042": {
    id: "REQ-2023-042",
    title: "財務報表系統",
    description: "開發月結財務報表自動產出功能，含損益表與資產負債表。",
    businessPurpose: "自動化財務報表產出，減少人工作業時間與錯誤。",
    status: "completed",
    sp: 34,
    submittedDate: "2023-10-15",
    expectedDate: "2023-11-30",
    completedDate: "2023-11-28",
    sprintNumber: 10,
    pm: "張治理",
    developer: "陳大文",
    submitter: "財務部",
    timeline: [
      { date: "2023-10-15", title: "需求提交", description: "需求已提交", user: "財務部" },
      { date: "2023-10-20", title: "評估完成", description: "確認 SP 為 34", user: "張治理" },
      { date: "2023-10-25", title: "開始開發", description: "進入開發階段", user: "陳大文" },
      { date: "2023-11-28", title: "驗收通過", description: "驗收通過，已上線", user: "財務部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-10-15", endDate: "2023-10-17", status: "completed" },
      { name: "需求評估", startDate: "2023-10-17", endDate: "2023-10-20", status: "completed" },
      { name: "開發階段", startDate: "2023-10-25", endDate: "2023-11-20", status: "completed" },
      { name: "測試階段", startDate: "2023-11-20", endDate: "2023-11-25", status: "completed" },
      { name: "驗收階段", startDate: "2023-11-25", endDate: "2023-11-28", status: "completed" },
    ],
  },
  "REQ-2023-038": {
    id: "REQ-2023-038",
    title: "員工入職系統",
    description: "建立線上入職流程，含資料填寫、合約簽署、設備申請。",
    businessPurpose: "數位化入職流程，提升新人報到體驗。",
    status: "completed",
    sp: 21,
    submittedDate: "2023-09-20",
    expectedDate: "2023-10-25",
    completedDate: "2023-10-23",
    sprintNumber: 9,
    pm: "張治理",
    developer: "王小明",
    submitter: "HR 部門",
    timeline: [
      { date: "2023-09-20", title: "需求提交", description: "需求已提交", user: "HR 部門" },
      { date: "2023-10-23", title: "驗收通過", description: "驗收通過，已上線", user: "HR 部門" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-09-20", endDate: "2023-09-22", status: "completed" },
      { name: "需求評估", startDate: "2023-09-22", endDate: "2023-09-25", status: "completed" },
      { name: "開發階段", startDate: "2023-09-28", endDate: "2023-10-15", status: "completed" },
      { name: "測試階段", startDate: "2023-10-15", endDate: "2023-10-20", status: "completed" },
      { name: "驗收階段", startDate: "2023-10-20", endDate: "2023-10-23", status: "completed" },
    ],
  },
  "REQ-2023-035": {
    id: "REQ-2023-035",
    title: "客戶資料分析平台",
    description: "建立客戶行為分析儀表板，支援 RFM 分析與客群分類。",
    businessPurpose: "深入了解客戶行為，支援精準行銷決策。",
    status: "completed",
    sp: 34,
    submittedDate: "2023-08-10",
    expectedDate: "2023-09-30",
    completedDate: "2023-09-28",
    sprintNumber: 8,
    pm: "張治理",
    developer: "李小華",
    submitter: "行銷部",
    timeline: [
      { date: "2023-08-10", title: "需求提交", description: "需求已提交", user: "行銷部" },
      { date: "2023-09-28", title: "驗收通過", description: "驗收通過，已上線", user: "行銷部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-08-10", endDate: "2023-08-12", status: "completed" },
      { name: "需求評估", startDate: "2023-08-12", endDate: "2023-08-15", status: "completed" },
      { name: "開發階段", startDate: "2023-08-20", endDate: "2023-09-18", status: "completed" },
      { name: "測試階段", startDate: "2023-09-18", endDate: "2023-09-25", status: "completed" },
      { name: "驗收階段", startDate: "2023-09-25", endDate: "2023-09-28", status: "completed" },
    ],
  },
  "REQ-2023-031": {
    id: "REQ-2023-031",
    title: "電子發票串接",
    description: "整合財政部電子發票 API，自動開立與作廢發票。",
    businessPurpose: "符合法規要求，自動化發票處理流程。",
    status: "completed",
    sp: 21,
    submittedDate: "2023-07-05",
    expectedDate: "2023-08-15",
    completedDate: "2023-08-12",
    sprintNumber: 7,
    pm: "張治理",
    developer: "林小美",
    submitter: "財務部",
    timeline: [
      { date: "2023-07-05", title: "需求提交", description: "需求已提交", user: "財務部" },
      { date: "2023-08-12", title: "驗收通過", description: "驗收通過，已上線", user: "財務部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-07-05", endDate: "2023-07-07", status: "completed" },
      { name: "需求評估", startDate: "2023-07-07", endDate: "2023-07-10", status: "completed" },
      { name: "開發階段", startDate: "2023-07-15", endDate: "2023-08-05", status: "completed" },
      { name: "測試階段", startDate: "2023-08-05", endDate: "2023-08-10", status: "completed" },
      { name: "驗收階段", startDate: "2023-08-10", endDate: "2023-08-12", status: "completed" },
    ],
  },
  "REQ-2023-028": {
    id: "REQ-2023-028",
    title: "供應商管理系統",
    description: "建立供應商資料庫，含評鑑機制與合約管理。",
    businessPurpose: "系統化管理供應商，確保供應鏈品質。",
    status: "completed",
    sp: 21,
    submittedDate: "2023-06-01",
    expectedDate: "2023-07-10",
    completedDate: "2023-07-08",
    sprintNumber: 6,
    pm: "張治理",
    developer: "陳大文",
    submitter: "採購部",
    timeline: [
      { date: "2023-06-01", title: "需求提交", description: "需求已提交", user: "採購部" },
      { date: "2023-07-08", title: "驗收通過", description: "驗收通過，已上線", user: "採購部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-06-01", endDate: "2023-06-03", status: "completed" },
      { name: "需求評估", startDate: "2023-06-03", endDate: "2023-06-06", status: "completed" },
      { name: "開發階段", startDate: "2023-06-10", endDate: "2023-07-01", status: "completed" },
      { name: "測試階段", startDate: "2023-07-01", endDate: "2023-07-05", status: "completed" },
      { name: "驗收階段", startDate: "2023-07-05", endDate: "2023-07-08", status: "completed" },
    ],
  },
  "REQ-2023-024": {
    id: "REQ-2023-024",
    title: "會議室預約系統",
    description: "開發會議室線上預約功能，含衝突檢查與通知提醒。",
    businessPurpose: "優化會議室使用效率，減少預約衝突。",
    status: "completed",
    sp: 13,
    submittedDate: "2023-05-10",
    expectedDate: "2023-06-05",
    completedDate: "2023-06-03",
    sprintNumber: 5,
    pm: "張治理",
    developer: "王小明",
    submitter: "總務部",
    timeline: [
      { date: "2023-05-10", title: "需求提交", description: "需求已提交", user: "總務部" },
      { date: "2023-06-03", title: "驗收通過", description: "驗收通過，已上線", user: "總務部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-05-10", endDate: "2023-05-12", status: "completed" },
      { name: "需求評估", startDate: "2023-05-12", endDate: "2023-05-15", status: "completed" },
      { name: "開發階段", startDate: "2023-05-18", endDate: "2023-05-30", status: "completed" },
      { name: "測試階段", startDate: "2023-05-30", endDate: "2023-06-01", status: "completed" },
      { name: "驗收階段", startDate: "2023-06-01", endDate: "2023-06-03", status: "completed" },
    ],
  },
  "REQ-2023-020": {
    id: "REQ-2023-020",
    title: "請假系統優化",
    description: "優化請假申請流程，新增代理人機制與假別餘額查詢。",
    businessPurpose: "簡化請假流程，提升員工體驗。",
    status: "completed",
    sp: 13,
    submittedDate: "2023-04-15",
    expectedDate: "2023-05-10",
    completedDate: "2023-05-08",
    sprintNumber: 4,
    pm: "張治理",
    developer: "李小華",
    submitter: "HR 部門",
    timeline: [
      { date: "2023-04-15", title: "需求提交", description: "需求已提交", user: "HR 部門" },
      { date: "2023-05-08", title: "驗收通過", description: "驗收通過，已上線", user: "HR 部門" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-04-15", endDate: "2023-04-17", status: "completed" },
      { name: "需求評估", startDate: "2023-04-17", endDate: "2023-04-19", status: "completed" },
      { name: "開發階段", startDate: "2023-04-22", endDate: "2023-05-03", status: "completed" },
      { name: "測試階段", startDate: "2023-05-03", endDate: "2023-05-06", status: "completed" },
      { name: "驗收階段", startDate: "2023-05-06", endDate: "2023-05-08", status: "completed" },
    ],
  },
  "REQ-2023-016": {
    id: "REQ-2023-016",
    title: "客戶合約管理",
    description: "建立合約到期提醒、續約追蹤與合約檔案管理。",
    businessPurpose: "避免合約到期疏漏，提升續約率。",
    status: "completed",
    sp: 21,
    submittedDate: "2023-03-20",
    expectedDate: "2023-04-25",
    completedDate: "2023-04-22",
    sprintNumber: 3,
    pm: "張治理",
    developer: "林小美",
    submitter: "業務部",
    timeline: [
      { date: "2023-03-20", title: "需求提交", description: "需求已提交", user: "業務部" },
      { date: "2023-04-22", title: "驗收通過", description: "驗收通過，已上線", user: "業務部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-03-20", endDate: "2023-03-22", status: "completed" },
      { name: "需求評估", startDate: "2023-03-22", endDate: "2023-03-25", status: "completed" },
      { name: "開發階段", startDate: "2023-03-28", endDate: "2023-04-15", status: "completed" },
      { name: "測試階段", startDate: "2023-04-15", endDate: "2023-04-19", status: "completed" },
      { name: "驗收階段", startDate: "2023-04-19", endDate: "2023-04-22", status: "completed" },
    ],
  },
  "REQ-2023-012": {
    id: "REQ-2023-012",
    title: "銷售業績儀表板",
    description: "開發即時銷售數據儀表板，含目標達成率與趨勢分析。",
    businessPurpose: "即時掌握業績狀況，支援業務決策。",
    status: "completed",
    sp: 21,
    submittedDate: "2023-02-10",
    expectedDate: "2023-03-15",
    completedDate: "2023-03-13",
    sprintNumber: 2,
    pm: "張治理",
    developer: "陳大文",
    submitter: "業務部",
    timeline: [
      { date: "2023-02-10", title: "需求提交", description: "需求已提交", user: "業務部" },
      { date: "2023-03-13", title: "驗收通過", description: "驗收通過，已上線", user: "業務部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-02-10", endDate: "2023-02-12", status: "completed" },
      { name: "需求評估", startDate: "2023-02-12", endDate: "2023-02-15", status: "completed" },
      { name: "開發階段", startDate: "2023-02-18", endDate: "2023-03-05", status: "completed" },
      { name: "測試階段", startDate: "2023-03-05", endDate: "2023-03-10", status: "completed" },
      { name: "驗收階段", startDate: "2023-03-10", endDate: "2023-03-13", status: "completed" },
    ],
  },
  "REQ-2023-008": {
    id: "REQ-2023-008",
    title: "客戶聯絡紀錄",
    description: "建立客戶拜訪與聯絡紀錄功能，含跟進提醒。",
    businessPurpose: "完整記錄客戶互動，提升服務品質。",
    status: "completed",
    sp: 13,
    submittedDate: "2023-01-15",
    expectedDate: "2023-02-10",
    completedDate: "2023-02-08",
    sprintNumber: 1,
    pm: "張治理",
    developer: "王小明",
    submitter: "業務部",
    timeline: [
      { date: "2023-01-15", title: "需求提交", description: "需求已提交", user: "業務部" },
      { date: "2023-02-08", title: "驗收通過", description: "驗收通過，已上線", user: "業務部" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2023-01-15", endDate: "2023-01-17", status: "completed" },
      { name: "需求評估", startDate: "2023-01-17", endDate: "2023-01-20", status: "completed" },
      { name: "開發階段", startDate: "2023-01-23", endDate: "2023-02-03", status: "completed" },
      { name: "測試階段", startDate: "2023-02-03", endDate: "2023-02-06", status: "completed" },
      { name: "驗收階段", startDate: "2023-02-06", endDate: "2023-02-08", status: "completed" },
    ],
  },
  "REQ-2023-004": {
    id: "REQ-2023-004",
    title: "基礎資料管理",
    description: "建立系統基礎資料維護功能，含部門、職位、幣別等。",
    businessPurpose: "統一管理系統參數，確保資料一致性。",
    status: "completed",
    sp: 11,
    submittedDate: "2022-12-20",
    expectedDate: "2023-01-15",
    completedDate: "2023-01-12",
    sprintNumber: 12,
    pm: "張治理",
    developer: "李小華",
    submitter: "IT 部門",
    timeline: [
      { date: "2022-12-20", title: "需求提交", description: "需求已提交", user: "IT 部門" },
      { date: "2023-01-12", title: "驗收通過", description: "驗收通過，已上線", user: "IT 部門" },
    ],
    gantt: [
      { name: "需求審核", startDate: "2022-12-20", endDate: "2022-12-22", status: "completed" },
      { name: "需求評估", startDate: "2022-12-22", endDate: "2022-12-25", status: "completed" },
      { name: "開發階段", startDate: "2022-12-28", endDate: "2023-01-08", status: "completed" },
      { name: "測試階段", startDate: "2023-01-08", endDate: "2023-01-10", status: "completed" },
      { name: "驗收階段", startDate: "2023-01-10", endDate: "2023-01-12", status: "completed" },
    ],
  },
}

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

// 甘特圖元件
function GanttChart({ phases, submittedDate, expectedDate }: { phases: GanttPhase[]; submittedDate: string; expectedDate?: string }) {
  // 計算時間範圍
  const allDates = phases
    .flatMap(p => [p.startDate, p.endDate])
    .filter(d => d)
    .map(d => new Date(d).getTime())

  if (allDates.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        尚未排定時程
      </div>
    )
  }

  const startTime = Math.min(...allDates, new Date(submittedDate).getTime())
  const endTime = expectedDate
    ? Math.max(...allDates, new Date(expectedDate).getTime())
    : Math.max(...allDates)

  const today = new Date().getTime()

  // 計算進度百分比
  const getBarPosition = (start: string, end: string) => {
    if (!start || !end) return { left: 0, width: 0 }
    const startPos = (new Date(start).getTime() - startTime) / (endTime - startTime) * 100
    const endPos = (new Date(end).getTime() - startTime) / (endTime - startTime) * 100
    return { left: startPos, width: Math.max(endPos - startPos, 2) }
  }

  const phaseColors = {
    completed: "bg-green-500",
    in_progress: "bg-blue-500",
    pending: "bg-gray-300",
    skipped: "bg-red-300",
  }

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // 計算今天的位置
  const todayPosition = ((today - startTime) / (endTime - startTime)) * 100

  return (
    <div className="space-y-3 overflow-x-auto">
      {/* 時間軸標籤 */}
      <div className="relative h-6 text-[10px] sm:text-xs text-muted-foreground min-w-[400px]">
        <span className="absolute left-0">{formatShortDate(new Date(startTime).toISOString().split('T')[0])}</span>
        <span className="absolute right-0">{formatShortDate(new Date(endTime).toISOString().split('T')[0])}</span>
        {todayPosition > 0 && todayPosition < 100 && (
          <span
            className="absolute text-blue-600 font-medium -translate-x-1/2"
            style={{ left: `${todayPosition}%` }}
          >
            今天
          </span>
        )}
      </div>

      {/* 甘特條 */}
      <div className="space-y-2 min-w-[400px]">
        {phases.map((phase, index) => {
          const pos = getBarPosition(phase.startDate, phase.endDate)
          return (
            <div key={index} className="flex items-center gap-2 sm:gap-3">
              <div className="w-16 sm:w-20 text-[10px] sm:text-xs text-muted-foreground flex-shrink-0 truncate">
                {phase.name}
              </div>
              <div className="flex-1 relative h-5 sm:h-6 bg-gray-100 rounded overflow-hidden">
                {/* 今天的標記線 */}
                {todayPosition > 0 && todayPosition < 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
                    style={{ left: `${todayPosition}%` }}
                  />
                )}
                {/* 進度條 */}
                {pos.width > 0 && (
                  <div
                    className={cn(
                      "absolute top-1 bottom-1 rounded transition-all",
                      phaseColors[phase.status]
                    )}
                    style={{ left: `${pos.left}%`, width: `${pos.width}%` }}
                  />
                )}
              </div>
              <div className="w-16 sm:w-24 text-[9px] sm:text-[10px] text-muted-foreground flex-shrink-0 text-right">
                {phase.startDate && phase.endDate
                  ? `${formatShortDate(phase.startDate)} - ${formatShortDate(phase.endDate)}`
                  : phase.status === "skipped" ? "已跳過" : "待排定"
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* 圖例 */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2 border-t">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">已完成</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">進行中</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-300" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">待進行</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-300" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">已跳過</span>
        </div>
      </div>
    </div>
  )
}

export default function DemandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const demand = demandsData[id]

  // 白話日期顯示
  const formatDateReadable = (dateStr: string) => {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${year} 年 ${month} 月 ${day} 日`
  }

  if (!demand) {
    return (
      <AppLayout userRole="subsidiary">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground mb-4">找不到此需求</p>
          <Button asChild>
            <Link href="/subsidiary/demands">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回需求列表
            </Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  const config = statusConfig[demand.status]
  const isRejected = demand.status === "rejected"
  const needsAction = demand.status === "acceptance"

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                <Link href="/subsidiary/demands">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  返回
                </Link>
              </Button>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground">{demand.id}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{demand.title}</h1>
              <div className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", config.bgColor, config.textColor)}>
                {config.label}
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right flex-shrink-0">
            <div className="text-2xl sm:text-3xl font-bold text-primary">{demand.sp}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Story Points</div>
          </div>
        </div>

        {/* 駁回原因警告 */}
        {isRejected && demand.rejectReason && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="p-2 bg-red-100 rounded-full w-fit">
                  <FileText className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-red-800 mb-1">駁回原因</h4>
                  <p className="text-sm text-red-700">{demand.rejectReason}</p>
                  <Button size="sm" className="mt-3" variant="outline">
                    重新提交需求
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 待驗收提示 */}
        {needsAction && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-full">
                    <CheckCircle className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-orange-800 mb-1">等待您的驗收</h4>
                    <p className="text-sm text-orange-700">開發已完成，請前往驗收中心進行確認</p>
                  </div>
                </div>
                <Button asChild className="w-fit">
                  <Link href="/subsidiary/acceptance">前往驗收</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 甘特圖 - 專案進度 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              專案進度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GanttChart
              phases={demand.gantt}
              submittedDate={demand.submittedDate}
              expectedDate={demand.expectedDate}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：主要內容 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 需求說明 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  需求說明
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{demand.description}</p>
              </CardContent>
            </Card>

            {/* 商業目的 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  商業目的 / 預期效益
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{demand.businessPurpose}</p>
              </CardContent>
            </Card>

            {/* 處理歷程 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  處理歷程
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {demand.timeline.map((event, index) => (
                    <div key={index} className="relative pl-6">
                      {index !== demand.timeline.length - 1 && (
                        <div className="absolute left-[9px] top-6 h-full w-0.5 bg-border" />
                      )}
                      <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-white" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{event.title}</span>
                          <span className="text-xs text-muted-foreground">{formatDateReadable(event.date)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        {event.user && (
                          <p className="text-xs text-muted-foreground mt-1">by {event.user}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右側：資訊面板 */}
          <div className="space-y-6">
            {/* 基本資訊 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">基本資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">需求編號</span>
                  <span className="text-sm font-medium">{demand.id}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">提交者</span>
                  <span className="text-sm font-medium">{demand.submitter}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">提交日期</span>
                  <span className="text-sm font-medium text-right">{formatDateReadable(demand.submittedDate)}</span>
                </div>
                {demand.sprintNumber && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">開發期數</span>
                      <span className="text-sm font-medium">第 {demand.sprintNumber} 期</span>
                    </div>
                  </>
                )}
                {demand.expectedDate && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">預計完成</span>
                      <span className="text-sm font-medium text-right">{formatDateReadable(demand.expectedDate)}</span>
                    </div>
                  </>
                )}
                {demand.completedDate && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">實際完成</span>
                      <span className="text-sm font-medium text-green-600 text-right">{formatDateReadable(demand.completedDate)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 負責人 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  專案負責人
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {demand.pm && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary">{demand.pm.slice(0, 1)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{demand.pm}</p>
                      <p className="text-xs text-muted-foreground">專案經理 (PM)</p>
                    </div>
                  </div>
                )}
                {demand.developer && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-violet-600">{demand.developer.slice(0, 1)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{demand.developer}</p>
                      <p className="text-xs text-muted-foreground">開發人員</p>
                    </div>
                  </div>
                )}
                {!demand.pm && !demand.developer && (
                  <p className="text-sm text-muted-foreground">尚未指派</p>
                )}
              </CardContent>
            </Card>

            {/* 附件 */}
            {demand.attachments && demand.attachments.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    附件
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {demand.attachments.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{file}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
