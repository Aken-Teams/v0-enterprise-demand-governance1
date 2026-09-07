import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { canAccessDemand, canAdminWrite } from "@/lib/demand-access"
import { resolveBoardReviewers } from "@/lib/board"
import { PIPELINE_STEPS } from "@/lib/constants/demand"
import { notifyUsers } from "@/lib/notify"
import { logAudit } from "@/lib/audit"
import type { ClosingSpPayload } from "@/lib/closing-sp"
import { parseClosingSpPayload } from "@/lib/closing-sp"

/**
 * 結案 SP 調整的董事會簽核。
 *
 * 舊流程：管理者在結案精靈直接送出 SP 調整，需求立刻結案，董事會無從得知。
 * 新流程：SP 有變動時必須先建立此請求，附上造成調整的設計變更（僅限已通過者），
 *         送董事會簽核；全數同意後才由簽核端實際套用 SP 並結案（見
 *         app/api/demands/[id]/signoffs/[signoffId]/route.ts 的 CLOSING_SP 處理）。
 */

// GET: 取得此需求待董事會簽核的結案 SP 調整（無則回傳 null）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id } = await params

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: { id: true, organizationId: true, developerId: true },
    })
    if (!demand) return NextResponse.json({ error: "需求不存在" }, { status: 404 })

    const canView = await canAccessDemand(auth, demand)
    if (!canView) return NextResponse.json({ error: "無權限查看此需求" }, { status: 403 })

    const signoffs = await prisma.phaseSignoff.findMany({
      where: { demandId: id, kind: "CLOSING_SP", status: "PENDING" },
      include: {
        targetUser: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: "desc" },
    })

    if (signoffs.length === 0) return NextResponse.json({ request: null })

    const payload = parseClosingSpPayload(signoffs[0].payload)

    // 附上勾選的設計變更摘要，讓董事會知道這次調整的來由
    const designChanges = payload?.designChangeIds?.length
      ? await prisma.designChange.findMany({
          where: { id: { in: payload.designChangeIds }, demandId: id },
          select: { id: true, seq: true, title: true, status: true },
          orderBy: { seq: "asc" },
        })
      : []

    return NextResponse.json({
      request: {
        requestedAt: signoffs[0].requestedAt,
        requestedBy: signoffs[0].requestedBy,
        payload,
        designChanges,
        signoffs: signoffs.map((s) => ({
          id: s.id,
          status: s.status,
          targetUser: s.targetUser,
        })),
      },
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Get closing SP request error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// POST: 發起結案 SP 調整的董事會簽核
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params
    const body = await request.json()

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: {
        id: true, demandNumber: true, title: true, status: true, organizationId: true,
        estimatedSp: true, confirmedSp: true,
      },
    })
    if (!demand) return NextResponse.json({ error: "需求不存在" }, { status: 404 })

    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id: demand.id, organizationId: demand.organizationId,
      })
      if (!canWrite) return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
    }

    if (demand.status === "CLOSED") {
      return NextResponse.json({ error: "此需求已結案" }, { status: 400 })
    }

    // 同一需求同時只允許一筆待簽核的結案 SP 調整
    const existing = await prisma.phaseSignoff.findFirst({
      where: { demandId: id, kind: "CLOSING_SP", status: "PENDING" },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: "已有一筆結案 SP 調整待董事會簽核，請先完成或撤回" }, { status: 409 })
    }

    // 尚有未結的設計變更時，不應先送結案 SP 給董事會（董事會需看到完整的變更結果）
    const blockingDC = await prisma.designChange.findFirst({
      where: { demandId: id, status: { in: ["PENDING", "REJECTED"] } },
      select: { seq: true, status: true },
    })
    if (blockingDC) {
      return NextResponse.json(
        { error: `請先完成設計變更審核（DC-${String(blockingDC.seq).padStart(2, "0")} ${blockingDC.status === "PENDING" ? "待確認" : "已駁回"}）` },
        { status: 409 }
      )
    }

    const oldSp = demand.confirmedSp ?? demand.estimatedSp
    const newSp = Number(body.newSp)
    if (!Number.isFinite(newSp) || newSp <= 0) {
      return NextResponse.json({ error: "調整後 SP 需為正數" }, { status: 400 })
    }
    if (newSp === oldSp) {
      return NextResponse.json({ error: "調整後 SP 與現值相同，無需董事會簽核" }, { status: 400 })
    }

    const reason = ((body.reason as string) ?? "").trim() || null
    const rawIds: string[] = Array.isArray(body.designChangeIds) ? body.designChangeIds : []

    // 只接受本需求且「已通過」的設計變更
    const approved = await prisma.designChange.findMany({
      where: { demandId: id, status: "APPROVED" },
      select: { id: true, seq: true, title: true },
      orderBy: { seq: "asc" },
    })
    const approvedIds = new Set(approved.map((d) => d.id))
    const invalid = rawIds.filter((x) => !approvedIds.has(x))
    if (invalid.length > 0) {
      return NextResponse.json({ error: "勾選的設計變更無效（僅能選擇本需求已通過的設計變更）" }, { status: 400 })
    }
    const designChangeIds = [...new Set(rawIds)]

    // 要求可歸因：有已通過的設計變更就得勾選，否則至少要寫明調整原因
    if (designChangeIds.length === 0 && !reason) {
      return NextResponse.json(
        {
          error: approved.length > 0
            ? "請勾選造成此次 SP 調整的設計變更，或填寫調整原因"
            : "請填寫 SP 調整原因",
        },
        { status: 400 }
      )
    }

    // 以設計變更紀錄驗算結案 SP：只認每個已通過設計變更「最終通過版本」的增減，
    // 中途被駁回的版本不計入。結案不應該再自行算一次或填出與紀錄不符的數字。
    const approvedWithRev = await prisma.designChange.findMany({
      where: { demandId: id, status: "APPROVED" },
      select: {
        id: true, seq: true,
        revisions: {
          where: { status: "APPROVED" },
          orderBy: { version: "desc" },
          take: 1,
          select: { affectsSp: true, spDelta: true },
        },
      },
    })
    const dcTotalDelta = approvedWithRev.reduce((sum, d) => {
      const r = d.revisions[0]
      return sum + (r?.affectsSp ? (r.spDelta ?? 0) : 0)
    }, 0)
    const expectedSp = oldSp + dcTotalDelta
    const isOverride = body.override === true

    if (!isOverride && dcTotalDelta !== 0 && Math.abs(newSp - expectedSp) > 1e-9) {
      return NextResponse.json(
        { error: `結案 SP 與設計變更紀錄不符：依已通過的設計變更應為 ${expectedSp}（原始 ${oldSp}，變更累計 ${dcTotalDelta > 0 ? "+" : ""}${dcTotalDelta}），送出值為 ${newSp}` },
        { status: 400 }
      )
    }
    if (isOverride && !reason) {
      return NextResponse.json({ error: "手動覆寫結案 SP 時必須填寫原因" }, { status: 400 })
    }

    // 階段分配（沿用結案精靈的欄位，僅保留正式流程中的階段）
    let phaseAllocations: Record<string, number> | null = null
    if (body.phaseAllocations && typeof body.phaseAllocations === "object") {
      phaseAllocations = {}
      for (const step of PIPELINE_STEPS) {
        if (step === "CLOSED") continue
        const v = Number((body.phaseAllocations as Record<string, unknown>)[step])
        phaseAllocations[step] = Number.isFinite(v) && v > 0 ? v : 0
      }
    }

    const completedDate = body.completedDate ? String(body.completedDate) : null

    const boardTargets = await resolveBoardReviewers(demand.organizationId)
    if (boardTargets.length === 0) {
      return NextResponse.json({ error: "查無可簽核的董事會成員，請先設定董事會" }, { status: 400 })
    }

    const payload: ClosingSpPayload = {
      oldSp, newSp, reason, phaseAllocations, completedDate, designChangeIds,
    }
    const payloadJson = JSON.stringify(payload)
    const requestedAt = new Date()

    await prisma.phaseSignoff.createMany({
      data: boardTargets.map((t) => ({
        demandId: id,
        phase: "CLOSED" as const,
        kind: "CLOSING_SP",
        status: "PENDING" as const,
        requestedById: auth.userId,
        targetUserId: t.userId,
        targetRole: "BOARD",
        requestComment: reason,
        payload: payloadJson,
        requestedAt,
      })),
    })

    const dcLabel = designChangeIds.length > 0
      ? approved
          .filter((d) => designChangeIds.includes(d.id))
          .map((d) => `DC-${String(d.seq).padStart(2, "0")}`)
          .join("、")
      : "無關聯設計變更"

    const boardIds = [...new Set(boardTargets.map((t) => t.userId).filter((uid) => uid !== auth.userId))]
    if (boardIds.length > 0) {
      notifyUsers(boardIds, {
        type: "SIGNOFF",
        title: "結案 SP 調整待董事會簽核",
        message: `需求 ${demand.demandNumber}「${demand.title}」結案時 SP 由 ${oldSp} 調整為 ${newSp}（來源：${dcLabel}），請確認是否同意後結案。`,
        linkUrl: `/demands/${id}`,
      })
    }

    logAudit({
      userId: auth.userId,
      action: "SIGNOFF_REQUEST",
      entity: "SIGNOFF",
      entityId: id,
      demandId: id,
      details: { kind: "CLOSING_SP", oldSp, newSp, expectedSp, dcTotalDelta, override: isOverride, designChangeIds, reason },
      request,
    })

    return NextResponse.json({ success: true, pendingCount: boardTargets.length }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Create closing SP request error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE: 撤回待簽核的結案 SP 調整（發起端反悔或填錯）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    })
    if (!demand) return NextResponse.json({ error: "需求不存在" }, { status: 404 })

    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id: demand.id, organizationId: demand.organizationId,
      })
      if (!canWrite) return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
    }

    const result = await prisma.phaseSignoff.updateMany({
      where: { demandId: id, kind: "CLOSING_SP", status: "PENDING" },
      data: {
        status: "CANCELLED",
        comment: "發起者撤回",
        respondedAt: new Date(),
        respondedById: auth.userId,
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: "沒有待簽核的結案 SP 調整" }, { status: 404 })
    }

    logAudit({
      userId: auth.userId,
      action: "UPDATE",
      entity: "SIGNOFF",
      entityId: id,
      demandId: id,
      details: { kind: "CLOSING_SP", cancelled: result.count },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Cancel closing SP request error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
