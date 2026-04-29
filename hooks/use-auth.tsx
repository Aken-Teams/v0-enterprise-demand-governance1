"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

interface User {
  id?: string
  email: string
  name: string
  role: string
  subsidiary?: string
  organizationId?: string | null
  restrictedView?: boolean
  isOrgAccount?: boolean
  isBoardMember?: boolean
  adminScopeType?: string // "all" | "organization" | "project"
  boardExemptFromSignoff?: boolean
  canViewFinancial?: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (user: User, token: string) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [token, setToken] = React.useState<string | null>(null)
  const router = useRouter()

  React.useEffect(() => {
    const storedUser = localStorage.getItem("auth_user")
    const storedToken = localStorage.getItem("auth_token")
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser))
        setToken(storedToken)
      } catch {
        localStorage.removeItem("auth_user")
        localStorage.removeItem("auth_token")
      }
    }
  }, [])

  const login = React.useCallback((userData: User, jwtToken: string) => {
    setUser(userData)
    setToken(jwtToken)
    localStorage.setItem("auth_user", JSON.stringify(userData))
    localStorage.setItem("auth_token", jwtToken)
  }, [])

  const logout = React.useCallback(() => {
    const t = localStorage.getItem("auth_token")
    if (t) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {})
    }
    setUser(null)
    setToken(null)
    localStorage.removeItem("auth_user")
    localStorage.removeItem("auth_token")
    router.push("/")
  }, [router])

  const value = React.useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      isAuthenticated: !!user && !!token,
    }),
    [user, token, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
