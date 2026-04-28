import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// GET: 列出所有 API 金鑰
export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const keys = await prisma.apiKey.findMany({
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      apiKeys: keys.map((k) => ({
        id: k.id,
        prefix: k.prefix,
        name: k.name,
        createdBy: k.createdBy,
        createdAt: k.createdAt.toISOString(),
        revokedAt: k.revokedAt?.toISOString() || null,
        lastUsedAt: k.lastUsedAt?.toISOString() || null,
        isActive: !k.revokedAt,
      })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin list API keys error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// POST: 建立新 API 金鑰
export async function POST(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "請提供金鑰名稱" }, { status: 400 })
    }

    // Generate key: gvk_ prefix + 36 random bytes base64url
    const rawKey = `gvk_${randomBytes(36).toString("base64url")}`
    const keyHash = createHash("sha256").update(rawKey).digest("hex")
    const prefix = rawKey.slice(0, 8)

    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        prefix,
        name: name.trim(),
        createdById: auth.userId,
      },
    })

    logAudit({
      userId: auth.userId,
      action: "CREATE",
      entity: "API_KEY",
      entityId: apiKey.id,
      details: { name: apiKey.name, prefix },
      request,
    })

    // Return raw key ONCE — cannot be retrieved again
    return NextResponse.json({
      id: apiKey.id,
      key: rawKey,
      prefix: apiKey.prefix,
      name: apiKey.name,
      createdAt: apiKey.createdAt.toISOString(),
    }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin create API key error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
