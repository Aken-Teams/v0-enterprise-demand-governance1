import * as dotenv from "dotenv"
dotenv.config({ path: ".env" })

import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const d = await prisma.demand.findFirst({
    where: { demandNumber: "REQ-2026-013" },
    include: {
      phasePlans: { orderBy: { phase: "asc" } },
      subTasks: true,
    },
  })

  if (!d) { console.log("Not found"); return }

  console.log(`=== ${d.demandNumber}: ${d.title} ===`)
  console.log(`狀態: ${d.status}`)
  console.log(`初估 SP: ${d.estimatedSp}`)
  console.log(`確認 SP: ${d.confirmedSp}`)
  console.log(`有效 SP: ${d.confirmedSp ?? d.estimatedSp}`)
  console.log("")

  if (d.phasePlans.length) {
    console.log("--- 階段 SP 規劃 ---")
    let planTotal = 0
    for (const p of d.phasePlans) {
      console.log(`  ${p.phase}: ${p.spPoints} SP ${p.description ? "(" + p.description + ")" : ""}`)
      planTotal += p.spPoints || 0
    }
    console.log(`  階段合計: ${planTotal} SP`)
  }

  if (d.subTasks.length) {
    console.log("")
    console.log("--- 子任務 ---")
    let taskTotal = 0
    for (const t of d.subTasks) {
      console.log(`  ${t.title}: ${t.estimatedSp || 0} SP (${t.status})`)
      taskTotal += t.estimatedSp || 0
    }
    console.log(`  子任務合計: ${taskTotal} SP`)
  }

  console.log("")
  const effectiveSp = d.confirmedSp ?? d.estimatedSp
  const planTotal = d.phasePlans.reduce((s, p) => s + (p.spPoints || 0), 0)
  const taskTotal = d.subTasks.reduce((s, t) => s + (t.estimatedSp || 0), 0)
  console.log(`=== 差異 ===`)
  console.log(`有效 SP (${effectiveSp}) vs 階段合計 (${planTotal}): 差 ${effectiveSp - planTotal}`)
  console.log(`有效 SP (${effectiveSp}) vs 子任務合計 (${taskTotal}): 差 ${effectiveSp - taskTotal}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
