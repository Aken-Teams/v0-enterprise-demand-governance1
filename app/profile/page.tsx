"use client"

import { useState, useEffect, useCallback } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Mail, Building2, Shield, Loader2, Check } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

interface ProfileData {
  id: string
  name: string
  email: string
  role: string
  roleLabel: string
  organizationId: string | null
  organizationName: string | null
  createdAt: string
}

export default function ProfilePage() {
  const { token, login, user: authUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [form, setForm] = useState({ name: "", email: "" })

  const fetchProfile = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setProfile(data)
        setForm({ name: data.name, email: data.email })
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const handleSave = async () => {
    if (!token || !profile) return
    setError("")
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email }),
      })
      const data = await res.json()
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, name: form.name, email: form.email } : prev)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        // Update auth context so header reflects the new name
        if (authUser) {
          login({ ...authUser, name: form.name, email: form.email }, token)
        }
      } else {
        setError(data.error || "儲存失敗")
      }
    } catch {
      setError("網路錯誤，請稍後再試")
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = profile && (form.name !== profile.name || form.email !== profile.email)

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6 px-1 sm:px-0">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">個人設定</h1>
          <p className="text-xs sm:text-base text-muted-foreground">管理您的帳戶資訊</p>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base">基本資料</CardTitle>
            <CardDescription className="text-xs sm:text-sm">您的個人資訊與聯絡方式</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3 sm:gap-4 rounded-lg border bg-muted/30 p-3 sm:p-4">
              <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                <User className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-semibold truncate">{profile?.name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{profile?.email}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="name" className="text-xs sm:text-sm">姓名</Label>
                <Input
                  id="name"
                  className="h-8 sm:h-10 text-xs sm:text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="email" className="text-xs sm:text-sm">電子郵件</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="h-8 sm:h-10 text-xs sm:text-sm"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">所屬組織</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" />
                  <Input className="h-8 sm:h-10 text-xs sm:text-sm" value={profile?.organizationName || "無"} disabled />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">角色</Label>
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" />
                  <Input className="h-8 sm:h-10 text-xs sm:text-sm" value={profile?.roleLabel || ""} disabled />
                </div>
              </div>
            </div>

            {error && <p className="text-xs sm:text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-1 sm:pt-2">
              {hasChanges && (
                <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setForm({ name: profile!.name, email: profile!.email })}>
                  取消
                </Button>
              )}
              <Button size="sm" className="h-8 text-xs sm:text-sm" onClick={handleSave} disabled={saving || !hasChanges}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5" />
                ) : saved ? (
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                ) : null}
                {saved ? "已儲存" : "儲存變更"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base">帳戶資訊</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="grid gap-2.5 sm:gap-3 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">帳戶建立時間</span>
                <span>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("zh-TW") : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">帳戶 ID</span>
                <span className="font-mono text-[10px] sm:text-xs truncate ml-2 max-w-[50%]">{profile?.id}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
