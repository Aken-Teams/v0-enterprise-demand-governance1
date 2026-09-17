"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Building2, Settings, Eye, EyeOff, ArrowRight, Loader2, ChevronsUpDown, Check } from "lucide-react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

type LoginType = "company" | "admin"

interface AccountUser {
  id: string
  name: string
  email: string
  role?: string
  ldapUsername?: string | null
}

interface OrgWithUsers {
  id: string
  name: string
  users: AccountUser[]
}

const ADMIN_ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  delivery: "交付團隊",
}

const ROLE_ROUTES: Record<string, string> = {
  admin: "/governance/inbox",
  delivery: "/governance/inbox",
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
  const [companyAccountInput, setCompanyAccountInput] = useState("")
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false)
  const companyInputRef = useRef<HTMLInputElement>(null)
  const companyDropdownRef = useRef<HTMLDivElement>(null)

  // Admin login state
  const [selectedAdminRole, setSelectedAdminRole] = useState("admin")
  const [selectedAdminEmail, setSelectedAdminEmail] = useState("")

  // Combobox open states
  const [adminAccountOpen, setAdminAccountOpen] = useState(false)

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

  // Reset account when org changes
  useEffect(() => {
    setSelectedAccountEmail("")
    setCompanyAccountInput("")
  }, [selectedOrgId, organizations])

  // Auto-select default account when admin role changes
  // Prefer "智合 - Aken" (admin@panjit.com) for admin role
  useEffect(() => {
    const users = adminUsers.filter((u) => u.role === selectedAdminRole)
    if (users.length > 0) {
      const preferred = selectedAdminRole === "admin"
        ? users.find((u) => u.email === "admin@panjit.com")
        : undefined
      setSelectedAdminEmail(preferred?.email || users[0].email)
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

  // Sort by ldapUsername (工號), then filter by input
  const sortedOrgUsers = [...orgUsers].sort((a, b) => {
    if (a.ldapUsername && b.ldapUsername) return a.ldapUsername.localeCompare(b.ldapUsername)
    if (a.ldapUsername) return -1
    if (b.ldapUsername) return 1
    return a.name.localeCompare(b.name)
  })
  const filteredOrgUsers = companyAccountInput.trim()
    ? sortedOrgUsers.filter((u) => {
        const q = companyAccountInput.trim().toLowerCase()
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.ldapUsername && u.ldapUsername.toLowerCase().includes(q))
        )
      })
    : sortedOrgUsers

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        companyInputRef.current && !companyInputRef.current.contains(e.target as Node) &&
        companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)
      ) {
        setCompanyDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const selectCompanyAccount = useCallback((user: AccountUser, fromDropdown = false) => {
    setSelectedAccountEmail(user.email)
    if (fromDropdown) {
      setCompanyAccountInput(user.ldapUsername ? `${user.name} (${user.ldapUsername})` : user.name)
    }
    setCompanyDropdownOpen(false)
    setError("")
  }, [])

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
    <div className="flex min-h-screen flex-col bg-white sm:bg-white">
      {/* Header — desktop only */}
      <header className="hidden sm:block border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <div className="flex items-center gap-2">
            <Image src="/logo2.png" alt="企業需求管理平台" width={254} height={176} priority className="h-10 w-auto object-contain" />
            <span className="text-xl font-bold text-gray-900">企業需求管理平台</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 sm:bg-gradient-to-br sm:from-blue-50 sm:via-white sm:to-blue-50">
        <div className="mx-auto flex min-h-[100dvh] sm:min-h-[calc(100vh-64px-73px)] max-w-7xl items-center px-0 py-0 sm:px-6 sm:py-8">
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
            <div className="w-full">
              {/* Mobile branding */}
              <div className="sm:hidden flex flex-col items-center gap-2 mb-6 pt-12">
                <Image src="/logo2.png" alt="企業需求管理平台" width={254} height={176} priority className="h-14 w-auto object-contain" />
                <h1 className="text-xl font-bold text-gray-900">企業需求管理平台</h1>
                <p className="text-xs text-gray-400">需求提案 · 資源配置 · 開發追蹤 · 交付管控</p>
              </div>

              {/* Hero Text — desktop */}
              <div className="hidden sm:block mb-4 sm:mb-8">
                <h1 className="mb-1 text-2xl font-bold tracking-tight text-gray-900 sm:mb-2 sm:text-3xl lg:text-4xl">
                  企業需求管理平台
                </h1>
                <p className="text-sm text-gray-500 sm:text-base">需求提案 · 資源配置 · 開發追蹤 · 交付管控</p>
              </div>

              {/* Login Card */}
              <Card className="overflow-hidden border-0 shadow-none sm:border sm:shadow-xl rounded-none sm:rounded-xl">
                <>
                  {/* Login Type Toggle */}
                  <div className="border-b bg-gray-50 px-4 py-2.5 sm:px-6 sm:py-4">
                    <div className="flex items-center justify-center gap-2 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginType("company")
                          setPassword("")
                          setError("")
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all ${
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
                        className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all ${
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
                  <CardContent className="px-4 py-4 sm:p-6">
                    {dataLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                        {/* ===== Company Login ===== */}
                        {loginType === "company" && (
                          <>
                            {/* Select Organization */}
                            <div>
                              <label className="mb-1 sm:mb-1.5 block text-sm font-medium text-gray-700">
                                公司
                              </label>
                              <Select
                                value={selectedOrgId}
                                onValueChange={(value) => {
                                  setSelectedOrgId(value)
                                  setError("")
                                }}
                              >
                                <SelectTrigger className="h-9 sm:h-11 w-full">
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

                            {/* Account Input with Autocomplete */}
                            <div>
                              <label className="mb-1 sm:mb-1.5 block text-sm font-medium text-gray-700">
                                帳號
                              </label>
                              {orgUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">此公司尚無可用帳號</p>
                              ) : (
                                <div className="relative">
                                  <Input
                                    ref={companyInputRef}
                                    className="h-9 sm:h-11"
                                    placeholder="輸入工號、姓名或信箱..."
                                    value={companyAccountInput}
                                    onChange={(e) => {
                                      setCompanyAccountInput(e.target.value)
                                      setCompanyDropdownOpen(true)
                                      // Clear selection if user edits text
                                      if (selectedAccountEmail) {
                                        const match = orgUsers.find((u) => u.email === selectedAccountEmail)
                                        const displayText = match
                                          ? match.ldapUsername ? `${match.name} (${match.ldapUsername})` : match.name
                                          : ""
                                        if (e.target.value !== displayText) {
                                          setSelectedAccountEmail("")
                                        }
                                      }
                                      setError("")
                                    }}
                                    onFocus={() => setCompanyDropdownOpen(true)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        setCompanyDropdownOpen(false)
                                        companyInputRef.current?.blur()
                                      }
                                      // Select first match on Enter (if not submitting form)
                                      if (e.key === "Enter" && companyDropdownOpen && filteredOrgUsers.length > 0 && !selectedAccountEmail) {
                                        e.preventDefault()
                                        selectCompanyAccount(filteredOrgUsers[0])
                                      }
                                    }}
                                    autoComplete="off"
                                  />
                                  {selectedAccountEmail && (
                                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                  )}
                                  {companyDropdownOpen && filteredOrgUsers.length > 0 && (
                                    <div
                                      ref={companyDropdownRef}
                                      className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[40vh] sm:max-h-[300px] overflow-y-auto"
                                    >
                                      {filteredOrgUsers.map((user) => (
                                        <button
                                          type="button"
                                          key={user.id}
                                          className={cn(
                                            "flex items-center w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                                            selectedAccountEmail === user.email && "bg-accent",
                                          )}
                                          onMouseDown={(e) => {
                                            e.preventDefault() // Prevent input blur
                                            selectCompanyAccount(user, true)
                                          }}
                                        >
                                          <span className="font-medium truncate">{user.name}</span>
                                          {user.ldapUsername && (
                                            <span className="ml-2 text-muted-foreground text-xs shrink-0">{user.ldapUsername}</span>
                                          )}
                                          <span className="ml-auto text-muted-foreground text-xs truncate pl-2">
                                            {user.email}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {companyDropdownOpen && companyAccountInput.trim() && filteredOrgUsers.length === 0 && (
                                    <div
                                      ref={companyDropdownRef}
                                      className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
                                    >
                                      <p className="px-3 py-2 text-sm text-muted-foreground">找不到帳號</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* ===== Admin Login ===== */}
                        {loginType === "admin" && (
                          <>
                            {/* Select Role */}
                            <div>
                              <label className="mb-1 sm:mb-1.5 block text-sm font-medium text-gray-700">
                                登入身份
                              </label>
                              <Select
                                value={selectedAdminRole}
                                onValueChange={(value) => {
                                  setSelectedAdminRole(value)
                                  setError("")
                                }}
                              >
                                <SelectTrigger className="h-9 sm:h-11 w-full">
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
                              <label className="mb-1 sm:mb-1.5 block text-sm font-medium text-gray-700">
                                帳號
                              </label>
                              {roleUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">此身份尚無可用帳號</p>
                              ) : (
                                <Popover open={adminAccountOpen} onOpenChange={setAdminAccountOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={adminAccountOpen}
                                      className="h-9 sm:h-11 w-full justify-between font-normal"
                                    >
                                      {selectedAdminEmail ? (
                                        <span className="truncate">
                                          {roleUsers.find((u) => u.email === selectedAdminEmail)?.name || ""}
                                          <span className="ml-2 text-muted-foreground text-xs hidden sm:inline">
                                            ({selectedAdminEmail})
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">選擇帳號</span>
                                      )}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" collisionPadding={16}>
                                    <Command>
                                      <CommandInput placeholder="搜尋姓名或信箱..." />
                                      <CommandList className="max-h-[40vh] sm:max-h-[300px]">
                                        <CommandEmpty>找不到帳號</CommandEmpty>
                                        {roleUsers.map((user) => (
                                          <CommandItem
                                            key={user.id}
                                            value={`${user.name} ${user.email}`}
                                            onSelect={() => {
                                              setSelectedAdminEmail(user.email)
                                              setError("")
                                              setAdminAccountOpen(false)
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4 shrink-0",
                                                selectedAdminEmail === user.email ? "opacity-100" : "opacity-0",
                                              )}
                                            />
                                            <span className="font-medium truncate">{user.name}</span>
                                            <span className="ml-2 text-muted-foreground text-xs truncate">({user.email})</span>
                                          </CommandItem>
                                        ))}
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </>
                        )}

                        {/* Password */}
                        <div>
                          <label className="mb-1 sm:mb-1.5 block text-sm font-medium text-gray-700">
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
                              className="h-9 sm:h-11 pr-10"
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
                          className={`w-full h-9 sm:h-11 ${
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
      <footer className="sm:border-t sm:border-gray-200 bg-white py-3 sm:py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-1 sm:gap-4 sm:flex-row">
            <div className="hidden sm:flex items-center gap-2">
              <Image src="/logo2.png" alt="企業需求管理平台" width={254} height={176} className="h-8 w-auto object-contain" />
              <span className="font-semibold text-gray-900">企業需求管理平台</span>
            </div>
            <p className="text-[10px] sm:text-sm text-gray-400 sm:text-gray-500">© 2025 企業需求管理平台 Powered by <a href="https://www.zh-aoi.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">智合科技</a></p>
          </div>
        </div>
      </footer>
    </div>
  )
}
