import * as dotenv from "dotenv"
dotenv.config({ path: ".env" })

import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const d = await prisma.demand.findFirst({
    where: { title: { contains: "看板" } },
    select: { demandNumber: true, title: true, description: true },
  })
  if (d) {
    console.log("=== " + d.demandNumber + ": " + d.title + " ===")
    const lines = d.description.split("\n")
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const line = lines[i]
      if (line.includes("span") || line.includes("FFF3CD") || line.includes("FFE0E0") || line.includes("&lt;") || line.includes("底色")) {
        console.log(`Line ${i}: ${JSON.stringify(line)}`)
      }
    }
    console.log("\n--- Checks ---")
    if (d.description.includes("&lt;")) console.log("FOUND: &lt; (HTML entities)")
    if (d.description.includes("&gt;")) console.log("FOUND: &gt; (HTML entities)")
    if (d.description.includes("<span")) console.log("FOUND: <span (raw HTML)")
    if (d.description.includes("\\<span")) console.log("FOUND: \\<span (escaped)")
  } else {
    console.log("No demand found with 看板")
    // Try any demand with span
    const d2 = await prisma.demand.findFirst({
      where: { description: { contains: "FFF3CD" } },
      select: { demandNumber: true, title: true, description: true },
    })
    if (d2) {
      console.log("Found via FFF3CD: " + d2.demandNumber)
      const lines = d2.description.split("\n")
      for (const line of lines) {
        if (line.includes("FFF3CD") || line.includes("span")) {
          console.log("RAW: " + JSON.stringify(line))
        }
      }
    } else {
      console.log("No demand with FFF3CD either")
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
