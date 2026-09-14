export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "需求確認", color: "bg-blue-100 text-blue-700" },
  PRD_REVIEW: { label: "PRD 文件確認", color: "bg-amber-100 text-amber-700" },
  SP_REVIEW: { label: "開案確認", color: "bg-orange-100 text-orange-700" },
  DEVELOPING: { label: "開發中", color: "bg-violet-100 text-violet-700" },
  ACCEPTANCE: { label: "驗收中", color: "bg-purple-100 text-purple-700" },
  CLOSED: { label: "已結案", color: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "已駁回", color: "bg-red-100 text-red-700" },
  ON_HOLD: { label: "暫緩", color: "bg-yellow-100 text-yellow-700" },
  CANCELLED: { label: "已取消", color: "bg-slate-200 text-slate-600" },
  // 顯示用（非資料庫狀態）：經 Scrum Master 代簽直接結案 → 客戶認知為「已終止」
  TERMINATED: { label: "已終止", color: "bg-zinc-200 text-zinc-700" },
  // 顯示用（非資料庫狀態）：有待 Scrum Master 確認的「代簽終止結算」→ 終止簽核中
  TERMINATING: { label: "終止簽核中", color: "bg-orange-100 text-orange-700" },
  // 顯示用（非資料庫狀態）：結案 SP 調整已送出、等 Scrum Master 核准 → 結案簽核中
  CLOSING_SP_REVIEW: { label: "結案簽核中", color: "bg-orange-100 text-orange-700" },
}

/**
 * 需求「顯示用」狀態鍵。實際資料庫狀態不受影響（SP 結算、分析等照舊）：
 *  - CLOSED 且經代簽終止 → TERMINATED（已終止）
 *  - 尚未結案但已送出結案 SP 調整、等 Scrum Master 核准 → CLOSING_SP_REVIEW（結案簽核中）
 *    否則需求會一直顯示「驗收中」，看不出正在等結案簽核。
 */
export function demandStatusKey(
  status: string,
  isTerminated?: boolean | null,
  hasPendingClosingSp?: boolean | null
): string {
  if (status === "CLOSED" && isTerminated) return "TERMINATED"
  if (status !== "CLOSED" && hasPendingClosingSp) return "CLOSING_SP_REVIEW"
  return status
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
  ZHIHE_QUOTE: "智合報價單",
}

/** 各階段簡要說明，讓管理者了解該階段的工作重點 */
export const PHASE_DESCRIPTIONS: Record<string, string> = {
  SUBMITTED: "與需求窗口面談了解需求，記錄會議內容",
  PRD_REVIEW: "PM 撰寫 PRD 需求規格文件，供需求方逐項確認",
  SP_REVIEW: "填寫 SP 規劃文件，分配各階段 SP 點數與時程",
  DEVELOPING: "依甘特圖進行開發，產出 SDD、APP 成果與 GitHub 連結",
  ACCEPTANCE: "工程師提供 BDD/TDD 文件，需求方進行驗收測試",
  CLOSED: "需求已完成結案",
}

/** 各階段需要完成的關鍵動作 */
export const PHASE_ACTIONS: Record<string, string[]> = {
  SUBMITTED: ["上傳會議記錄"],
  PRD_REVIEW: ["指派 PM 與工程師", "上傳 PRD"],
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
  REQUESTER: "需求窗口",
  MANAGER: "需求主管",
  BOARD: "Scrum Master",
  BOARD_OVERRIDE: "Scrum Master 代簽",
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

/**
 * 可發起設計變更的階段：開發中／驗收中（即「開案之後」）。
 *
 * 需求確認、PRD 文件確認、開案確認階段：範圍還在成形，直接改需求即可，
 *         此時的 SP 仍是「預估 SP」，不需要用設計變更留紀錄。
 * 已結案：SP 已於結案時依設計變更紀錄結算完畢（有調整者並經 Scrum Master 核准），
 *         此時再開變更會讓結算基準與紀錄對不上，故不開放。
 */
export const DESIGN_CHANGE_ALLOWED_PHASES = [
  "DEVELOPING",
  "ACCEPTANCE",
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
  CLOSING_SP: "結案 SP 調整",
}

/** 設計變更審核階段標籤 */
export const DESIGN_CHANGE_STAGE_LABELS: Record<string, string> = {
  GATE: "設計變更確認",
  CONTENT: "逐條確認",
}

/** 設計變更審核階段說明（顯示於審核介面，讓簽核人知道自己在裁決什麼） */
export const DESIGN_CHANGE_STAGE_DESCRIPTIONS: Record<string, string> = {
  GATE: "由 Scrum Master 與需求窗口決定「這個設計變更准不准開」。兩方皆同意後，才會開放需求方逐條確認內容。",
  CONTENT: "需求方逐項確認變更內容，全部確認後此設計變更才算通過。",
}

/**
 * 「終止開發結案」的結算落點。
 *
 * 這裡選的是**結算依據**，不是把需求改成該狀態——通過後一律結案並顯示為「已終止」。
 * 名稱與說明對齊《JV 開案流程》文件「結算比例」一節，避免管理者把
 * 「已結案 100%」誤讀成「把狀態改成已結案」。
 */
export const SETTLEMENT_TIERS: Record<string, { label: string; desc: string }> = {
  DEVELOPING: {
    label: "已開案、尚未交付",
    desc: "已開案並進入開發，尚未完成首次 APP 交付確認，也尚未進入驗收。",
  },
  ACCEPTANCE: {
    label: "已首次交付／驗收中",
    desc: "已完成首次 APP 交付確認，或已進入驗收階段。",
  },
  CLOSED: {
    label: "實質完成",
    desc: "功能實質完成並已達可結案狀態，僅因程序或雙方決議以終止方式收尾。",
  },
}

/** 結算落點的顯示名稱（查無對應時退回階段名稱） */
export function settlementTierLabel(status: string): string {
  return SETTLEMENT_TIERS[status]?.label ?? STATUS_MAP[status]?.label ?? status
}

/**
 * SP 數值顯示：保留最多兩位小數並去掉尾隨的 0。
 *
 * SP 本來就可能不是整數（15 SP 的 75% = 11.25），四捨五入會讓畫面上的
 * 金額與實際結算對不起來，故一律以精確值呈現。
 */
export function formatSp(n: number): string {
  if (!Number.isFinite(n)) return "0"
  return String(Math.round(n * 100) / 100)
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

/**
 * 需求實際適用的 SP 認列比例。
 *
 * 開發中若「APP 交付連結」已經需求方確認，即提前認列至驗收中的比例（75%）——
 * 開發端已投入並交付成果，不必等整個開發階段走完才計費。
 *
 * 這也是避免重複計費的關鍵：之後推進到驗收中時比例同為 75%，
 * 差額為 0，不會再扣一次。未確認者則維持原有「進入驗收才認列」的行為，
 * 兩條路徑天然相容，先觸發哪個就算哪個。
 */
export function spRateOf(status: string, devLinkConfirmed?: boolean | null): number {
  if (status === "DEVELOPING" && devLinkConfirmed) return SP_PROGRESS_RATE.ACCEPTANCE
  return SP_PROGRESS_RATE[status] ?? 0
}

/** 依據狀態計算漸進已使用 SP（精確數值，不四捨五入） */
export function calcUsedSp(
  status: string,
  effectiveSp: number,
  heldFromStatus?: string | null,
  devLinkConfirmed?: boolean | null
): number {
  // 已取消：完全釋放 SP，不論取消前進行到哪個階段
  if (status === "CANCELLED") return 0
  let effectiveStatus = status
  if (status === "ON_HOLD" || status === "REJECTED") {
    effectiveStatus = heldFromStatus || status
  }
  return effectiveSp * spRateOf(effectiveStatus, devLinkConfirmed)
}

export const DEFAULT_SUBTASK_TEMPLATES = [
  "前端開發",
  "後端開發",
  "資料庫",
  "內部測試",
  "部署",
]
