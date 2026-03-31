/**
 * One-time script to recalculate SP wallet usedSp values
 * based on the new progressive consumption model.
 *
 * Usage: npx tsx scripts/recalc-wallets.ts
 */

import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import "dotenv/config"

const SP_PROGRESS_RATE: Record<string, number> = {
  SUBMITTED: 0.5,
  PRD_REVIEW: 0.8,
  SP_REVIEW: 0.8,
  DEVELOPING: 0.8,
  ACCEPTANCE: 0.8,
  CLOSED: 1.0,
}

function calcUsedSp(status: string, effectiveSp: number): number {
  if (status === "REJECTED") return 0
  const rate = SP_PROGRESS_RATE[status] ?? 0
  return Math.round(effectiveSp * rate)
}

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
  const prisma = new PrismaClient({ adapter })

  try {
    const currentYear = new Date().getFullYear()

    // Get all wallets
    const wallets = await prisma.spWallet.findMany({
      where: { year: currentYear },
    })

    console.log(`Found ${wallets.length} wallets for year ${currentYear}`)

    for (const wallet of wallets) {
      // Get all non-rejected demands for this org
      const demands = await prisma.demand.findMany({
        where: {
          organizationId: wallet.organizationId,
          status: { not: "REJECTED" },
        },
        select: { status: true, estimatedSp: true, confirmedSp: true },
      })

      const usedSp = demands.reduce((sum, d) => {
        const sp = d.confirmedSp ?? d.estimatedSp
        return sum + calcUsedSp(d.status, sp)
      }, 0)

      await prisma.spWallet.update({
        where: { id: wallet.id },
        data: { usedSp, committedSp: 0 },
      })

      console.log(
        `  Org ${wallet.organizationId}: usedSp ${wallet.usedSp} → ${usedSp}, committedSp → 0 (${demands.length} demands)`
      )
    }

    console.log("Done!")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
