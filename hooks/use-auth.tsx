"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

interface User {
  email: string
  name: string
  role: string
  subsidiary?: string
}

interface AuthContextType {
  user: User | null
  login: (user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const router = useRouter()

  React.useEffect(() => {
    const stored = localStorage.getItem("auth_user")
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem("auth_user")
      }
    }
  }, [])

  const login = React.useCallback((userData: User) => {
    setUser(userData)
    localStorage.setItem("auth_user", JSON.stringify(userData))
  }, [])

  const logout = React.useCallback(() => {
    setUser(null)
    localStorage.removeItem("auth_user")
    router.push("/")
  }, [router])

  const value = React.useMemo(
    () => ({
      user,
      login,
      logout,
      isAuthenticated: !!user,
    }),
    [user, login, logout]
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
