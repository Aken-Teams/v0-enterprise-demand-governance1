"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Building2, Settings, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/hooks/use-auth"

type LoginType = "company" | "admin"

interface AccountUser {
  id: string
  name: string
  email: string
  role?: string
}

interface OrgWithUsers {
  id: string
  name: string
  users: AccountUser[]
}

const ADMIN_ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  delivery: "交付團隊",
  viewer: "董事會",
}

const ROLE_ROUTES: Record<string, string> = {
  admin: "/governance/inbox",
  delivery: "/delivery",
  subsidiary: "/subsidiary",
  viewer: "/governance/inbox",
}

export default function HomePage() {
  const router = useRouter()
  const { login } = useAuth()
  const [loginType, setLoginType] = useState<LoginType>("company")
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [dataLoading, setDataLoading] = useState(true)

  // Dynamic data from API
  const [organizations, setOrganizations] = useState<OrgWithUsers[]>([])
  const [adminUsers, setAdminUsers] = useState<AccountUser[]>([])

  // Company login state
  const [selectedOrgId, setSelectedOrgId] = useState("")
  const [selectedAccountEmail, setSelectedAccountEmail] = useState("")

  // Admin login state
  const [selectedAdminRole, setSelectedAdminRole] = useState("admin")
  const [selectedAdminEmail, setSelectedAdminEmail] = useState("")

  // Fetch accounts on mount
  useEffect(() => {
    fetch("/api/auth/accounts")
      .then((res) => res.json())
      .then((data) => {
        if (data.organizations) {
          setOrganizations(data.organizations)
          if (data.organizations.length > 0) {
            setSelectedOrgId(data.organizations[0].id)
          }
        }
        if (data.adminUsers) {
          setAdminUsers(data.adminUsers)
        }
      })
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }, [])

  // Auto-select first account when org changes
  useEffect(() => {
    const org = organizations.find((o) => o.id === selectedOrgId)
    if (org && org.users.length > 0) {
      setSelectedAccountEmail(org.users[0].email)
    } else {
      setSelectedAccountEmail("")
    }
  }, [selectedOrgId, organizations])

  // Auto-select first account when admin role changes
  useEffect(() => {
    const users = adminUsers.filter((u) => u.role === selectedAdminRole)
    if (users.length > 0) {
      setSelectedAdminEmail(users[0].email)
    } else {
      setSelectedAdminEmail("")
    }
  }, [selectedAdminRole, adminUsers])

  // Derived data
  const currentOrg = organizations.find((o) => o.id === selectedOrgId)
  const orgUsers = currentOrg?.users || []
  const roleUsers = adminUsers.filter((u) => u.role === selectedAdminRole)
  const adminRoleOptions = [...new Set(adminUsers.map((u) => u.role || ""))]
    .filter(Boolean)
    .sort((a, b) => (a === "admin" ? -1 : b === "admin" ? 1 : 0))

  const currentEmail = loginType === "company" ? selectedAccountEmail : selectedAdminEmail

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEmail) return
    setIsLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentEmail, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "登入失敗")
        setIsLoading(false)
        return
      }

      login(data.user, data.token)
      router.push(ROLE_ROUTES[data.user.role] || "/subsidiary")
    } catch {
      setError("網路錯誤，請稍後再試")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600 shadow-md">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">JV 需求管理平台</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="mx-auto flex min-h-[calc(100vh-64px-73px)] max-w-7xl items-center px-6 py-8">
          <div className="grid w-full gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left - Animation */}
            <div className="hidden lg:flex items-center justify-center">
              <Image
                src="/Web-Development.gif"
                alt="Web Development"
                width={550}
                height={550}
                unoptimized
                priority
              />
            </div>

            {/* Right - Hero Text + Login */}
            <div>
              {/* Hero Text */}
              <div className="mb-8">
                <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
                  JV 需求管理平台
                </h1>
                <p className="text-base text-gray-500">需求提案 · 資源配置 · 開發追蹤 · 交付管控</p>
              </div>

              {/* Login Card */}
              <Card className="overflow-hidden shadow-xl">
                <>
                  {/* Login Type Toggle */}
                  <div className="border-b bg-gray-50 px-6 py-4">
                    <div className="flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginType("company")
                          setPassword("")
                          setError("")
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                          loginType === "company"
                            ? "bg-blue-500 text-white shadow-md"
                            : "bg-white text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Building2 className="h-4 w-4" />
                        <span>公司登入</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginType("admin")
                          setPassword("")
                          setError("")
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                          loginType === "admin"
                            ? "bg-orange-500 text-white shadow-md"
                            : "bg-white text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Settings className="h-4 w-4" />
                        <span>管理方登入</span>
                      </button>
                    </div>
                  </div>

                  {/* Login Form */}
                  <CardContent className="p-6">
                    {dataLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <form onSubmit={handleLogin} className="space-y-4">
                        {/* ===== Company Login ===== */}
                        {loginType === "company" && (
                          <>
                            {/* Select Organization */}
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                公司
                              </label>
                              <Select
                                value={selectedOrgId}
                                onValueChange={(value) => {
                                  setSelectedOrgId(value)
                                  setError("")
                                }}
                              >
                                <SelectTrigger className="h-11 w-full">
                                  <SelectValue placeholder="選擇公司" />
                                </SelectTrigger>
                                <SelectContent>
                                  {organizations.map((org) => (
                                    <SelectItem key={org.id} value={org.id}>
                                      {org.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Select Account */}
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                帳號
                              </label>
                              {orgUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">此公司尚無可用帳號</p>
                              ) : (
                                <Select
                                  value={selectedAccountEmail}
                                  onValueChange={(value) => {
                                    setSelectedAccountEmail(value)
                                    setError("")
                                  }}
                                >
                                  <SelectTrigger className="h-11 w-full">
                                    <SelectValue placeholder="選擇帳號" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {orgUsers.map((user) => (
                                      <SelectItem key={user.id} value={user.email}>
                                        <span>{user.name}</span>
                                        <span className="ml-2 text-muted-foreground text-xs">({user.email})</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </>
                        )}

                        {/* ===== Admin Login ===== */}
                        {loginType === "admin" && (
                          <>
                            {/* Select Role */}
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                登入身份
                              </label>
                              <Select
                                value={selectedAdminRole}
                                onValueChange={(value) => {
                                  setSelectedAdminRole(value)
                                  setError("")
                                }}
                              >
                                <SelectTrigger className="h-11 w-full">
                                  <SelectValue placeholder="選擇登入身份" />
                                </SelectTrigger>
                                <SelectContent>
                                  {adminRoleOptions.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {ADMIN_ROLE_LABELS[role] || role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Select Account */}
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                帳號
                              </label>
                              {roleUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">此身份尚無可用帳號</p>
                              ) : (
                                <Select
                                  value={selectedAdminEmail}
                                  onValueChange={(value) => {
                                    setSelectedAdminEmail(value)
                                    setError("")
                                  }}
                                >
                                  <SelectTrigger className="h-11 w-full">
                                    <SelectValue placeholder="選擇帳號" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roleUsers.map((user) => (
                                      <SelectItem key={user.id} value={user.email}>
                                        <span>{user.name}</span>
                                        <span className="ml-2 text-muted-foreground text-xs">({user.email})</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </>
                        )}

                        {/* Password */}
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            密碼
                          </label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="請輸入密碼"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value)
                                setError("")
                              }}
                              className="h-11 pr-10"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Error */}
                        {error && (
                          <p className="text-sm text-red-500 font-medium">{error}</p>
                        )}

                        {/* Submit */}
                        <Button
                          type="submit"
                          className={`w-full h-11 ${
                            loginType === "company"
                              ? "bg-blue-500 hover:bg-blue-600"
                              : "bg-orange-500 hover:bg-orange-600"
                          } shadow-lg`}
                          disabled={isLoading || !currentEmail}
                        >
                          {isLoading ? "登入中..." : "登入系統"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">JV 需求管理平台</span>
            </div>
            <p className="text-sm text-gray-500">© 2025 JV 需求管理平台 Powered by <a href="https://www.zh-aoi.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">智合科技</a></p>
          </div>
        </div>
      </footer>
    </div>
  )
}
