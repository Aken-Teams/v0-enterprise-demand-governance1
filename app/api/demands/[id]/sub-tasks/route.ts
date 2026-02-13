import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { createSubTaskSchema } from "@/lib/validations/sub-task"

// GET: List sub-tasks for a demand
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    verifyAuth(request)
    const { id } = await params

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const subTasks = await prisma.demandSubTask.findMany({
      where: { demandId: id },
      include: {
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { order: "asc" },
    })

    return NextResponse.json({ subTasks })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Get sub-tasks error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// POST: Create a sub-task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    verifyRole(request, ["admin", "delivery"])
    const { id } = await params
    const body = await request.json()

    const parseResult = createSubTaskSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "驗證失敗", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const data = parseResult.data
    const subTask = await prisma.demandSubTask.create({
      data: {
        demandId: id,
        name: data.name,
        plannedStart: data.plannedStart ?? null,
        plannedEnd: data.plannedEnd ?? null,
        assigneeId: data.assigneeId ?? null,
        order: data.order,
      },
      include: {
        assignee: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ subTask }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Create sub-task error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
