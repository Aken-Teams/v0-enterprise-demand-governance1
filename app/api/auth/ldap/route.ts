import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/auth/ldap — LDAP authentication proxy (no JWT required)
 * Called during login to verify AD credentials before issuing a local JWT.
 */
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    if (!username || !password) {
      return NextResponse.json({ success: false, error: "缺少帳號或密碼" }, { status: 400 })
    }

    const baseUrl = process.env.AD_URL
    const apiKey = process.env.AD_API
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ success: false, error: "LDAP 環境變數未設定" }, { status: 500 })
    }

    const upstream = await fetch(`${baseUrl}/api/v1/ldap/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ username, password }),
    })

    const data = await upstream.json().catch(() => ({}))

    if (upstream.ok && data.success) {
      return NextResponse.json({ success: true, user: data.user })
    }

    return NextResponse.json(
      { success: false, error: data.message || "AD 驗證失敗" },
      { status: 401 },
    )
  } catch (error) {
    console.error("LDAP auth proxy error:", error)
    return NextResponse.json({ success: false, error: "伺服器錯誤" }, { status: 500 })
  }
}
