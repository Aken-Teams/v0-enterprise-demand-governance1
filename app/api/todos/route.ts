import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { buildDemandVisibilityFilter } from "@/lib/demand-access"
import { deriveTodoItems } from "@/lib/demand-todo"

/**
 * 專案待辦清單（內部用）。
 *
 * **僅限管理者與交付團隊**：這是團隊自我管理的記事本，不對需求方與 Scrum Master 開放，
 * 也刻意不進入需求詳情、分享連結與報表匯出。
 *
 * 管理者看得到可見範圍內的全部需求；交付團隊只看得到自己負責（開發者或階段 PM／工程師）
 * 的案子——待辦本來就是「我該做什麼」，看別人的案子沒有意義。
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const isAdmin = auth.role === "admin"

    const where: Record<string, unknown> = {
      // 已取消與已駁回不需要待辦
      status: { notIn: ["CANCELLED", "REJECTED"] },
    }

    if (isAdmin) {
      const visibility = await buildDemandVisibilityFilter(auth)
      if (visibility) Object.assign(where, visibility)
    } else {
      // 交付團隊：自己是開發者，或在任一階段被指派為 PM／工程師
      where.OR = [
        { developerId: auth.userId },
        { phasePlans: { some: { pmId: auth.userId } } },
        { phasePlans: { some: { engineerId: auth.userId } } },
      ]
    }

    const demands = await prisma.demand.findMany({
      where,
      select: {
        id: true,
        demandNumber: true,
        title: true,
        status: true,
        vendor: true,
        expectedDate: true,
        desiredDate: true,
        completedDate: true,
        devLinkConfirmedAt: true,
        zhiheSpTaken: isAdmin,
        quoteReviewedAt: isAdmin,
        organization: { select: { name: true } },
        developer: { select: { id: true, name: true } },
        documents: { select: { type: true, phase: true } },
        designChanges: { select: { status: true } },
        phaseSignoffs: {
          where: { status: "PENDING" },
          select: {
            kind: true,
            status: true,
            phase: true,
            requestedAt: true,
            targetUser: { select: { name: true } },
          },
        },
        phasePlans: {
          select: { phase: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true },
        },
        todo: {
          select: {
            content: true,
            overdueNote: true,
            updatedAt: true,
            updatedBy: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    const rows = demands.map((d) => ({
      id: d.id,
      demandNumber: d.demandNumber,
      title: d.title,
      status: d.status,
      vendor: d.vendor,
      organization: d.organization.name,
      developer: d.developer,
      expectedDate: d.expectedDate,
      desiredDate: d.desiredDate,
      completedDate: d.completedDate,
      // 目前階段的規劃／實際結束日——開發者要填的「實際完成日」就是這個
      currentPhasePlan: d.phasePlans.find((p) => p.phase === d.status) ?? null,
      todo: d.todo ?? null,
      derived: deriveTodoItems(d as never, isAdmin),
    }))

    return NextResponse.json({ todos: rows })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("List todos error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
