import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, Download, Search, BookOpen, FileCheck } from "lucide-react"

const documents = [
  {
    category: "治理規範",
    items: [
      { name: "需求提交指南", type: "PDF", size: "2.4 MB", updated: "2024-01-15" },
      { name: "Story Points 估算準則", type: "PDF", size: "1.8 MB", updated: "2024-01-10" },
      { name: "驗收標準與流程", type: "PDF", size: "1.5 MB", updated: "2023-12-20" },
    ],
  },
  {
    category: "操作手冊",
    items: [
      { name: "系統使用手冊", type: "PDF", size: "5.2 MB", updated: "2024-01-01" },
      { name: "需求評估作業指引", type: "DOCX", size: "892 KB", updated: "2023-12-15" },
      { name: "Sprint 規劃流程", type: "PDF", size: "1.2 MB", updated: "2023-12-10" },
    ],
  },
  {
    category: "表單範本",
    items: [
      { name: "需求規格書範本", type: "DOCX", size: "156 KB", updated: "2023-11-20" },
      { name: "驗收檢核表範本", type: "XLSX", size: "98 KB", updated: "2023-11-15" },
      { name: "技術債記錄表", type: "XLSX", size: "124 KB", updated: "2023-11-10" },
    ],
  },
]

export default function DocumentsPage() {
  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">文件與規範</h1>
          <p className="text-muted-foreground">查閱治理規範、操作手冊與範本文件</p>
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">治理規範</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">3</div>
              <p className="text-xs text-muted-foreground">核心文件</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">操作手冊</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">3</div>
              <p className="text-xs text-muted-foreground">使用指南</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">表單範本</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">3</div>
              <p className="text-xs text-muted-foreground">可下載範本</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="搜尋文件名稱..." className="pl-9" />
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        {documents.map((section) => (
          <Card key={section.category}>
            <CardHeader>
              <CardTitle className="text-base">{section.category}</CardTitle>
              <CardDescription>{section.items.length} 份文件</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {section.items.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{doc.name}</h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {doc.type}
                          </Badge>
                          <span>{doc.size}</span>
                          <span>更新: {doc.updated}</span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      下載
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Help */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">需要協助？</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 如果找不到所需文件，請聯繫系統管理員</p>
            <p>• 建議定期檢視治理規範更新，確保符合最新標準</p>
            <p>• 使用範本可以提升需求提交的品質與效率</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
