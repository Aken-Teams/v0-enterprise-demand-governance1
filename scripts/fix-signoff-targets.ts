/**
 * One-time fix: re-target PENDING signoffs to match current contactPerson / demandManager.
 *
 * Usage:  npx tsx scripts/fix-signoff-targets.ts
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  // Fetch all PENDING signoffs with REQUESTER or MANAGER role
  const pendingSignoffs = await prisma.phaseSignoff.findMany({
    where: {
      status: "PENDING",
      targetRole: { in: ["REQUESTER", "MANAGER"] },
    },
    select: {
      id: true,
      targetRole: true,
      targetUserId: true,
      demand: {
        select: {
          demandNumber: true,
          contactPersonId: true,
          demandManagerId: true,
          contactPerson_: { select: { name: true } },
          demandManager: { select: { name: true } },
        },
      },
    },
  })

  console.log(`Found ${pendingSignoffs.length} pending REQUESTER/MANAGER signoffs\n`)

  let fixed = 0
  for (const s of pendingSignoffs) {
    const correctUserId =
      s.targetRole === "REQUESTER"
        ? s.demand.contactPersonId
        : s.demand.demandManagerId

    if (s.targetUserId === correctUserId) continue

    const oldId = s.targetUserId || "(null)"
    const newId = correctUserId || "(null)"
    const newName =
      s.targetRole === "REQUESTER"
        ? s.demand.contactPerson_?.name
        : s.demand.demandManager?.name

    console.log(
      `[${s.demand.demandNumber}] ${s.targetRole} signoff ${s.id}: ${oldId} → ${newId} (${newName || "無"})`
    )

    await prisma.phaseSignoff.update({
      where: { id: s.id },
      data: { targetUserId: correctUserId },
    })
    fixed++
  }

  console.log(`\nDone. Fixed ${fixed} signoffs.`)
  await prisma.$disconnect()
}

main()
