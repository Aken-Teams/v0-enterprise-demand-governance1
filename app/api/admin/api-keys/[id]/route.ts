import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// DELETE: 撤銷 API 金鑰 (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)
    const { id } = await params

    const apiKey = await prisma.apiKey.findUnique({ where: { id } })
    if (!apiKey) {
      return NextResponse.json({ error: "金鑰不存在" }, { status: 404 })
    }
    if (apiKey.revokedAt) {
      return NextResponse.json({ error: "金鑰已撤銷" }, { status: 400 })
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })

    logAudit({
      userId: auth.userId,
      action: "REVOKE",
      entity: "API_KEY",
      entityId: id,
      details: { name: apiKey.name, prefix: apiKey.prefix },
      request,
    })

    return NextResponse.json({ message: "金鑰已撤銷" })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin revoke API key error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
