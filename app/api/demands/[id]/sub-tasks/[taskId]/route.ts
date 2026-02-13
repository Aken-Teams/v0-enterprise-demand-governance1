import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { updateSubTaskSchema } from "@/lib/validations/sub-task"
import { SubTaskStatus } from "@/lib/generated/prisma/client"

// PATCH: Update a sub-task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    verifyRole(request, ["admin", "delivery"])
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
    })
    if (!existing) {
      return NextResponse.json({ error: "子任務不存在" }, { status: 404 })
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
    verifyRole(request, ["admin", "delivery"])
    const { id, taskId } = await params

    const existing = await prisma.demandSubTask.findFirst({
      where: { id: taskId, demandId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: "子任務不存在" }, { status: 404 })
    }

    await prisma.demandSubTask.delete({ where: { id: taskId } })

    return NextResponse.json({ message: "子任務已刪除" })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Delete sub-task error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
