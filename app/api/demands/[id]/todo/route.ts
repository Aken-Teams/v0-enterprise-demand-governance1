import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

/**
 * 單一需求的內部待辦筆記。
 *
 * 權限刻意收得很緊——只有管理者與交付團隊。需求方與 Scrum Master 一律 403：
 * 這份筆記是團隊自我管理用的，寫的內容不該被當成對外承諾或流程依據。
 *
 * 交付團隊另需為該案的負責人（開發者或階段 PM／工程師），避免看到不相干專案的筆記。
 */

async function canAccess(auth: { userId: string; role: string }, demandId: string) {
  if (auth.role === "admin") return true
  if (auth.role !== "delivery") return false
  const hit = await prisma.demand.findFirst({
    where: {
      id: demandId,
      OR: [
        { developerId: auth.userId },
        { phasePlans: { some: { pmId: auth.userId } } },
        { phasePlans: { some: { engineerId: auth.userId } } },
      ],
    },
    select: { id: true },
  })
  return !!hit
}

// GET: 取得筆記（沒有就回 null，不預先建立空白列）
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params
    if (!(await canAccess(auth, id))) {
      return NextResponse.json({ error: "無權限查看此專案待辦" }, { status: 403 })
    }

    const todo = await prisma.demandTodo.findUnique({
      where: { demandId: id },
      select: {
        content: true,
        overdueNote: true,
        updatedAt: true,
        updatedBy: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ todo })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Get todo error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

/**
 * PUT: 儲存筆記、逾期說明與實際完成日。
 *
 * 實際完成日寫回該需求「目前階段」的甘特圖規劃——待辦頁本來就是開發者每天會看的地方，
 * 讓他在這裡順手填，比要求他再進需求頁找甘特圖實際得多；資料仍只有一份。
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params
    if (!(await canAccess(auth, id))) {
      return NextResponse.json({ error: "無權限編輯此專案待辦" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const content = typeof body.content === "string" ? body.content : undefined
    const overdueNote = typeof body.overdueNote === "string" ? body.overdueNote : undefined
    const actualEnd = body.actualEnd === null || typeof body.actualEnd === "string" ? body.actualEnd : undefined

    // 實際完成日寫入目前階段的甘特圖規劃
    if (actualEnd !== undefined) {
      const dem = await prisma.demand.findUnique({ where: { id }, select: { status: true } })
      if (dem) {
        const value = actualEnd ? new Date(actualEnd) : null
        await prisma.demandPhasePlan.upsert({
          where: { demandId_phase: { demandId: id, phase: dem.status } },
          create: { demandId: id, phase: dem.status, actualEnd: value },
          update: { actualEnd: value },
        })
      }
    }

    const existing = await prisma.demandTodo.findUnique({
      where: { demandId: id },
      select: { content: true, overdueNote: true },
    })
    const nextContent = content ?? existing?.content ?? ""
    const nextNote = overdueNote ?? existing?.overdueNote ?? null

    // 筆記與逾期說明都空了就刪掉，不留空白紀錄
    if (!nextContent.trim() && !nextNote?.trim()) {
      await prisma.demandTodo.deleteMany({ where: { demandId: id } })
      return NextResponse.json({ todo: null })
    }

    const todo = await prisma.demandTodo.upsert({
      where: { demandId: id },
      create: { demandId: id, content: nextContent, overdueNote: nextNote, updatedById: auth.userId },
      update: { content: nextContent, overdueNote: nextNote, updatedById: auth.userId },
      select: {
        content: true,
        overdueNote: true,
        updatedAt: true,
        updatedBy: { select: { id: true, name: true } },
      },
    })

    // 內容本身不入稽核紀錄（可能含個人備忘），只記錄有人編輯過
    logAudit({
      userId: auth.userId,
      action: "UPDATE",
      entity: "DEMAND_TODO",
      entityId: id,
      demandId: id,
      details: { length: nextContent.length },
      request,
    })

    return NextResponse.json({ todo })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Save todo error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
