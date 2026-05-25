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
  SUBMITTED: 0,
  PRD_REVIEW: 0,
  SP_REVIEW: 0,
  DEVELOPING: 0.5,
  ACCEPTANCE: 0.75,
  CLOSED: 1.0,
}

function calcUsedSpRaw(status: string, effectiveSp: number, heldFromStatus?: string | null): number {
  let effectiveStatus = status
  if (status === "ON_HOLD" || status === "REJECTED") {
    effectiveStatus = heldFromStatus || status
  }
  const rate = SP_PROGRESS_RATE[effectiveStatus] ?? 0
  return effectiveSp * rate
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
      // Get all demands for this org (ON_HOLD/REJECTED still consume SP)
      const demands = await prisma.demand.findMany({
        where: {
          organizationId: wallet.organizationId,
        },
        select: { status: true, estimatedSp: true, confirmedSp: true, heldFromStatus: true },
      })

      const usedSp = Math.round(demands.reduce((sum, d) => {
        const sp = d.confirmedSp ?? d.estimatedSp
        return sum + calcUsedSpRaw(d.status, sp, d.heldFromStatus)
      }, 0))

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
