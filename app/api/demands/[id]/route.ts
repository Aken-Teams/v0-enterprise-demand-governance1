import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { canAccessDemand } from "@/lib/demand-access"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { PIPELINE_STEPS, SIGNOFF_REQUIRED_PHASES } from "@/lib/constants/demand"
import { updateDemandSchema } from "@/lib/validations/demand"

const VALID_STATUSES = new Set<string>(Object.values(DemandStatus))

// GET: Get demand detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id } = await params

    const demand = await prisma.demand.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        submitter: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } },
        documents: {
          orderBy: { createdAt: "desc" },
        },
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
        phasePlans: {
          include: {
            engineer: { select: { id: true, name: true } },
            pm: { select: { id: true, name: true } },
          },
        },
        subTasks: {
          include: {
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { order: "asc" },
        },
        phaseSignoffs: {
          include: {
            requestedBy: { select: { id: true, name: true } },
            respondedBy: { select: { id: true, name: true } },
            documents: { select: { id: true, fileName: true, fileUrl: true, fileSize: true } },
          },
          orderBy: { requestedAt: "desc" },
        },
      },
    })

    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Access control: check if user can view this demand
    const hasAccess = await canAccessDemand(auth, {
      id: demand.id,
      organizationId: demand.organizationId,
      developerId: demand.developerId,
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "無權限查看此需求" }, { status: 403 })
    }

    return NextResponse.json({ demand })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Get demand detail error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PATCH: Update demand status or assignments
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params
    const body = await request.json()

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Handle assignment update (managerId / developerId) — admin only
    if (body.managerId !== undefined || body.developerId !== undefined) {
      if (auth.role !== "admin") {
        return NextResponse.json({ error: "僅管理者可指派人員" }, { status: 403 })
      }
      const data: Record<string, string | null> = {}
      if (body.managerId !== undefined) data.managerId = body.managerId || null
      if (body.developerId !== undefined) data.developerId = body.developerId || null

      const updated = await prisma.demand.update({
        where: { id },
        data,
        include: {
          manager: { select: { id: true, name: true } },
          developer: { select: { id: true, name: true } },
        },
      })
      return NextResponse.json({
        demand: {
          id: updated.id,
          managerId: updated.managerId,
          developerId: updated.developerId,
          manager: updated.manager,
          developer: updated.developer,
        },
      })
    }

    // Handle field editing (title, description, etc.) — admin only
    if (body.title !== undefined) {
      if (auth.role !== "admin") {
        return NextResponse.json({ error: "僅管理者可編輯需求" }, { status: 403 })
      }
      const parseResult = updateDemandSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "驗證失敗", details: parseResult.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const data = parseResult.data
      const updateData: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        painPoint: data.painPoint || null,
        expectedBenefit: data.expectedBenefit || null,
        estimatedSp: data.estimatedSp,
        desiredDate: data.desiredDate,
        adminNotes: data.adminNotes || null,
      }
      if (data.submitterId) updateData.submitterId = data.submitterId
      const updated = await prisma.demand.update({
        where: { id },
        data: updateData,
      })
      return NextResponse.json({ demand: { id: updated.id } })
    }

    // Handle completedDate-only update (admin only)
    if (!body.status && body.completedDate !== undefined) {
      if (auth.role !== "admin") {
        return NextResponse.json({ error: "僅管理者可修改結案日期" }, { status: 403 })
      }
      const updated = await prisma.demand.update({
        where: { id },
        data: { completedDate: body.completedDate ? new Date(body.completedDate) : null },
      })
      return NextResponse.json({ demand: { id: updated.id } })
    }

    // Handle status update
    const { status } = body
    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "無效的狀態" }, { status: 400 })
    }

    if (demand.status === status) {
      return NextResponse.json({ error: "狀態未變更" }, { status: 400 })
    }

    // Sign-off blocking: only block FORWARD movement from a sign-off phase
    const signoffPhases = SIGNOFF_REQUIRED_PHASES as readonly string[]
    const currentIdx = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
    const targetIdx = PIPELINE_STEPS.indexOf(status as typeof PIPELINE_STEPS[number])
    const isForward = currentIdx >= 0 && targetIdx >= 0 && targetIdx > currentIdx

    if (isForward && signoffPhases.includes(demand.status)) {
      const pendingSignoff = await prisma.phaseSignoff.findFirst({
        where: {
          demandId: id,
          phase: demand.status as DemandStatus,
          status: "PENDING",
        },
        orderBy: { requestedAt: "desc" },
      })

      if (pendingSignoff) {
        if (!body.forceAdvance) {
          return NextResponse.json(
            { error: "此階段需要需求者簽核確認後才能推進", signoffRequired: true, signoffId: pendingSignoff.id },
            { status: 409 }
          )
        }
        // Force advance: mark sign-off as SKIPPED inside transaction below
      }
    }

    // For CLOSED: only set completedDate if explicitly provided (default stays null)
    const closedDate = status === "CLOSED" && body.completedDate
      ? new Date(body.completedDate)
      : null

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.demand.update({
        where: { id },
        data: {
          status: status as DemandStatus,
          ...(status === "CLOSED" && closedDate ? { completedDate: closedDate } : {}),
          // Clear completedDate if moving back from CLOSED
          ...(demand.status === "CLOSED" && status !== "CLOSED" ? { completedDate: null } : {}),
        },
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

      // Auto-set actual dates on phase plans
      const now = new Date()
      const fromIdx = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
      const toIdx = PIPELINE_STEPS.indexOf(status as typeof PIPELINE_STEPS[number])

      if (fromIdx >= 0) {
        await tx.demandPhasePlan.upsert({
          where: { demandId_phase: { demandId: id, phase: demand.status } },
          create: { demandId: id, phase: demand.status, actualEnd: now },
          update: { actualEnd: now },
        })
      }
      if (toIdx >= 0) {
        await tx.demandPhasePlan.upsert({
          where: { demandId_phase: { demandId: id, phase: status as DemandStatus } },
          create: { demandId: id, phase: status as DemandStatus, actualStart: now },
          update: { actualStart: now },
        })
      }

      // SP wallet: commit on entering DEVELOPING, finalize on CLOSED
      const sp = demand.confirmedSp ?? demand.estimatedSp
      const year = now.getFullYear()
      const spIdx = PIPELINE_STEPS.indexOf("SP_REVIEW")
      const devIdx = PIPELINE_STEPS.indexOf("DEVELOPING")
      const closedIdx = PIPELINE_STEPS.indexOf("CLOSED")

      const wasCommitted = fromIdx >= devIdx && fromIdx < closedIdx  // was in DEVELOPING..ACCEPTANCE
      const willBeCommitted = toIdx >= devIdx && toIdx < closedIdx
      const wasClosed = fromIdx === closedIdx
      const willBeClosed = toIdx === closedIdx

      // Forward: entering committed zone (DEVELOPING..ACCEPTANCE)
      if (!wasCommitted && !wasClosed && willBeCommitted) {
        await tx.spWallet.upsert({
          where: { organizationId_year: { organizationId: demand.organizationId, year } },
          create: { organizationId: demand.organizationId, year, totalQuota: 0, committedSp: sp },
          update: { committedSp: { increment: sp } },
        })
      }

      // Forward: entering CLOSED from committed zone → move committed to used
      if (wasCommitted && willBeClosed) {
        await tx.spWallet.upsert({
          where: { organizationId_year: { organizationId: demand.organizationId, year } },
          create: { organizationId: demand.organizationId, year, totalQuota: 0, usedSp: sp },
          update: { committedSp: { decrement: sp }, usedSp: { increment: sp } },
        })
      }

      // Forward: entering CLOSED from before committed zone → only add to used
      if (!wasCommitted && !wasClosed && willBeClosed) {
        await tx.spWallet.upsert({
          where: { organizationId_year: { organizationId: demand.organizationId, year } },
          create: { organizationId: demand.organizationId, year, totalQuota: 0, usedSp: sp },
          update: { usedSp: { increment: sp } },
        })
      }

      // Backward: leaving committed zone to before DEVELOPING
      if (wasCommitted && !willBeCommitted && !willBeClosed) {
        await tx.spWallet.update({
          where: { organizationId_year: { organizationId: demand.organizationId, year } },
          data: { committedSp: { decrement: sp } },
        }).catch(() => {})
      }

      // Backward: from CLOSED back to committed zone
      if (wasClosed && willBeCommitted) {
        await tx.spWallet.update({
          where: { organizationId_year: { organizationId: demand.organizationId, year } },
          data: { usedSp: { decrement: sp }, committedSp: { increment: sp } },
        }).catch(() => {})
      }

      // Backward: from CLOSED back to before committed zone
      if (wasClosed && !willBeCommitted && !willBeClosed) {
        await tx.spWallet.update({
          where: { organizationId_year: { organizationId: demand.organizationId, year } },
          data: { usedSp: { decrement: sp } },
        }).catch(() => {})
      }

      // Force-advance: mark pending sign-off as SKIPPED
      if (isForward && body.forceAdvance && signoffPhases.includes(demand.status)) {
        await tx.phaseSignoff.updateMany({
          where: {
            demandId: id,
            phase: demand.status as DemandStatus,
            status: "PENDING",
          },
          data: {
            status: "SKIPPED",
            respondedAt: now,
            respondedById: auth.userId,
            comment: body.forceComment || "管理者略過簽核",
          },
        })
      }

      // Auto-create sign-off for the target phase if required (forward only)
      if (isForward && signoffPhases.includes(status)) {
        await tx.phaseSignoff.create({
          data: {
            demandId: id,
            phase: status as DemandStatus,
            status: "PENDING",
            requestedById: auth.userId,
          },
        })
      }

      return d
    })

    return NextResponse.json({ demand: { id: updated.id, status: updated.status } })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update demand error:", error)
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
