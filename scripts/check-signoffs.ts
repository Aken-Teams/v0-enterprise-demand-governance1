import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })
async function main() {
  const demands = await prisma.demand.findMany({
    where: { status: "PRD_REVIEW" },
    select: { id: true, demandNumber: true, contactPersonId: true, demandManagerId: true,
      contactPerson_: { select: { name: true } },
      demandManager: { select: { name: true } },
      phaseSignoffs: { select: { id: true, phase: true, status: true, targetUserId: true, targetRole: true, targetUser: { select: { name: true } } } }
    }
  })
  for (const d of demands) {
    console.log(`${d.demandNumber} | 窗口=${d.contactPerson_?.name || "無"} | 主管=${d.demandManager?.name || "無"}`)
    for (const s of d.phaseSignoffs) {
      console.log(`  ${s.phase} ${s.status} target=${s.targetUser?.name || "(none)"} role=${s.targetRole || "(none)"}`)
    }
  }
  await prisma.$disconnect()
}
main()
