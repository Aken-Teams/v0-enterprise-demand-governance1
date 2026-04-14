/**
 * One-time fix: remove duplicate PENDING signoffs (same demand + phase + targetUserId).
 * Keeps the latest one, deletes older duplicates.
 *
 * Usage:  npx tsx scripts/fix-dup-signoffs.ts
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const pending = await prisma.phaseSignoff.findMany({
    where: { status: "PENDING", targetUserId: { not: null } },
    select: {
      id: true,
      demandId: true,
      phase: true,
      targetUserId: true,
      targetRole: true,
      requestedAt: true,
      demand: { select: { demandNumber: true } },
    },
    orderBy: { requestedAt: "asc" },
  })

  console.log(`Total PENDING signoffs with targetUserId: ${pending.length}`)

  // Group by demandId + phase + targetUserId
  const groups = new Map<string, typeof pending>()
  for (const s of pending) {
    const key = `${s.demandId}|${s.phase}|${s.targetUserId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  let deleted = 0
  for (const [, items] of groups) {
    if (items.length <= 1) continue

    console.log(
      `\nDuplicate: ${items[0].demand.demandNumber} | ${items[0].phase} | ${items[0].targetRole}`
    )
    for (const s of items) {
      console.log(`  - ${s.id} (${s.requestedAt.toISOString()})`)
    }

    // Keep the latest, delete older ones
    const toDelete = items.slice(0, -1)
    for (const s of toDelete) {
      console.log(`  >> Deleting: ${s.id}`)
      await prisma.phaseSignoff.delete({ where: { id: s.id } })
      deleted++
    }
  }

  console.log(`\nDone. Deleted ${deleted} duplicate signoffs.`)
  await prisma.$disconnect()
}

main()
