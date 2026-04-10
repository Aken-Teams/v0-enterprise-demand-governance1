import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })
async function main() {
  // Get REQ-2026-026
  const demand = await prisma.demand.findFirst({
    where: { demandNumber: "REQ-2026-026" },
    select: { id: true, demandManagerId: true, demandManager: { select: { name: true } },
      phaseSignoffs: { where: { phase: "PRD_REVIEW" }, select: { id: true, requestedAt: true, requestedById: true } }
    }
  })
  if (!demand) { console.log("Demand not found"); return }
  console.log("Manager:", demand.demandManager?.name, demand.demandManagerId)
  console.log("Existing signoffs:", demand.phaseSignoffs.length)
  
  if (demand.demandManagerId && demand.phaseSignoffs.length > 0) {
    const existing = demand.phaseSignoffs[0]
    const created = await prisma.phaseSignoff.create({
      data: {
        demandId: demand.id,
        phase: "PRD_REVIEW",
        status: "PENDING",
        requestedById: existing.requestedById,
        targetUserId: demand.demandManagerId,
        targetRole: "MANAGER",
        requestedAt: existing.requestedAt, // same timestamp as existing round
      }
    })
    console.log("Created MANAGER signoff:", created.id)
  }
  await prisma.$disconnect()
}
main()
