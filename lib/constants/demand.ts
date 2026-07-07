export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "需求確認", color: "bg-blue-100 text-blue-700" },
  PRD_REVIEW: { label: "MVP 架構確認", color: "bg-amber-100 text-amber-700" },
  SP_REVIEW: { label: "開案確認", color: "bg-orange-100 text-orange-700" },
  DEVELOPING: { label: "開發中", color: "bg-violet-100 text-violet-700" },
  ACCEPTANCE: { label: "驗收中", color: "bg-purple-100 text-purple-700" },
  CLOSED: { label: "已結案", color: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "已駁回", color: "bg-red-100 text-red-700" },
  ON_HOLD: { label: "暫緩", color: "bg-yellow-100 text-yellow-700" },
  CANCELLED: { label: "已取消", color: "bg-slate-200 text-slate-600" },
}

export const PIPELINE_STEPS = [
  "SUBMITTED",
  "PRD_REVIEW",
  "SP_REVIEW",
  "DEVELOPING",
  "ACCEPTANCE",
  "CLOSED",
] as const

export const PHASE_COLORS: Record<string, string> = {
  SUBMITTED: "var(--chart-1)",
  PRD_REVIEW: "var(--chart-2)",
  SP_REVIEW: "var(--chart-3)",
  DEVELOPING: "var(--chart-4)",
  ACCEPTANCE: "var(--chart-5)",
  CLOSED: "oklch(0.65 0.15 160)",
}

export const PHASE_DOCUMENT_MAP: Record<
  string,
  { required: string[]; optional: string[] }
> = {
  SUBMITTED: {
    required: ["MEETING_NOTES"],
    optional: ["AUDIO", "VIDEO", "ATTACHMENT"],
  },
  PRD_REVIEW: {
    required: ["PRD"],
    optional: ["APP_RESULT", "ATTACHMENT"],
  },
  SP_REVIEW: {
    required: ["SP_PLAN"],
    optional: ["ATTACHMENT"],
  },
  DEVELOPING: {
    required: ["SDD", "APP_RESULT", "GITHUB_REPO"],
    optional: ["ATTACHMENT"],
  },
  ACCEPTANCE: {
    required: ["BDD", "TDD", "TEST_REPORT"],
    optional: ["SECURITY_REPORT", "SECURITY_FIX_REPORT", "OPERATION_MANUAL", "ATTACHMENT"],
  },
  CLOSED: { required: [], optional: ["ATTACHMENT"] },
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  MEETING_NOTES: "會議記錄",
  PRD: "需求規格書",
  SDD: "系統設計文件",
  TEST_REPORT: "測試報告",
  ATTACHMENT: "一般附件",
  BDD: "行為驅動開發文件",
  TDD: "測試驅動開發文件",
  MODULE_ARCHITECTURE: "模組架構文件",
  SP_PLAN: "SP 規劃文件",
  APP_RESULT: "APP 交付成果",
  GITHUB_REPO: "GitHub 連結",
  AUDIO: "音訊",
  VIDEO: "影片",
  SECURITY_REPORT: "資安報告",
  SECURITY_FIX_REPORT: "資安修正報告",
  OPERATION_MANUAL: "操作手冊",
}

/** 各階段簡要說明，讓管理者了解該階段的工作重點 */
export const PHASE_DESCRIPTIONS: Record<string, string> = {
  SUBMITTED: "與需求者面談了解需求，記錄會議內容",
  PRD_REVIEW: "PM 撰寫 PRD，指派工程師進行 MVP 架構設計",
  SP_REVIEW: "填寫 SP 規劃文件，分配各階段 SP 點數與時程",
  DEVELOPING: "依甘特圖進行開發，產出 SDD、APP 成果與 GitHub 連結",
  ACCEPTANCE: "工程師提供 BDD/TDD 文件，使用者進行驗收測試",
  CLOSED: "需求已完成結案",
}

/** 各階段需要完成的關鍵動作 */
export const PHASE_ACTIONS: Record<string, string[]> = {
  SUBMITTED: ["上傳會議記錄"],
  PRD_REVIEW: ["指派 PM 與工程師", "上傳 PRD", "上傳模組架構文件"],
  SP_REVIEW: ["填寫各階段 SP 點數", "填寫各階段甘特圖時程", "上傳 SP 規劃文件"],
  DEVELOPING: ["管理開發子任務", "上傳 SDD 文件", "上傳 APP 交付成果", "提供 GitHub 連結"],
  ACCEPTANCE: ["上傳 BDD 文件", "上傳 TDD 文件", "上傳測試報告"],
  CLOSED: [],
}

/** 需要簽核的階段（CLOSED 改為純通知，不再需要簽核） */
export const SIGNOFF_REQUIRED_PHASES = [
  "PRD_REVIEW",
  "SP_REVIEW",
  "ACCEPTANCE",
] as const

/** 每個簽核階段對應允許簽核的 DemandSignoffRole */
export const PHASE_SIGNOFF_ROLES: Record<string, string[]> = {
  PRD_REVIEW: ["REQUESTER", "MANAGER"],
  SP_REVIEW: ["BOARD"],
  ACCEPTANCE: ["REQUESTER", "MANAGER"],
}

/** 審核角色標籤 */
export const SIGNOFF_ROLE_LABELS: Record<string, string> = {
  REQUESTER: "需求者",
  MANAGER: "主管",
  BOARD: "董事會",
  BOARD_OVERRIDE: "專案 Master 代簽",
  OBSERVER: "觀察者",
}

/** 簽核狀態標籤與顏色 */
export const SIGNOFF_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "待確認", color: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "已確認", color: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "已退回", color: "bg-red-100 text-red-700" },
  SKIPPED: { label: "管理者略過", color: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "已撤回", color: "bg-slate-100 text-slate-600" },
}

/** 可發起設計變更的階段 (開案/開發中/驗收/已結案；需求確認與 MVP 架構確認不可) */
export const DESIGN_CHANGE_ALLOWED_PHASES = [
  "SP_REVIEW",
  "DEVELOPING",
  "ACCEPTANCE",
  "CLOSED",
] as const

/** 設計變更 / 版本狀態標籤 */
export const DESIGN_CHANGE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "待確認", color: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "已通過", color: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "已駁回", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已撤銷", color: "bg-slate-100 text-slate-600" },
}

/** 需求方對 checklist 每一條的標記 */
export const CHECKLIST_MARK_MAP: Record<string, { label: string; icon: string; color: string }> = {
  PENDING: { label: "尚未回應", icon: "○", color: "text-slate-400" },
  CONFIRMED: { label: "確認", icon: "✓", color: "text-emerald-600" },
  CROSS: { label: "有問題", icon: "✕", color: "text-red-600" },
  WARN: { label: "疑慮", icon: "!", color: "text-amber-600" },
}

/** 簽核種類標籤 */
export const SIGNOFF_KIND_LABELS: Record<string, string> = {
  PHASE: "階段簽核",
  DESIGN_CHANGE: "設計變更",
}

/** SP 單價 (NT$) */
export const SP_RATE = 20000

/** SP 漸進消耗比例：開案通過 50% → 開發完成 75% → 結案 100%（簽核為主，無簽核看狀態） */
export const SP_PROGRESS_RATE: Record<string, number> = {
  SUBMITTED: 0,
  PRD_REVIEW: 0,
  SP_REVIEW: 0,
  DEVELOPING: 0.5,
  ACCEPTANCE: 0.75,
  CLOSED: 1.0,
  ON_HOLD: 0,
  CANCELLED: 0,
}

/** 依據狀態計算漸進已使用 SP（精確數值，不四捨五入） */
export function calcUsedSp(status: string, effectiveSp: number, heldFromStatus?: string | null): number {
  // 已取消：完全釋放 SP，不論取消前進行到哪個階段
  if (status === "CANCELLED") return 0
  let effectiveStatus = status
  if (status === "ON_HOLD" || status === "REJECTED") {
    effectiveStatus = heldFromStatus || status
  }
  const rate = SP_PROGRESS_RATE[effectiveStatus] ?? 0
  return effectiveSp * rate
}

export const DEFAULT_SUBTASK_TEMPLATES = [
  "前端開發",
  "後端開發",
  "資料庫",
  "內部測試",
  "部署",
]
