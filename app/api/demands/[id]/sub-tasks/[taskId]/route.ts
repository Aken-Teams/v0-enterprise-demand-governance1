import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { updateSubTaskSchema } from "@/lib/validations/sub-task"
import { SubTaskStatus } from "@/lib/generated/prisma/client"
import { logAudit } from "@/lib/audit"

// PATCH: Update a sub-task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, taskId } = await params
    const body = await request.json()

    const parseResult = updateSubTaskSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "驗證失敗", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await prisma.demandSubTask.findFirst({
      where: { id: taskId, demandId: id },
      include: { demand: { select: { organizationId: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "子任務不存在" }, { status: 404 })
    }

    // Admin write permission check
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id, organizationId: existing.demand.organizationId,
      })
      if (!canWrite) {
        return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
      }
    }

    const data = parseResult.data
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.plannedStart !== undefined) updateData.plannedStart = data.plannedStart
    if (data.plannedEnd !== undefined) updateData.plannedEnd = data.plannedEnd
    if (data.actualStart !== undefined) updateData.actualStart = data.actualStart
    if (data.actualEnd !== undefined) updateData.actualEnd = data.actualEnd
    if (data.status !== undefined) updateData.status = data.status as SubTaskStatus
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId
    if (data.order !== undefined) updateData.order = data.order

    const subTask = await prisma.demandSubTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: auth.userId,
      action: "UPDATE",
      entity: "SUB_TASK",
      entityId: taskId,
      demandId: id,
      details: { fields: Object.keys(updateData) },
      request,
    })

    return NextResponse.json({ subTask })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update sub-task error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE: Delete a sub-task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, taskId } = await params

    const existing = await prisma.demandSubTask.findFirst({
      where: { id: taskId, demandId: id },
      include: { demand: { select: { organizationId: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "子任務不存在" }, { status: 404 })
    }

    // Admin write permission check
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id, organizationId: existing.demand.organizationId,
      })
      if (!canWrite) {
        return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
      }
    }

    await prisma.demandSubTask.delete({ where: { id: taskId } })

    logAudit({
      userId: auth.userId,
      action: "DELETE",
      entity: "SUB_TASK",
      entityId: taskId,
      demandId: id,
      details: { name: existing.name },
      request,
    })

    return NextResponse.json({ message: "子任務已刪除" })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Delete sub-task error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
