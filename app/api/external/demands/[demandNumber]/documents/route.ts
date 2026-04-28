import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyApiKey, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// GET: 用需求編號查詢該需求的所有文件（依階段分組）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ demandNumber: string }> }
) {
  try {
    const apiKey = await verifyApiKey(request)
    const { demandNumber } = await params

    const demand = await prisma.demand.findUnique({
      where: { demandNumber },
      select: {
        id: true,
        demandNumber: true,
        title: true,
        status: true,
        organization: { select: { code: true, name: true } },
        documents: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            phase: true,
            fileName: true,
            fileSize: true,
            fileUrl: true,
            createdAt: true,
          },
        },
      },
    })

    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Group documents by phase
    const documentsByPhase: Record<string, typeof demand.documents> = {}
    for (const doc of demand.documents) {
      const key = doc.phase || "UNASSIGNED"
      if (!documentsByPhase[key]) documentsByPhase[key] = []
      documentsByPhase[key].push({
        ...doc,
        // Mask internal file URLs - only expose doc ID for downloads
        fileUrl: doc.fileUrl?.startsWith("http") ? doc.fileUrl : null,
      })
    }

    logAudit({
      userId: apiKey.createdById,
      action: "API_READ",
      entity: "DEMAND",
      entityId: demand.id,
      demandId: demand.id,
      details: { apiKeyId: apiKey.apiKeyId, apiKeyName: apiKey.name, demandNumber },
      request,
    })

    return NextResponse.json({
      demand: {
        demandNumber: demand.demandNumber,
        title: demand.title,
        status: demand.status,
        organization: demand.organization,
      },
      documentsByPhase,
      documents: demand.documents.map((doc) => ({
        ...doc,
        fileUrl: doc.fileUrl?.startsWith("http") ? doc.fileUrl : null,
      })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("External documents API error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
