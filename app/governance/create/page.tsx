"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CalendarIcon, Upload, Building2, ChevronRight, ChevronLeft,
  Check, FileText, Settings2, ClipboardCheck, X, FileIcon, Loader2,
  FileSpreadsheet, Presentation, Image as ImageIcon, FileCode,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"

interface Organization {
  id: string
  code: string
  name: string
  users: { id: string; name: string; email: string }[]
}

const steps = [
  { id: 1, title: "基本資訊", icon: Building2 },
  { id: 2, title: "需求內容", icon: FileText },
  { id: 3, title: "補充資訊", icon: Settings2 },
  { id: 4, title: "確認內容", icon: ClipboardCheck },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  switch (ext) {
    case "pdf":
      return { icon: FileText, color: "text-red-500" }
    case "doc":
    case "docx":
      return { icon: FileText, color: "text-blue-500" }
    case "xls":
    case "xlsx":
      return { icon: FileSpreadsheet, color: "text-green-600" }
    case "ppt":
    case "pptx":
      return { icon: Presentation, color: "text-orange-500" }
    case "md":
    case "txt":
      return { icon: FileCode, color: "text-gray-500" }
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return { icon: ImageIcon, color: "text-purple-500" }
    default:
      return { icon: FileIcon, color: "text-muted-foreground" }
  }
}

export default function CreateDemandPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Only "all" admins can create demands
  useEffect(() => {
    if (user && user.role === "admin" && user.adminScopeType && user.adminScopeType !== "all") {
      router.replace("/governance/inbox")
    }
  }, [user, router])

  const [currentStep, setCurrentStep] = useState(1)
  const [date, setDate] = useState<Date>()
  const [selectedOrgId, setSelectedOrgId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [painPoint, setPainPoint] = useState("")
  const [expectedBenefit, setExpectedBenefit] = useState("")
  const [estimatedSp, setEstimatedSp] = useState("")
  const [vendor, setVendor] = useState("JV")
  const [vendorOptions, setVendorOptions] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [fileError, setFileError] = useState("")

  const [organizations, setOrganizations] = useState<Organization[]>([])

  // Load organizations from API
  useEffect(() => {
    if (!token) return
    fetch("/api/organizations", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.organizations) setOrganizations(data.organizations)
      })
      .catch(() => {})
  }, [token])

  // Fetch vendor options
  useEffect(() => {
    if (!token) return
    fetch("/api/vendors", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.vendors) setVendorOptions(data.vendors.map((v: { name: string }) => v.name))
      })
      .catch(() => {})
  }, [token])

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId)

  const canNext = () => {
    if (currentStep === 1) return selectedOrgId !== "" && title.trim() !== ""
    if (currentStep === 2) return description.trim() !== "" && painPoint.trim() !== "" && estimatedSp.trim() !== ""
    return true
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const maxSize = 10 * 1024 * 1024
    const oversized = selected.filter((f) => f.size > maxSize)
    if (oversized.length > 0) {
      setFileError(`檔案「${oversized[0].name}」超過 10MB 限制`)
    } else {
      setFileError("")
    }
    setFiles((prev) => [...prev, ...selected.filter((f) => f.size <= maxSize)])
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!token) return
    setIsSubmitting(true)
    setSubmitError("")

    try {
      const formData = new FormData()
      formData.append("organizationId", selectedOrgId)
      formData.append("vendor", vendor)
      formData.append("title", title)
      formData.append("description", description)
      formData.append("painPoint", painPoint)
      formData.append("expectedBenefit", expectedBenefit)
      formData.append("estimatedSp", estimatedSp)
      formData.append("desiredDate", date?.toISOString() || "")
      formData.append("adminNotes", notes)
      for (const file of files) {
        formData.append("files", file)
      }

      const res = await fetch("/api/demands", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || "建立失敗")
        return
      }

      router.push("/governance/inbox")
    } catch {
      setSubmitError("網路錯誤，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppLayout userRole="admin">
      <div className="mx-auto max-w-4xl space-y-3 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">建立需求</h1>
            <p className="hidden sm:block text-muted-foreground">代需求方建立需求，或根據口頭溝通內容登錄需求</p>
          </div>
        </div>

        {/* Step Indicator — Desktop */}
        <div className="hidden sm:flex items-center justify-center gap-3">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (step.id < currentStep) setCurrentStep(step.id)
                }}
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2 text-base font-medium transition-colors",
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : step.id < currentStep
                      ? "bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {step.id < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
                {step.title}
              </button>
              {i < steps.length - 1 && (
                <div className={cn("h-px w-10", step.id < currentStep ? "bg-emerald-300" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Step Indicator — Mobile */}
        <div className="flex sm:hidden items-center justify-between gap-1 px-1">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => { if (step.id < currentStep) setCurrentStep(step.id) }}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : step.id < currentStep
                      ? "bg-emerald-100 text-emerald-700 cursor-pointer"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {step.id < currentStep ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span>{step.id}</span>
                )}
                <span className={cn(currentStep === step.id ? "inline" : "hidden")}>{step.title}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={cn("h-px flex-1 min-w-1", step.id < currentStep ? "bg-emerald-300" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            {/* Step 1: 基本資訊 */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="subsidiary" className="text-sm sm:text-base">需求所屬子公司 <span className="text-red-500">*</span></Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger className="h-9 sm:h-11 w-full">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="選擇子公司" />
                      </div>
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

                {vendorOptions.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">開發商</Label>
                    <Select value={vendor} onValueChange={setVendor}>
                      <SelectTrigger className="h-9 sm:h-11 w-full">
                        <SelectValue placeholder="選擇開發商" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendorOptions.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm sm:text-base">需求標題 <span className="text-red-500">*</span></Label>
                  <Input
                    id="title"
                    placeholder="例如：客戶管理系統新增匯出功能"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 2: 需求內容 */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm sm:text-base">需求說明 <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="description"
                    placeholder="詳細描述需求的內容、範圍和具體要求..."
                    className="min-h-[80px] sm:min-h-[120px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="painPoint" className="text-sm sm:text-base">痛點說明 <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="painPoint"
                    placeholder="目前遇到什麼問題？對業務造成什麼影響？..."
                    className="min-h-[70px] sm:min-h-[100px]"
                    value={painPoint}
                    onChange={(e) => setPainPoint(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedBenefit" className="text-sm sm:text-base">預期效益</Label>
                  <Textarea
                    id="expectedBenefit"
                    placeholder="解決後預期帶來的效益、改善程度..."
                    className="min-h-[60px] sm:min-h-[80px]"
                    value={expectedBenefit}
                    onChange={(e) => setExpectedBenefit(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sp" className="text-sm sm:text-base">SP 估點 <span className="text-red-500">*</span></Label>
                  <Input
                    id="sp"
                    type="number"
                    placeholder="例如：13"
                    min={1}
                    value={estimatedSp}
                    onChange={(e) => setEstimatedSp(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">初步 Story Points 估算</p>
                </div>
              </div>
            )}

            {/* Step 3: 補充資訊 */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">希望完成時間</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? date.toLocaleDateString("zh-TW") : "選擇日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">參考時間，不具約束力</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">附件上傳</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    選擇檔案
                  </Button>
                  <p className="text-xs text-muted-foreground">支援 PDF, Word, Excel, PPT, Markdown, 圖片，單檔最大 10MB</p>
                  {fileError && <p className="text-xs text-red-600">{fileError}</p>}

                  {files.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {files.map((file, index) => {
                        const { icon: Icon, color } = getFileIcon(file.name)
                        return (
                        <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-lg border p-3">
                          <Icon className={cn("h-5 w-5 shrink-0", color)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm sm:text-base">備註</Label>
                  <Textarea
                    id="notes"
                    placeholder="額外補充說明..."
                    className="min-h-[60px] sm:min-h-[80px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 4: 確認內容 */}
            {currentStep === 4 && (
              <div className="space-y-4 sm:space-y-6">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 sm:px-4 sm:py-3">
                  <p className="text-xs sm:text-sm text-blue-700">請確認以下資訊無誤後建立需求</p>
                </div>

                {/* 基本資訊 */}
                <div className="space-y-2 sm:space-y-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground tracking-wide uppercase flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    基本資訊
                  </h3>
                  <div className="grid gap-2 sm:gap-4 md:grid-cols-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">子公司</p>
                      <p className="text-sm font-medium">{selectedOrg?.name || "—"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">開發商</p>
                      <p className="text-sm font-medium">{vendor}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">SP 估點</p>
                      <p className="text-sm font-medium">{estimatedSp} SP</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">需求標題</p>
                    <p className="text-sm font-medium">{title}</p>
                  </div>
                </div>

                <hr className="border-border" />

                {/* 需求內容 */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground tracking-wide uppercase flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    需求內容
                  </h3>
                  <div className="rounded-lg border border-border/60 p-3 sm:p-4 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">需求說明</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{description}</p>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 sm:p-4 space-y-1">
                    <p className="text-xs font-semibold text-orange-600">痛點說明</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{painPoint}</p>
                  </div>
                  {expectedBenefit && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 sm:p-4 space-y-1">
                      <p className="text-xs font-semibold text-emerald-600">預期效益</p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{expectedBenefit}</p>
                    </div>
                  )}
                </div>

                {(date || files.length > 0 || notes) && (
                  <>
                    <hr className="border-border" />

                    {/* 補充資訊 */}
                    <div className="space-y-2 sm:space-y-3">
                      <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground tracking-wide uppercase flex items-center gap-2">
                        <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        補充資訊
                      </h3>

                      {date && (
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground mb-1">希望完成時間</p>
                          <p className="text-sm font-medium flex items-center gap-2">
                            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {date.toLocaleDateString("zh-TW")}
                          </p>
                        </div>
                      )}

                      {files.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">附件（{files.length} 個檔案）</p>
                          <div className="space-y-1.5">
                            {files.map((file, index) => {
                              const { icon: Icon, color } = getFileIcon(file.name)
                              return (
                                <div key={`confirm-${file.name}-${index}`} className="flex items-center gap-2.5 rounded-md bg-muted/50 px-3 py-2">
                                  <Icon className={cn("h-4 w-4 shrink-0", color)} />
                                  <span className="text-sm truncate">{file.name}</span>
                                  <span className="text-xs text-muted-foreground shrink-0">({formatFileSize(file.size)})</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">備註</p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{notes}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {submitError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    {submitError}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 mt-4 sm:pt-6 sm:mt-6 border-t">
              {currentStep > 1 ? (
                <Button type="button" variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  上一步
                </Button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!canNext()}
                >
                  下一步
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      建立中...
                    </>
                  ) : (
                    <>
                      建立需求
                      <Check className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
