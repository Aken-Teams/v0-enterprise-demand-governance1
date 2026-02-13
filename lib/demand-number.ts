import { prisma } from "@/lib/prisma"

export async function generateDemandNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `REQ-${year}-`

  const lastDemand = await prisma.demand.findFirst({
    where: {
      demandNumber: { startsWith: prefix },
    },
    orderBy: { demandNumber: "desc" },
    select: { demandNumber: true },
  })

  let nextSeq = 1
  if (lastDemand) {
    const lastSeq = parseInt(lastDemand.demandNumber.split("-")[2], 10)
    nextSeq = lastSeq + 1
  }

  return `${prefix}${String(nextSeq).padStart(3, "0")}`
}
