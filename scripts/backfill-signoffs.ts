/**
 * Backfill missing signoff records for demands that already passed signoff phases.
 * Specifically for REQ-2026-003 which has no signoff records.
 *
 * Usage: npx tsx scripts/backfill-signoffs.ts
 */

import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import "dotenv/config"

/**
 * Signoff phases and the roles required at each phase.
 * PRD_REVIEW: REQUESTER + MANAGER
 * SP_REVIEW: BOARD
 * ACCEPTANCE: REQUESTER + MANAGER
 */
const PHASE_SIGNOFF_ROLES: Record<string, string[]> = {
  PRD_REVIEW: ["REQUESTER", "MANAGER"],
  SP_REVIEW: ["BOARD"],
  ACCEPTANCE: ["REQUESTER", "MANAGER"],
}

/** Pipeline order for comparison */
const PIPELINE_ORDER = [
  "SUBMITTED",
  "PRD_REVIEW",
  "SP_REVIEW",
  "DEVELOPING",
  "ACCEPTANCE",
  "CLOSED",
]

function phaseIndex(phase: string): number {
  return PIPELINE_ORDER.indexOf(phase)
}

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
  const prisma = new PrismaClient({ adapter })

  try {
    // Find the user 戴雯珮
    const user = await prisma.user.findFirst({
      where: { name: { contains: "戴雯珮" } },
    })

    if (!user) {
      console.error("❌ 找不到使用者「戴雯珮」")
      return
    }
    console.log(`✅ 找到使用者: ${user.name} (${user.id})`)

    // Find REQ-2026-003
    const demand = await prisma.demand.findFirst({
      where: { demandNumber: "REQ-2026-003" },
      include: {
        phaseSignoffs: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    })

    if (!demand) {
      console.error("❌ 找不到需求 REQ-2026-003")
      return
    }
    console.log(`✅ 找到需求: ${demand.demandNumber} - ${demand.title}`)
    console.log(`   目前狀態: ${demand.status}`)
    console.log(`   現有簽核紀錄: ${demand.phaseSignoffs.length} 筆`)

    if (demand.phaseSignoffs.length > 0) {
      console.log("⚠️  此需求已有簽核紀錄，跳過：")
      for (const s of demand.phaseSignoffs) {
        console.log(`   - ${s.phase} / ${s.targetRole} / ${s.status}`)
      }
      return
    }

    const currentPhaseIdx = phaseIndex(demand.status)
    const signoffsToCreate: {
      phase: string
      role: string
      respondedAt: Date
    }[] = []

    // Determine which phases this demand has already passed
    for (const [phase, roles] of Object.entries(PHASE_SIGNOFF_ROLES)) {
      const pIdx = phaseIndex(phase)
      if (pIdx < currentPhaseIdx) {
        // This phase has been passed — need approved signoffs
        // Find the timestamp when demand moved past this phase
        const historyEntry = demand.statusHistory.find(
          (h: { toStatus: string }) => phaseIndex(h.toStatus) > pIdx
        )
        const respondedAt = historyEntry
          ? new Date((historyEntry as { createdAt: Date }).createdAt)
          : new Date(demand.createdAt)

        for (const role of roles) {
          signoffsToCreate.push({ phase, role, respondedAt })
        }
      }
    }

    if (signoffsToCreate.length === 0) {
      console.log("ℹ️  無需補建簽核紀錄")
      return
    }

    console.log(`\n📝 準備補建 ${signoffsToCreate.length} 筆簽核紀錄：`)
    for (const s of signoffsToCreate) {
      console.log(`   - ${s.phase} / ${s.role} → APPROVED (${s.respondedAt.toISOString()})`)
    }

    // Create all signoff records
    for (const s of signoffsToCreate) {
      await prisma.phaseSignoff.create({
        data: {
          demandId: demand.id,
          phase: s.phase as "PRD_REVIEW" | "SP_REVIEW" | "ACCEPTANCE",
          kind: "PHASE",
          status: "APPROVED",
          targetRole: s.role,
          targetUserId: user.id,
          requestedById: user.id,
          respondedById: user.id,
          requestedAt: s.respondedAt,
          respondedAt: s.respondedAt,
          comment: "系統補建簽核紀錄",
        },
      })
      console.log(`   ✅ ${s.phase} / ${s.role} 已建立`)
    }

    console.log(`\n✅ 完成！共補建 ${signoffsToCreate.length} 筆簽核紀錄`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
