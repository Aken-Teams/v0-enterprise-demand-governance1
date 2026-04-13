import { NextRequest, NextResponse } from "next/server"
import { verifyRole, AuthError } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    verifyRole(request, ["admin"])

    const username = request.nextUrl.searchParams.get("username")
    if (!username) {
      return NextResponse.json({ error: "缺少 username 參數" }, { status: 400 })
    }

    const baseUrl = process.env.AD_URL
    const apiKey = process.env.AD_API
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: "LDAP 環境變數未設定 (AD_URL / AD_API)" }, { status: 500 })
    }

    const domain = request.nextUrl.searchParams.get("domain")
    const qs = domain ? `?domain=${encodeURIComponent(domain)}` : ""
    const url = `${baseUrl}/api/v1/ldap/users/${encodeURIComponent(username)}${qs}`
    const upstream = await fetch(url, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    })

    const text = await upstream.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: "LDAP API 回應格式錯誤", detail: text.slice(0, 500) },
        { status: 502 },
      )
    }

    if (!upstream.ok) {
      const detail = (data as { detail?: string })?.detail ?? "上游 LDAP API 請求失敗"
      return NextResponse.json({ error: detail }, { status: upstream.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("LDAP user lookup error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
