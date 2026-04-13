import { NextRequest, NextResponse } from "next/server"
import { verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"

/** Supported LDAP domains (maps to the upstream LDAP API `domain` parameter) */
export const LDAP_DOMAINS = ["PANJIT", "PYNMAX", "WXPJ", "GDPJ", "PJWS", "PJXZ", "PJSD"] as const
type LdapDomain = (typeof LDAP_DOMAINS)[number]

/** Mapping from LDAP domain code → 中文名稱（顯示用） */
export const LDAP_DOMAIN_LABELS: Record<LdapDomain, string> = {
  PANJIT: "強茂",
  PYNMAX: "璟茂",
  WXPJ: "無錫強茂",
  GDPJ: "蘇州群鑫",
  PJWS: "強茂深圳",
  PJXZ: "強茂徐州",
  PJSD: "山東強茂",
}

// In-memory cache (org tree changes rarely, avoid hammering LDAP)
type CacheEntry = { data: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const domain = request.nextUrl.searchParams.get("domain") || "PANJIT"
    if (!LDAP_DOMAINS.includes(domain as LdapDomain)) {
      return NextResponse.json({ error: `不支援的 domain: ${domain}` }, { status: 400 })
    }

    const baseUrl = process.env.AD_URL
    const apiKey = process.env.AD_API
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: "LDAP 環境變數未設定 (AD_URL / AD_API)" }, { status: 500 })
    }

    // Check cache
    const cacheKey = `tree:${domain}`
    const now = Date.now()
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.data)
    }

    // Upstream fetch
    const url = `${baseUrl}/api/v1/ldap/organizations/tree?domain=${encodeURIComponent(domain)}`
    const upstream = await fetch(url, {
      headers: { "X-API-Key": apiKey },
      // LDAP queries can be slow; don't let Next.js cache upstream
      cache: "no-store",
    })

    const text = await upstream.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: "LDAP API 回應格式錯誤", detail: text.slice(0, 500) },
        { status: 502 }
      )
    }

    if (!upstream.ok) {
      const detail = (data as { detail?: string })?.detail ?? "上游 LDAP API 請求失敗"
      return NextResponse.json({ error: detail, domain }, { status: upstream.status })
    }

    cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_MS })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("LDAP tree error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
