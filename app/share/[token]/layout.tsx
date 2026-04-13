import type React from "react"
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const share = await prisma.demandShare.findUnique({
    where: { token },
    select: { demand: { select: { title: true, demandNumber: true } } },
  })

  if (!share) {
    return { title: "需求分享 — JV 需求管理平台" }
  }

  const title = `${share.demand.demandNumber} ${share.demand.title} — JV 需求管理平台`
  return {
    title,
    openGraph: { title },
  }
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
