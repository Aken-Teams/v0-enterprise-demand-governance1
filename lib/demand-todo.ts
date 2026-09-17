import { PHASE_DOCUMENT_MAP, DOCUMENT_TYPE_LABELS, STATUS_MAP } from "@/lib/constants/demand"

/**
 * 專案待辦的「系統自動項目」。
 *
 * 這些是系統本來就知道、不該叫人手打的事：文件缺哪份、報價單補了沒、
 * 設計變更有沒有卡著、簽核等幾天了。自動推導的好處是永遠準確、補上就自己消失，
 * 不會像手填欄位那樣過一陣子就沒人維護（過期的狀態比沒有狀態更糟）。
 *
 * 與此相對，使用者自己寫的 checklist 完全自由、不受這裡限制。
 */

export type TodoItemKind =
  | "MISSING_DOC"
  | "QUOTE_MISSING"
  | "QUOTE_UNREVIEWED"
  | "DESIGN_CHANGE_PENDING"
  | "SIGNOFF_PENDING"
  | "DEV_LINK_UNCONFIRMED"
  | "CLOSING_SP_PENDING"
  | "OVERDUE"

export interface DerivedTodoItem {
  kind: TodoItemKind
  /** 顯示文字 */
  label: string
  /** 補充說明（例如卡幾天、缺哪幾份） */
  detail?: string
  /** 等待天數，供排序「卡最久的排前面」 */
  waitingDays?: number
  /** 僅管理者看得到（例如智合抽成與報價單屬內部財務資訊） */
  adminOnly?: boolean
}

interface DemandLike {
  status: string
  zhiheSpTaken?: number | null
  quoteReviewedAt?: Date | string | null
  devLinkConfirmedAt?: Date | string | null
  expectedDate?: Date | string | null
  completedDate?: Date | string | null
  documents?: { type: string; phase: string | null }[]
  designChanges?: { status: string }[]
  phaseSignoffs?: {
    kind?: string | null
    status: string
    phase: string
    requestedAt: Date | string
    targetUser?: { name: string } | null
  }[]
}

const dayDiff = (from: Date | string) =>
  Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86400000))

/**
 * 推導一張需求目前「還沒做的事」。
 *
 * @param demand   需求（含文件、設計變更、簽核）
 * @param isAdmin  非管理者不會看到財務相關項目（智合抽成、報價單）
 */
export function deriveTodoItems(demand: DemandLike, isAdmin: boolean): DerivedTodoItem[] {
  const items: DerivedTodoItem[] = []
  const docs = demand.documents ?? []

  // 1) 目前階段缺少的必要文件
  const required = PHASE_DOCUMENT_MAP[demand.status]?.required ?? []
  const missing = required.filter(
    (type) => !docs.some((d) => d.phase === demand.status && d.type === type)
  )
  if (missing.length > 0) {
    items.push({
      kind: "MISSING_DOC",
      label: "補齊本階段必要文件",
      detail: missing.map((t) => DOCUMENT_TYPE_LABELS[t] || t).join("、"),
    })
  }

  // 2) 智合抽成相關（內部財務，僅管理者）
  if (isAdmin && demand.zhiheSpTaken != null && demand.zhiheSpTaken > 0) {
    const hasQuote = docs.some((d) => d.type === "ZHIHE_QUOTE")
    if (!hasQuote) {
      items.push({
        kind: "QUOTE_MISSING",
        label: "補上智合報價單",
        detail: `本案智合抽成 ${demand.zhiheSpTaken} SP，尚未上傳報價單`,
        adminOnly: true,
      })
    } else if (!demand.quoteReviewedAt) {
      items.push({
        kind: "QUOTE_UNREVIEWED",
        label: "報價單待審核",
        detail: "已上傳但尚未完成審核",
        adminOnly: true,
      })
    }
  }

  // 3) 未完成的設計變更會擋住階段簽核
  const pendingDc = (demand.designChanges ?? []).filter((d) => d.status === "PENDING").length
  if (pendingDc > 0) {
    items.push({
      kind: "DESIGN_CHANGE_PENDING",
      label: `處理 ${pendingDc} 筆未完成的設計變更`,
      detail: "設計變更未完成前，本階段簽核會被擋住",
    })
  }

  // 4) 待簽核（附上已等待天數）
  const pendingSignoffs = (demand.phaseSignoffs ?? []).filter(
    (s) => s.status === "PENDING" && (s.kind ?? "PHASE") === "PHASE" && s.phase === demand.status
  )
  if (pendingSignoffs.length > 0) {
    const oldest = pendingSignoffs.reduce((a, b) =>
      new Date(a.requestedAt) <= new Date(b.requestedAt) ? a : b
    )
    const days = dayDiff(oldest.requestedAt)
    const names = pendingSignoffs.map((s) => s.targetUser?.name).filter(Boolean)
    items.push({
      kind: "SIGNOFF_PENDING",
      label: `追 ${STATUS_MAP[demand.status]?.label ?? demand.status} 簽核`,
      detail: `${names.length > 0 ? `待 ${names.join("、")} 簽核` : "待簽核"}，已等待 ${days} 天`,
      waitingDays: days,
    })
  }

  // 5) 首次 APP 交付尚未經需求方確認（確認後才認列 25%）
  if (demand.status === "DEVELOPING" && !demand.devLinkConfirmedAt) {
    const hasLink = docs.some((d) => d.type === "APP_RESULT" && d.phase === "DEVELOPING")
    items.push({
      kind: "DEV_LINK_UNCONFIRMED",
      label: hasLink ? "追首次 APP 交付確認" : "上傳 APP 交付連結",
      detail: hasLink ? "需求方確認後才認列 25% SP" : "開發中尚未提供可試用的連結",
    })
  }

  // 6) 結案 SP 調整待簽核
  const closingSp = (demand.phaseSignoffs ?? []).find(
    (s) => s.kind === "CLOSING_SP" && s.status === "PENDING"
  )
  if (closingSp) {
    const days = dayDiff(closingSp.requestedAt)
    items.push({
      kind: "CLOSING_SP_PENDING",
      label: "追結案 SP 簽核",
      detail: `已送出 ${days} 天，Scrum Master 同意後才完成結案`,
      waitingDays: days,
    })
  }

  // 7) 逾期未完成
  if (
    demand.expectedDate &&
    !demand.completedDate &&
    demand.status !== "CLOSED" &&
    demand.status !== "CANCELLED" &&
    new Date(demand.expectedDate).getTime() < Date.now()
  ) {
    const days = dayDiff(demand.expectedDate)
    items.push({
      kind: "OVERDUE",
      label: "已逾預計完成日",
      detail: `逾期 ${days} 天，請補充說明或調整時程`,
      waitingDays: days,
    })
  }

  // 卡最久的排前面，沒有天數的排後面
  return items.sort((a, b) => (b.waitingDays ?? -1) - (a.waitingDays ?? -1))
}
