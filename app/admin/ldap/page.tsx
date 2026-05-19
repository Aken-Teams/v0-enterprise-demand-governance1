"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LdapTreePicker } from "@/components/admin/ldap-tree-picker"
import { useAuth } from "@/hooks/use-auth"

export default function LdapOrgTreePage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role === "admin" && user.adminScopeType && user.adminScopeType !== "all") {
      router.replace("/governance/inbox")
    }
  }, [user, router])

  return (
    <AppLayout userRole="admin">
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
            AD 組織架構
          </h1>
          <p className="text-xs sm:text-base text-muted-foreground">瀏覽各子公司 LDAP / Active Directory 的部門與成員資料</p>
        </div>

        <Card>
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-sm sm:text-base">組織樹</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              選擇 domain 後系統會從 LDAP 伺服器讀取該子公司完整組織架構。資料會快取 10 分鐘。
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="h-[60vh] sm:h-[70vh] flex flex-col">
              <LdapTreePicker />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
