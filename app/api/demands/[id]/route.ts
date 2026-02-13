import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { DemandStatus } from "@/lib/generated/prisma/client"

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["PRD_REVIEW", "REJECTED"],
  PRD_REVIEW: ["SP_REVIEW", "SUBMITTED", "REJECTED"],
  SP_REVIEW: ["DEVELOPING", "PRD_REVIEW", "REJECTED"],
  DEVELOPING: ["ACCEPTANCE"],
  ACCEPTANCE: ["CLOSED", "DEVELOPING"],
  CLOSED: [],
  REJECTED: ["SUBMITTED"],
}

const VALID_STATUSES = new Set<string>(Object.values(DemandStatus))

// PATCH: Update demand status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin"])
    const { id } = await params
    const { status } = await request.json()

    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "無效的狀態" }, { status: 400 })
    }

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const allowed = STATUS_TRANSITIONS[demand.status] || []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `無法從「${demand.status}」轉換到「${status}」` },
        { status: 400 }
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.demand.update({
        where: { id },
        data: { status: status as DemandStatus },
      })
      await tx.demandStatusHistory.create({
        data: {
          demandId: id,
          fromStatus: demand.status,
          toStatus: status,
          comment: "狀態變更",
          changedBy: auth.userId,
        },
      })
      return d
    })

    return NextResponse.json({ demand: { id: updated.id, status: updated.status } })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update demand status error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE: Delete a demand
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    verifyRole(request, ["admin"])
    const { id } = await params

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    await prisma.demand.delete({ where: { id } })

    return NextResponse.json({ message: "需求已刪除" })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Delete demand error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
