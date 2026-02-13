"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarIcon, Upload, Building2, HelpCircle, ChevronRight, ChevronLeft, Check, FileText, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

const subsidiaries = [
  { id: "panjit", name: "強茂" },
  { id: "panjit-tech", name: "璟茂科技" },
  { id: "ymoptics", name: "熒茂光學" },
  { id: "panjit-wuxi", name: "強茂電子（無錫）" },
  { id: "panjit-xuzhou", name: "強茂半導體（徐州）" },
  { id: "panjit-shandong", name: "山東強茂電子" },
  { id: "hge", name: "虹冠電子工業" },
]

const steps = [
  { id: 1, title: "基本資訊", icon: Building2 },
  { id: 2, title: "需求內容", icon: FileText },
  { id: 3, title: "補充資訊", icon: Settings2 },
]

export default function CreateDemandPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [date, setDate] = useState<Date>()
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [purpose, setPurpose] = useState("")

  const canNext = () => {
    if (currentStep === 1) return selectedSubsidiary !== "" && title.trim() !== ""
    if (currentStep === 2) return description.trim() !== "" && purpose.trim() !== ""
    return true
  }

  return (
    <AppLayout userRole="admin">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">建立需求</h1>
            <p className="text-muted-foreground">代需求者建立需求，或根據口頭溝通內容登錄需求</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-sm space-y-1 p-3">
                <p>• 建立後系統將自動通知需求者確認</p>
                <p>• 需求者確認後即可正式開案</p>
                <p>• 管理者備註僅內部可見</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3">
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

        {/* Step Content */}
        <Card>
          <CardContent className="pt-6">
            {/* Step 1: 基本資訊 */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="subsidiary">需求所屬子公司 *</Label>
                  <Select value={selectedSubsidiary} onValueChange={setSelectedSubsidiary}>
                    <SelectTrigger className="h-11 w-full">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="選擇子公司" />
                      </div>
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

                <div className="space-y-2">
                  <Label htmlFor="title">需求標題 *</Label>
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
                  <Label htmlFor="description">需求說明 *</Label>
                  <Textarea
                    id="description"
                    placeholder="詳細描述需求的內容、範圍和具體要求..."
                    className="min-h-[120px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purpose">商業目的 / 預期效益 *</Label>
                  <Textarea
                    id="purpose"
                    placeholder="說明此需求對業務的價值，預期帶來的效益..."
                    className="min-h-[100px]"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 3: 補充資訊 */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sp">初步 SP 估點</Label>
                    <Input id="sp" type="number" placeholder="例如：13" min={1} />
                    <p className="text-xs text-muted-foreground">初步 Story Points 估算</p>
                  </div>

                  <div className="space-y-2">
                    <Label>希望完成時間</Label>
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attachments">附件上傳</Label>
                  <Button type="button" variant="outline" className="w-full bg-transparent">
                    <Upload className="mr-2 h-4 w-4" />
                    選擇檔案
                  </Button>
                  <p className="text-xs text-muted-foreground">支援 PDF, Word, Excel, 圖片，單檔最大 10MB</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">管理者備註</Label>
                  <Textarea
                    id="notes"
                    placeholder="內部備註，僅管理者可見..."
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t">
              {currentStep > 1 ? (
                <Button type="button" variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  上一步
                </Button>
              ) : (
                <div />
              )}

              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!canNext()}
                >
                  下一步
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" variant="outline">
                    儲存草稿
                  </Button>
                  <Button type="submit">
                    建立需求
                    <Check className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
