"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Settings, Eye, EyeOff, ArrowRight, ArrowLeft, Mail } from "lucide-react"
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

type FormView = "login" | "forgot-password"
type LoginType = "company" | "admin"
type AdminRoleType = "admin" | "jv-team" | "zhaoi-team"

interface Subsidiary {
  id: string
  name: string
  email: string
}

interface AdminRole {
  id: AdminRoleType
  name: string
  email: string
  route: string
}

const adminRoles: AdminRole[] = [
  { id: "admin", name: "管理者", email: "admin@panjit.com", route: "/governance/inbox" },
  { id: "jv-team", name: "JV 團隊", email: "jv@jvision.com", route: "/delivery" },
  { id: "zhaoi-team", name: "智合團隊", email: "john@zhaoi.com", route: "/delivery" },
]

const subsidiaries: Subsidiary[] = [
  { id: "panjit", name: "強茂", email: "panjit@panjit.com" },
  { id: "panjit-tech", name: "璟茂科技", email: "panjit-tech@panjit.com" },
  { id: "ymoptics", name: "熒茂光學", email: "ymoptics@panjit.com" },
  { id: "panjit-wuxi", name: "強茂電子（無錫）", email: "panjit-wuxi@panjit.com" },
  { id: "panjit-xuzhou", name: "強茂半導體（徐州）", email: "panjit-xuzhou@panjit.com" },
  { id: "panjit-shandong", name: "山東強茂電子", email: "panjit-shandong@panjit.com" },
  { id: "hge", name: "虹冠電子工業", email: "hge@panjit.com" },
]

export default function HomePage() {
  const router = useRouter()
  const { login } = useAuth()
  const [loginType, setLoginType] = useState<LoginType>("company")
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<Subsidiary>(subsidiaries[0])
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formView, setFormView] = useState<FormView>("login")
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotSubmitted, setForgotSubmitted] = useState(false)
  const [selectedAdminRole, setSelectedAdminRole] = useState<AdminRole>(adminRoles[0])

  const currentEmail = loginType === "company"
    ? selectedSubsidiary.email
    : selectedAdminRole.email

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
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

      const route = loginType === "company"
        ? "/subsidiary"
        : selectedAdminRole.route

      router.push(route)
    } catch {
      setError("網路錯誤，請稍後再試")
      setIsLoading(false)
    }
  }

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setForgotSubmitted(true)
    }, 500)
  }

  const handleBackToLogin = () => {
    setFormView("login")
    setForgotEmail("")
    setForgotSubmitted(false)
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
            <span className="text-xl font-bold text-gray-900">GOVORA</span>
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
                <h1 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
                  GOVORA - Governance × Aurora
                  <br />
                  <span className="text-primary">協作管理平台</span>
                </h1>
              </div>

              {/* Login Card */}
              <Card className="overflow-hidden shadow-xl">
                {formView === "login" ? (
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
                            setSelectedSubsidiary(subsidiaries[0])
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
                            setSelectedAdminRole(adminRoles[0])
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
                      <form onSubmit={handleLogin} className="space-y-4">
                        {/* 角色選擇 (只在管理方登入顯示) */}
                        {loginType === "admin" && (
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                              登入身份
                            </label>
                            <Select
                              value={selectedAdminRole.id}
                              onValueChange={(value) => {
                                const role = adminRoles.find((r) => r.id === value)
                                if (role) {
                                  setSelectedAdminRole(role)
                                  setError("")
                                }
                              }}
                            >
                              <SelectTrigger className="h-11 w-full">
                                <SelectValue placeholder="選擇登入身份" />
                              </SelectTrigger>
                              <SelectContent>
                                {adminRoles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* 公司選擇 (只在公司登入顯示) */}
                        {loginType === "company" && (
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                              公司
                            </label>
                            <Select
                              value={selectedSubsidiary.id}
                              onValueChange={(value) => {
                                const sub = subsidiaries.find((s) => s.id === value)
                                if (sub) {
                                  setSelectedSubsidiary(sub)
                                  setError("")
                                }
                              }}
                            >
                              <SelectTrigger className="h-11 w-full">
                                <SelectValue placeholder="選擇公司" />
                              </SelectTrigger>
                              <SelectContent>
                                {subsidiaries.map((sub) => (
                                  <SelectItem key={sub.id} value={sub.id}>
                                    {sub.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* 帳號 (唯讀顯示) */}
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            帳號
                          </label>
                          <Input
                            type="email"
                            value={currentEmail}
                            className="h-11 bg-gray-50 text-gray-600"
                            readOnly
                          />
                        </div>

                        {/* 密碼 */}
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

                        {/* 錯誤訊息 */}
                        {error && (
                          <p className="text-sm text-red-500 font-medium">{error}</p>
                        )}

                        {/* 選項 */}
                        <div className="flex items-center justify-between text-sm">
                          <label className="flex items-center gap-2 cursor-pointer text-gray-600">
                            <input type="checkbox" className="rounded border-gray-300" />
                            <span>記住我</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setFormView("forgot-password")}
                            className="text-primary hover:underline"
                          >
                            忘記密碼？
                          </button>
                        </div>

                        {/* 登入按鈕 */}
                        <Button
                          type="submit"
                          className={`w-full h-11 ${
                            loginType === "company"
                              ? "bg-blue-500 hover:bg-blue-600"
                              : "bg-orange-500 hover:bg-orange-600"
                          } shadow-lg`}
                          disabled={isLoading}
                        >
                          {isLoading ? "登入中..." : "登入系統"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    </CardContent>
                  </>
                ) : (
                  <>
                    {/* Forgot Password Header */}
                    <div className="border-b bg-gray-50 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">忘記密碼</h3>
                          <p className="text-sm text-gray-500">輸入您的電子郵件以重設密碼</p>
                        </div>
                      </div>
                    </div>

                    {/* Forgot Password Form */}
                    <CardContent className="p-6">
                      {forgotSubmitted ? (
                        <div className="space-y-4 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                            <Mail className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">郵件已發送</h4>
                            <p className="mt-1 text-sm text-gray-500">
                              重設密碼連結已發送至 {forgotEmail}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-11"
                            onClick={handleBackToLogin}
                          >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            返回登入
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handleForgotPassword} className="space-y-4">
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                              電子郵件
                            </label>
                            <Input
                              type="email"
                              placeholder="請輸入您的電子郵件"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              className="h-11"
                              required
                            />
                          </div>

                          <Button
                            type="submit"
                            className="w-full h-11 bg-primary hover:bg-primary/90 shadow-lg"
                            disabled={isLoading || !forgotEmail}
                          >
                            {isLoading ? "發送中..." : "發送重設連結"}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>

                          <button
                            type="button"
                            onClick={handleBackToLogin}
                            className="flex w-full items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            返回登入
                          </button>
                        </form>
                      )}
                    </CardContent>
                  </>
                )}
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
              <span className="font-semibold text-gray-900">GOVORA</span>
            </div>
            <p className="text-sm text-gray-500">© 2025 GOVORA - 照亮企業決策的治理平台</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
