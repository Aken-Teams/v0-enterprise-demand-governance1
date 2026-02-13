import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { batchUpsertPhasePlansSchema } from "@/lib/validations/phase-plan"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { PIPELINE_STEPS } from "@/lib/constants/demand"

// GET: Return all phase plans for a demand (auto-create if none exist)
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

    let phasePlans = await prisma.demandPhasePlan.findMany({
      where: { demandId: id },
      include: {
        engineer: { select: { id: true, name: true } },
        pm: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    // Auto-create empty stubs if none exist
    if (phasePlans.length === 0) {
      await prisma.$transaction(
        PIPELINE_STEPS.map((phase) =>
          prisma.demandPhasePlan.create({
            data: { demandId: id, phase: phase as DemandStatus },
          })
        )
      )
      phasePlans = await prisma.demandPhasePlan.findMany({
        where: { demandId: id },
        include: {
          engineer: { select: { id: true, name: true } },
          pm: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    }

    // Sort by pipeline step order
    const stepOrder = Object.fromEntries(
      PIPELINE_STEPS.map((s, i) => [s, i])
    )
    phasePlans.sort((a, b) => (stepOrder[a.phase] ?? 99) - (stepOrder[b.phase] ?? 99))

    return NextResponse.json({ phasePlans })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Get phase plans error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PUT: Batch upsert phase plans
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    verifyRole(request, ["admin", "delivery"])
    const { id } = await params
    const body = await request.json()

    const parseResult = batchUpsertPhasePlansSchema.safeParse(body)
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

    const { phases } = parseResult.data

    await prisma.$transaction(
      phases.map((p) =>
        prisma.demandPhasePlan.upsert({
          where: { demandId_phase: { demandId: id, phase: p.phase as DemandStatus } },
          create: {
            demandId: id,
            phase: p.phase as DemandStatus,
            plannedSp: p.plannedSp ?? null,
            plannedStart: p.plannedStart ?? null,
            plannedEnd: p.plannedEnd ?? null,
            engineerId: p.engineerId ?? null,
            pmId: p.pmId ?? null,
          },
          update: {
            plannedSp: p.plannedSp ?? null,
            plannedStart: p.plannedStart ?? null,
            plannedEnd: p.plannedEnd ?? null,
            engineerId: p.engineerId ?? null,
            pmId: p.pmId ?? null,
          },
        })
      )
    )

    const updated = await prisma.demandPhasePlan.findMany({
      where: { demandId: id },
      include: {
        engineer: { select: { id: true, name: true } },
        pm: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ phasePlans: updated })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update phase plans error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
