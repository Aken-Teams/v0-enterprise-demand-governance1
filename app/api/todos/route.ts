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

    // 已駁回不列入（那是簽核退回、不是專案狀態）；已取消與已終止仍保留，
    // 讓使用者能在清單中查到，只是預設會被前端的狀態篩選收起來。
    const where: Record<string, unknown> = {
      status: { not: "REJECTED" },
    }

    if (isAdmin) {
      const visibility = await buildDemandVisibilityFilter(auth)
      if (visibility) Object.assign(where, visibility)
    } else {
      // 交付團隊只看「自己負責」的案子。
      // 刻意不含「某階段被指派為 PM／工程師」——實測那會把別人的專案一起帶進來
      // （同一位工程師常被掛在他人案子的某個階段），與「我的待辦」的語意不符。
      where.developerId = auth.userId
    }

    const demands = await prisma.demand.findMany({
      where,
      select: {
        id: true,
        demandNumber: true,
        title: true,
        status: true,
        isTerminated: true,
        vendor: true,
        expectedDate: true,
        desiredDate: true,
        completedDate: true,
        devLinkConfirmedAt: true,
        zhiheSpTaken: isAdmin,
        quoteReviewedAt: isAdmin,
        organization: { select: { name: true } },
        developer: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        contactPerson_: { select: { id: true, name: true } },
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
          select: {
            phase: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true,
            pm: { select: { id: true, name: true } },
          },
        },
        // 甘特圖細項——開發者真正要填的預計／實際完成日在這一層，不是整個專案
        subTasks: {
          select: {
            id: true, name: true, status: true, order: true,
            plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true,
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { order: "asc" },
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
      isTerminated: d.isTerminated,
      vendor: d.vendor,
      organization: d.organization.name,
      developer: d.developer,
      contactPerson: d.contactPerson_,
      // PM 記在階段規劃上，取目前階段的；沒有就退回任一階段有指派的
      // PM 以需求層級的 manager 為準（欄位註解即為「PM / 管理者」）；
      // 階段規劃上的 pm 多半沒填，僅作為後備
      pm:
        d.manager ??
        d.phasePlans.find((p) => p.phase === d.status)?.pm ??
        d.phasePlans.find((p) => p.pm)?.pm ??
        null,
      expectedDate: d.expectedDate,
      desiredDate: d.desiredDate,
      completedDate: d.completedDate,
      // 目前階段的規劃／實際結束日——開發者要填的「實際完成日」就是這個
      currentPhasePlan: d.phasePlans.find((p) => p.phase === d.status) ?? null,
      subTasks: d.subTasks,
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
