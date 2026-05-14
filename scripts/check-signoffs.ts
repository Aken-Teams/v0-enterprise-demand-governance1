import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const d = await prisma.demand.findFirst({
    where: { demandNumber: "REQ-2026-014" },
    select: { id: true, status: true, title: true },
  })
  if (!d) { console.log("Not found"); return }
  console.log(`=== ${d.title} ===`)
  console.log(`Status: ${d.status}`)

  const signoffs = await prisma.phaseSignoff.findMany({
    where: { demandId: d.id },
    select: { phase: true, status: true, kind: true, targetRole: true, requestedAt: true },
    orderBy: { requestedAt: "desc" },
  })

  console.log(`\nAll signoffs (${signoffs.length}):`)
  for (const s of signoffs) {
    console.log(`  phase=${s.phase} kind=${s.kind} status=${s.status} role=${s.targetRole} at=${s.requestedAt.toISOString()}`)
  }

  // Simulate API logic
  const phaseSignoffs = signoffs.filter(s => s.kind === "PHASE" && s.phase === d.status)
  console.log(`\nPhase signoffs for current status (${d.status}): ${phaseSignoffs.length}`)
  if (phaseSignoffs.length > 0) {
    const latestRoundTime = Math.max(...phaseSignoffs.map(s => new Date(s.requestedAt).getTime()))
    const latestRound = phaseSignoffs.filter(s => new Date(s.requestedAt).getTime() === latestRoundTime)
    console.log(`Latest round (${latestRound.length}):`)
    for (const s of latestRound) {
      console.log(`  status=${s.status} role=${s.targetRole}`)
    }
    const approved = latestRound.length > 0 && latestRound.every(s => s.status === "APPROVED" || s.status === "SKIPPED") && latestRound.some(s => s.status === "APPROVED")
    console.log(`hasCurrentPhaseApproved: ${approved}`)
  } else {
    console.log("No phase signoffs found for current status!")
  }

  await prisma.$disconnect()
}
main()
