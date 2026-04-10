"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Network, X as XIcon, ChevronLeft, ChevronRight, Check, User, FolderOpen, ShieldCheck, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { LdapTreePicker, type LdapSelectedMember } from "@/components/admin/ldap-tree-picker"
import {
  DemandRoleAssignmentPanel,
  type DemandAssignment,
  type DemandOption,
  type SignoffRole,
} from "@/components/admin/demand-role-assignment-panel"
import { SIGNOFF_ROLE_LABELS } from "@/lib/constants/demand"
import { Badge } from "@/components/ui/badge"

interface OrgOption {
  id: string
  name: string
}

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  roleLabel: string
  isActive: boolean
  organizationId: string | null
  organizationName: string | null
  ldapUsername: string | null
  ldapDomain: string | null
  accessCount: number
  createdAt: string
}

const STEP_LABELS = ["基本資訊", "專案與審核角色", "確認"]

interface UserFormDialogProps {
  mode: "create" | "edit"
  open: boolean
  onOpenChange: (open: boolean) => void
  initialUser?: UserRow | null
  initialStep?: 1 | 2 | 3
  organizations: OrgOption[]
  token: string | null
  onSaved: () => void
}

interface BasicForm {
  name: string
  email: string
  password: string
  role: string
  organizationId: string
  isActive: boolean
  // Password reset (edit only)
  adminPassword: string
  // LDAP binding metadata (create only)
  ldapUsername: string
  ldapDomain: string
  ldapDepartment: string
}

const EMPTY_FORM: BasicForm = {
  name: "",
  email: "",
  password: "",
  role: "",
  organizationId: "",
  isActive: true,
  adminPassword: "",
  ldapUsername: "",
  ldapDomain: "",
  ldapDepartment: "",
}

export function UserFormDialog({
  mode,
  open,
  onOpenChange,
  initialUser,
  initialStep = 1,
  organizations,
  token,
  onSaved,
}: UserFormDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep)
  const [form, setForm] = useState<BasicForm>(EMPTY_FORM)
  const [ldapPickerOpen, setLdapPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)

  // Step 2 state
  const [assignments, setAssignments] = useState<DemandAssignment[]>([])
  const [allDemands, setAllDemands] = useState<DemandOption[]>([])
  const [demandsLoading, setDemandsLoading] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialUser) {
        setForm({
          name: initialUser.name,
          email: initialUser.email,
          password: "",
          role: initialUser.role,
          organizationId: initialUser.organizationId || "",
          isActive: initialUser.isActive,
          adminPassword: "",
          ldapUsername: initialUser.ldapUsername || "",
          ldapDomain: initialUser.ldapDomain || "",
          ldapDepartment: "",
        })
        // If initialStep=2 but role isn't subsidiary, fall back to step 1
        const roleNeedsStep2 = initialUser.role === "subsidiary"
        setStep(initialStep === 2 && !roleNeedsStep2 ? 1 : initialStep)
      } else {
        setForm(EMPTY_FORM)
        setStep(initialStep)
      }
      setAssignments([])
      setAllDemands([])
      setShowPassword(false)
      setShowAdminPassword(false)
    }
  }, [open, mode, initialUser, initialStep])

  // Load demands and existing assignments when entering Step 2
  const loadStep2Data = useCallback(async () => {
    if (!token) return
    setDemandsLoading(true)
    try {
      const fetches: Promise<Response>[] = [
        fetch("/api/demands", { headers: { Authorization: `Bearer ${token}` } }),
      ]
      // If editing existing user, also fetch their current assignments
      if (mode === "edit" && initialUser) {
        fetches.push(
          fetch(`/api/admin/users/${initialUser.id}/access`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        )
      }

      const responses = await Promise.all(fetches)
      const demandsData = await responses[0].json()

      if (responses[0].ok) {
        setAllDemands(
          demandsData.demands.map((d: { id: string; demandNumber: string; title: string; status: string }) => ({
            id: d.id,
            demandNumber: d.demandNumber,
            title: d.title,
            status: d.status,
          })),
        )
      }

      if (responses.length > 1 && responses[1].ok) {
        const accessData = await responses[1].json()
        if (Array.isArray(accessData.assignments)) {
          setAssignments(
            accessData.assignments.map((a: { demandId: string; signoffRole: string }) => ({
              demandId: a.demandId,
              signoffRole: a.signoffRole as SignoffRole,
            })),
          )
        }
      }
    } catch {
      toast.error("載入專案清單失敗")
    } finally {
      setDemandsLoading(false)
    }
  }, [token, mode, initialUser])

  const hasLdap = !!form.ldapUsername
  const goToStep2 = () => {
    // Validate Step 1 for create mode
    if (mode === "create") {
      if (!form.name || !form.email || !form.role) {
        toast.error("請先填寫所有必填欄位")
        return
      }
      // Password required only when no LDAP binding
      if (!hasLdap && !form.password) {
        toast.error("非 AD 帳號必須設定密碼")
        return
      }
      if (form.password && form.password.length < 6) {
        toast.error("密碼至少需要 6 個字元")
        return
      }
    }
    setStep(2)
    loadStep2Data()
  }

  // LDAP select handler — queries real email from LDAP user API
  const handleLdapSelect = async (member: LdapSelectedMember) => {
    const parts = member.displayName.trim().split(/\s+/)
    const chinesePart = parts.find((p) => /[\u4e00-\u9fa5]/.test(p))
    const name = chinesePart || member.displayName

    // Fetch real email from LDAP user lookup API
    let email = ""
    try {
      const res = await fetch(
        `/api/admin/ldap/user?username=${encodeURIComponent(member.username)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      if (res.ok) {
        const data = await res.json()
        email = data?.user?.mail || ""
      }
    } catch {
      // fall through — email stays empty, user can fill manually
    }

    setForm((prev) => ({
      ...prev,
      name,
      email,
      ldapUsername: member.username,
      ldapDomain: member.domain,
      ldapDepartment: member.departmentName,
    }))
    setLdapPickerOpen(false)
    toast.success(`已帶入 ${name}（${member.departmentName}）`)
  }

  const clearLdapBinding = () => {
    setForm((prev) => ({ ...prev, ldapUsername: "", ldapDomain: "", ldapDepartment: "" }))
  }

  // Save handler
  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    try {
      if (mode === "create") {
        // Create user + assignments in one request
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password || undefined,
            role: form.role,
            organizationId: form.organizationId || null,
            ldapUsername: form.ldapUsername || null,
            ldapDomain: form.ldapDomain || null,
            assignments: assignments.map((a) => ({
              demandId: a.demandId,
              signoffRole: a.signoffRole,
            })),
          }),
        })
        const data = await res.json()
        if (res.ok) {
          toast.success("帳號建立成功")
          onOpenChange(false)
          onSaved()
        } else {
          toast.error(data.error || "建立失敗")
        }
      } else if (initialUser) {
        // Edit: update basic info + assignments in parallel
        const payload: Record<string, unknown> = {
          id: initialUser.id,
          name: form.name,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
          organizationId: form.organizationId || null,
          ldapUsername: form.ldapUsername || null,
          ldapDomain: form.ldapDomain || null,
        }
        if (form.password) {
          if (!form.adminPassword) {
            toast.error("修改密碼需要輸入您的管理員密碼確認")
            setSaving(false)
            return
          }
          payload.password = form.password
          payload.adminPassword = form.adminPassword
        }

        const [userRes, accessRes] = await Promise.all([
          fetch("/api/admin/users", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
          fetch(`/api/admin/users/${initialUser.id}/access`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              assignments: assignments.map((a) => ({
                demandId: a.demandId,
                signoffRole: a.signoffRole,
              })),
            }),
          }),
        ])

        const userData = await userRes.json()
        if (!userRes.ok) {
          toast.error(userData.error || "更新基本資訊失敗")
          setSaving(false)
          return
        }
        if (!accessRes.ok) {
          const accessData = await accessRes.json()
          toast.error(accessData.error || "更新專案權限失敗")
          setSaving(false)
          return
        }

        toast.success("帳號更新成功")
        onOpenChange(false)
        onSaved()
      }
    } catch {
      toast.error("網路錯誤")
    } finally {
      setSaving(false)
    }
  }

  const isStep1Valid =
    mode === "create"
      ? !!(form.name && form.email && form.role && (hasLdap || (form.password && form.password.length >= 6)))
      : !!(form.name && form.email && form.role)

  // Only "subsidiary" role needs Step 2 (project + signoff role assignment)
  const needsStep2 = form.role === "subsidiary"
  const visibleSteps = needsStep2
    ? STEP_LABELS
    : [STEP_LABELS[0], STEP_LABELS[2]] // 基本資訊 → 確認
  const totalSteps = visibleSteps.length
  // Map internal step number to display position
  const displayStep = needsStep2 ? step : step === 3 ? 2 : 1

  const dialogTitle = mode === "create" ? "新增帳號" : `編輯帳號 — ${initialUser?.name || ""}`
  const dialogDescription =
    mode === "create" ? "建立新的系統使用者帳號" : "修改帳號資訊與專案審核角色"

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {/* Step indicator with connecting line */}
          <div className="flex items-center px-1">
            {visibleSteps.map((label, i) => {
              // Map display index to internal step number
              const internalStep = needsStep2
                ? (i + 1) as 1 | 2 | 3
                : (i === 0 ? 1 : 3) as 1 | 2 | 3
              const isCurrent = step === internalStep
              const isCompleted = step > internalStep
              const displayNum = i + 1
              const isDisabled =
                (internalStep === 2 && !isStep1Valid) ||
                (internalStep === 3 && step < (needsStep2 ? 2 : 1))
              return (
                <div key={label} className="flex items-center">
                  {i > 0 && (
                    <div
                      className={cn(
                        "h-px w-8 mx-2 transition-colors",
                        isCompleted || isCurrent ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (internalStep === 1) {
                        setStep(1)
                      } else if (internalStep === 2) {
                        if (step === 1) goToStep2()
                        else setStep(2)
                      } else if (internalStep === 3) {
                        if (!needsStep2 && step === 1 && isStep1Valid) setStep(3)
                        else if (step >= 2) setStep(3)
                      }
                    }}
                    disabled={isDisabled}
                    className={cn(
                      "flex items-center gap-1.5 text-sm transition-colors",
                      isCurrent ? "text-foreground font-medium" : "text-muted-foreground",
                      isDisabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:text-foreground cursor-pointer",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium border transition-colors",
                        isCurrent
                          ? "bg-primary text-primary-foreground border-primary"
                          : isCompleted
                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                            : "bg-muted text-muted-foreground border-muted-foreground/30",
                      )}
                    >
                      {isCompleted ? <Check className="h-3 w-3" /> : displayNum}
                    </span>
                    {label}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Step content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {step === 1 && (
              <div className="space-y-4 py-2">
                {/* AD selection (create only) */}
                {mode === "create" && (
                  <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        從 AD 組織架構選擇（建議）
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setLdapPickerOpen(true)}
                      >
                        <Network className="h-3 w-3 mr-1" />
                        瀏覽 AD
                      </Button>
                    </div>
                    {form.ldapUsername ? (
                      <div className="flex items-center justify-between gap-2 rounded-md bg-background border px-2.5 py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {form.name}
                            <span className="ml-1.5 text-xs text-muted-foreground font-mono">
                              {form.ldapUsername}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {form.ldapDomain} · {form.ldapDepartment}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={clearLdapBinding}
                          title="清除 AD 綁定"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        從 AD 選擇後會自動帶入姓名與電子郵件
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>
                    姓名 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="使用者姓名"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    電子郵件 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                {mode === "create" ? (
                  <div className="space-y-2">
                    <Label>
                      密碼 {!hasLdap && <span className="text-destructive">*</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={hasLdap ? "留空則使用 AD 密碼登入" : "至少 6 個字元"}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {hasLdap && (
                      <p className="text-[11px] text-muted-foreground">
                        已綁定 AD，可留空（使用 AD 密碼登入）或設定本地備用密碼
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>新密碼</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="留空表示不修改"
                          value={form.password}
                          onChange={(e) =>
                            setForm({ ...form, password: e.target.value, adminPassword: "" })
                          }
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {form.password && (
                      <div className="space-y-2">
                        <Label>
                          管理員密碼確認 <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            type={showAdminPassword ? "text" : "password"}
                            placeholder="請輸入您自己的密碼以確認身份"
                            value={form.adminPassword}
                            onChange={(e) =>
                              setForm({ ...form, adminPassword: e.target.value })
                            }
                            className="pr-10"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            tabIndex={-1}
                          >
                            {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">修改密碼需要驗證管理員身份</p>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label>
                    角色 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm({ ...form, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">管理員</SelectItem>
                      <SelectItem value="delivery">交付團隊</SelectItem>
                      <SelectItem value="subsidiary">需求單位</SelectItem>
                      <SelectItem value="viewer">董事會</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>組織</Label>
                  <Select
                    value={form.organizationId || "none"}
                    onValueChange={(v) =>
                      setForm({ ...form, organizationId: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇組織（選填）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">無</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {mode === "edit" && (
                  <div className="space-y-2">
                    <Label>狀態</Label>
                    <Select
                      value={form.isActive ? "active" : "inactive"}
                      onValueChange={(v) =>
                        setForm({ ...form, isActive: v === "active" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">啟用</SelectItem>
                        <SelectItem value="inactive">停用</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="py-2">
                <DemandRoleAssignmentPanel
                  value={assignments}
                  onChange={setAssignments}
                  allDemands={allDemands}
                  loading={demandsLoading}
                />
              </div>
            )}

            {step === 3 && (
              <div className="py-2 space-y-4">
                {/* Basic info summary */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium mb-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    基本資訊
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-y-1.5 gap-x-3 text-sm">
                    <span className="text-muted-foreground">姓名</span>
                    <span className="font-medium">{form.name}</span>
                    <span className="text-muted-foreground">電子郵件</span>
                    <span>{form.email}</span>
                    <span className="text-muted-foreground">角色</span>
                    <span>
                      {{ admin: "管理員", delivery: "交付團隊", subsidiary: "需求單位", viewer: "董事會" }[form.role] || form.role}
                    </span>
                    <span className="text-muted-foreground">組織</span>
                    <span>{organizations.find((o) => o.id === form.organizationId)?.name || "無"}</span>
                    {form.ldapUsername && (
                      <>
                        <span className="text-muted-foreground">AD 綁定</span>
                        <span className="font-mono text-xs">{form.ldapUsername} · {form.ldapDomain}</span>
                      </>
                    )}
                    {mode === "edit" && (
                      <>
                        <span className="text-muted-foreground">狀態</span>
                        <span>{form.isActive ? "啟用" : "停用"}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Project assignments summary */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium mb-3">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    專案與審核角色
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {assignments.length} 個專案
                    </Badge>
                  </div>
                  {assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">尚未指派任何專案</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {assignments.map((a) => {
                        const demand = allDemands.find((d) => d.id === a.demandId)
                        return (
                          <div
                            key={a.demandId}
                            className="flex items-center justify-between gap-2 rounded bg-background border px-3 py-1.5 text-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-xs text-muted-foreground mr-2">
                                {demand?.demandNumber || "—"}
                              </span>
                              <span className="truncate">{demand?.title || a.demandId}</span>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {SIGNOFF_ROLE_LABELS[a.signoffRole] || a.signoffRole}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer: left button | center step | right button */}
          <div className="grid grid-cols-3 items-center border-t pt-3">
            {/* Left */}
            <div className="flex justify-start">
              {step === 1 ? (
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
              ) : step === 2 ? (
                <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一步
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setStep(needsStep2 ? 2 : 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一步
                </Button>
              )}
            </div>
            {/* Center */}
            <div className="flex justify-center text-xs text-muted-foreground">
              步驟 {displayStep} / {totalSteps}
            </div>
            {/* Right */}
            <div className="flex justify-end">
              {step === 1 && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (needsStep2) {
                      goToStep2()
                    } else {
                      // Validate then skip to confirmation
                      if (mode === "create") {
                        if (!form.name || !form.email || !form.role) {
                          toast.error("請先填寫所有必填欄位")
                          return
                        }
                        if (!hasLdap && !form.password) {
                          toast.error("非 AD 帳號必須設定密碼")
                          return
                        }
                        if (form.password && form.password.length < 6) {
                          toast.error("密碼至少需要 6 個字元")
                          return
                        }
                      }
                      setAssignments([])
                      setStep(3)
                    }
                  }}
                  disabled={!isStep1Valid}
                >
                  下一步
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {step === 2 && (
                <Button size="sm" onClick={() => setStep(3)}>
                  下一步
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {step === 3 && (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  {mode === "create" ? "確認建立" : "確認儲存"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* LDAP Picker Dialog (nested) */}
      <Dialog open={ldapPickerOpen} onOpenChange={setLdapPickerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              從 AD 組織架構選擇
            </DialogTitle>
            <DialogDescription>
              選擇 domain 後瀏覽組織樹，點擊成員即可帶入表單。
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col">
            <LdapTreePicker onSelectMember={handleLdapSelect} compact />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
