import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { logAudit } from "@/lib/audit"

const JWT_SECRET = process.env.JWT_SECRET || "REDACTED-SECRET-ROTATED"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "請輸入帳號和密碼" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: "帳號或密碼錯誤" },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "此帳號已停用" },
        { status: 403 }
      )
    }

    // Authentication: LDAP-first for AD-bound users, then local bcrypt fallback
    let authenticated = false

    if (user.ldapUsername) {
      // Try LDAP auth first
      try {
        const adUrl = process.env.AD_URL
        const adApi = process.env.AD_API
        if (adUrl && adApi) {
          const ldapRes = await fetch(`${adUrl}/api/v1/ldap/auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": adApi },
            body: JSON.stringify({ username: user.ldapUsername, password }),
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

    // Fallback: local bcrypt password (if set)
    if (!authenticated && user.password) {
      authenticated = await bcrypt.compare(password, user.password)
    }

    if (!authenticated) {
      return NextResponse.json(
        { error: "帳號或密碼錯誤" },
        { status: 401 }
      )
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        adminScopeType: user.role === "admin" ? (user.adminScopeType || "all") : undefined,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    )

    // Check if subsidiary user has restricted demand visibility
    let restrictedView = false
    if (user.role === "subsidiary") {
      const accessCount = await prisma.demandAccess.count({
        where: { userId: user.id },
      })
      restrictedView = accessCount > 0
    }

    logAudit({
      userId: user.id,
      action: "LOGIN",
      entity: "USER",
      entityId: user.id,
      details: { name: user.name, email: user.email, role: user.role, organization: user.organization?.name || null },
      request,
    })

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subsidiary: user.organization?.name,
        organizationId: user.organizationId,
        restrictedView,
        isOrgAccount: user.isOrgAccount,
        adminScopeType: user.role === "admin" ? (user.adminScopeType || "all") : undefined,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "伺服器錯誤，請稍後再試" },
      { status: 500 }
    )
  }
}
