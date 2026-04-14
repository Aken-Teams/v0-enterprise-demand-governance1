/**
 * Fix stale board member signoffs:
 * Remove PENDING SP_REVIEW signoffs where the board member has
 * restrictBoardToOrg=true but their organization doesn't match the demand's organization.
 *
 * Usage: npx tsx scripts/fix-board-signoffs.ts
 *        npx tsx scripts/fix-board-signoffs.ts --dry-run
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const adapter = new PrismaMariaDb(process.env.MARIADB_URL!)
const prisma = new PrismaClient({ adapter })
const dryRun = process.argv.includes("--dry-run")

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== EXECUTING ===")

  // Find all PENDING SP_REVIEW signoffs with a target user
  const pendingSignoffs = await prisma.phaseSignoff.findMany({
    where: {
      phase: "SP_REVIEW",
      status: "PENDING",
      targetUserId: { not: null },
    },
    include: {
      demand: { select: { id: true, demandNumber: true, title: true, organizationId: true, organization: { select: { name: true } } } },
      targetUser: { select: { id: true, name: true, restrictBoardToOrg: true, organizationId: true, organization: { select: { name: true } } } },
    },
  })

  console.log(`Found ${pendingSignoffs.length} PENDING SP_REVIEW signoffs`)

  const toDelete: string[] = []

  for (const s of pendingSignoffs) {
    if (!s.targetUser) continue
    if (!s.targetUser.restrictBoardToOrg) continue // no restriction, keep

    if (s.targetUser.organizationId !== s.demand.organizationId) {
      console.log(
        `  DELETE: ${s.targetUser.name} (org: ${s.targetUser.organization?.name || "N/A"})` +
        ` → demand ${s.demand.demandNumber}「${s.demand.title}」(org: ${s.demand.organization?.name || "N/A"})` +
        ` [signoff ${s.id}]`
      )
      toDelete.push(s.id)
    }
  }

  if (toDelete.length === 0) {
    console.log("\nNo stale signoffs found. All good!")
    return
  }

  console.log(`\n${toDelete.length} signoffs to delete`)

  if (!dryRun) {
    const result = await prisma.phaseSignoff.deleteMany({
      where: { id: { in: toDelete } },
    })
    console.log(`Deleted ${result.count} signoffs`)
  } else {
    console.log("(dry run — no changes made)")
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
