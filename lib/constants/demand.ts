export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "需求確認", color: "bg-blue-100 text-blue-700" },
  PRD_REVIEW: { label: "MVP 架構確認", color: "bg-amber-100 text-amber-700" },
  SP_REVIEW: { label: "開案確認", color: "bg-orange-100 text-orange-700" },
  DEVELOPING: { label: "開發中", color: "bg-violet-100 text-violet-700" },
  ACCEPTANCE: { label: "驗收中", color: "bg-purple-100 text-purple-700" },
  CLOSED: { label: "已結案", color: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "已駁回", color: "bg-red-100 text-red-700" },
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
    required: ["PRD", "MODULE_ARCHITECTURE"],
    optional: ["ATTACHMENT"],
  },
  SP_REVIEW: {
    required: ["SP_PLAN"],
    optional: ["ATTACHMENT"],
  },
  DEVELOPING: {
    required: ["SDD"],
    optional: ["APP_RESULT", "ATTACHMENT"],
  },
  ACCEPTANCE: {
    required: ["BDD", "TDD", "TEST_REPORT"],
    optional: ["ATTACHMENT"],
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
  AUDIO: "音訊",
  VIDEO: "影片",
}

/** 各階段簡要說明，讓管理者了解該階段的工作重點 */
export const PHASE_DESCRIPTIONS: Record<string, string> = {
  SUBMITTED: "與需求者面談了解需求，記錄會議內容",
  PRD_REVIEW: "PM 撰寫 PRD，指派工程師進行 MVP 架構設計",
  SP_REVIEW: "填寫 SP 規劃文件，分配各階段 SP 點數與時程",
  DEVELOPING: "依甘特圖進行開發，產出 SDD 與 APP 成果",
  ACCEPTANCE: "工程師提供 BDD/TDD 文件，使用者進行驗收測試",
  CLOSED: "需求已完成結案",
}

/** 各階段需要完成的關鍵動作 */
export const PHASE_ACTIONS: Record<string, string[]> = {
  SUBMITTED: ["上傳會議記錄"],
  PRD_REVIEW: ["指派 PM 與工程師", "上傳 PRD", "上傳模組架構文件"],
  SP_REVIEW: ["填寫各階段 SP 點數", "填寫各階段甘特圖時程", "上傳 SP 規劃文件"],
  DEVELOPING: ["管理開發子任務", "上傳 SDD 文件"],
  ACCEPTANCE: ["上傳 BDD 文件", "上傳 TDD 文件", "上傳測試報告"],
  CLOSED: [],
}

export const DEFAULT_SUBTASK_TEMPLATES = [
  "前端開發",
  "後端開發",
  "資料庫",
  "內部測試",
  "部署",
]
