"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { CalendarIcon, Upload, Building2 } from "lucide-react"
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

export default function CreateDemandPage() {
  const [date, setDate] = useState<Date>()
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("")

  return (
    <AppLayout userRole="admin">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">建立需求</h1>
          <p className="text-muted-foreground">代需求者建立需求，或根據口頭溝通內容登錄需求</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>需求資訊</CardTitle>
            <CardDescription>請選擇需求所屬子公司並填寫詳細資訊</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6">
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
                <Input id="title" placeholder="例如：客戶管理系統新增匯出功能" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">需求說明 *</Label>
                <Textarea
                  id="description"
                  placeholder="詳細描述需求的內容、範圍和具體要求..."
                  className="min-h-[120px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">商業目的 / 預期效益 *</Label>
                <Textarea
                  id="purpose"
                  placeholder="說明此需求對業務的價值，預期帶來的效益..."
                  className="min-h-[100px]"
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sp">初步 SP 估點</Label>
                  <Input id="sp" type="number" placeholder="例如：13" min={1} />
                  <p className="text-xs text-muted-foreground">管理者可在此直接給出初步 Story Points 估算</p>
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
                  <p className="text-xs text-muted-foreground">此為參考時間，不具約束力</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attachments">附件上傳</Label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" className="w-full bg-transparent">
                    <Upload className="mr-2 h-4 w-4" />
                    選擇檔案
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">支援 PDF, Word, Excel, 圖片檔案，單檔最大 10MB</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">管理者備註</Label>
                <Textarea
                  id="notes"
                  placeholder="內部備註，僅管理者可見（例如：與需求者電話溝通後記錄）..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  建立需求並通知需求者確認
                </Button>
                <Button type="button" variant="outline">
                  儲存草稿
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-base">建立流程說明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 建立後系統將自動通知需求者確認需求內容與 SP 估點</p>
            <p>• 需求者確認後即可正式開案，分配給 JV 團隊執行</p>
            <p>• 若需求者提出修改，您將收到通知進行調整</p>
            <p>• 管理者備註僅內部可見，不會顯示給需求者</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
