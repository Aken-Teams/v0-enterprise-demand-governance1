import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { canAccessDemand } from "@/lib/demand-access"

const JWT_SECRET = process.env.JWT_SECRET || "REDACTED-SECRET-ROTATED"

// POST: Login via share page (validates share token + user credentials + demand access)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "請輸入帳號和密碼" }, { status: 400 })
    }

    // Validate share token
    const share = await prisma.demandShare.findUnique({
      where: { token },
    })

    if (!share) {
      return NextResponse.json({ error: "分享連結不存在" }, { status: 404 })
    }

    if (share.expiresAt < new Date()) {
      return NextResponse.json({ error: "分享連結已過期" }, { status: 410 })
    }

    // Authenticate user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    })

    if (!user) {
      return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "此帳號已停用" }, { status: 403 })
    }

    // Authentication: LDAP-first for AD-bound users, then local bcrypt fallback
    let authenticated = false

    if (user.ldapUsername) {
      try {
        const adUrl = process.env.AD_URL
        const adApi = process.env.AD_API
        if (adUrl && adApi) {
          const ldapRes = await fetch(`${adUrl}/api/v1/ldap/auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": adApi },
            body: JSON.stringify({ username: user.ldapUsername, password, domain: user.ldapDomain || "PANJIT" }),
          })
          const ldapData = await ldapRes.json().catch(() => ({}))
          if (ldapRes.ok && ldapData.success) {
            authenticated = true
          }
        }
      } catch {
        // LDAP unavailable — fall through to local password
      }
    }

    if (!authenticated && user.password) {
      authenticated = await bcrypt.compare(password, user.password)
    }

    if (!authenticated) {
      return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 })
    }

    // Check demand access
    const demand = await prisma.demand.findUnique({
      where: { id: share.demandId },
      select: { id: true, organizationId: true, developerId: true },
    })

    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const hasAccess = await canAccessDemand(
      { userId: user.id, role: user.role, adminScopeType: user.adminScopeType },
      demand,
    )

    if (!hasAccess) {
      return NextResponse.json({ error: "您的帳號無權存取此需求" }, { status: 403 })
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    )

    return NextResponse.json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subsidiary: user.organization?.name,
        organizationId: user.organizationId,
        isOrgAccount: user.isOrgAccount,
      },
    })
  } catch (error) {
    console.error("Share auth error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
