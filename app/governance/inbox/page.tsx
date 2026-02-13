"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Inbox, Plus } from "lucide-react"
import Link from "next/link"

export default function InboxPage() {
  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">需求管理</h1>
            <p className="text-muted-foreground">建立與追蹤所有需求的開案流程</p>
          </div>
          <Button asChild>
            <Link href="/governance/create">
              <Plus className="mr-2 h-4 w-4" />
              建立需求
            </Link>
          </Button>
        </div>

        {/* Summary Cards - 整體管線狀態 */}
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="flex items-center gap-4 py-2.5">
              <div className="text-3xl font-bold text-foreground">0</div>
              <div>
                <div className="text-sm font-medium text-foreground leading-tight">全部需求</div>
                <div className="text-xs text-muted-foreground mt-0.5">累計建立</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="flex items-center gap-4 py-2.5">
              <div className="text-3xl font-bold text-foreground">0</div>
              <div>
                <div className="text-sm font-medium text-foreground leading-tight">確認階段</div>
                <div className="text-xs text-muted-foreground mt-0.5">需求 / MVP / 開案</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="flex items-center gap-4 py-2.5">
              <div className="text-3xl font-bold text-foreground">0</div>
              <div>
                <div className="text-sm font-medium text-foreground leading-tight">開發中</div>
                <div className="text-xs text-muted-foreground mt-0.5">開發 + 驗收</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="flex items-center gap-4 py-2.5">
              <div className="text-3xl font-bold text-foreground">0</div>
              <div>
                <div className="text-sm font-medium text-foreground leading-tight">已結案</div>
                <div className="text-xs text-muted-foreground mt-0.5">驗收完成</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 篩選 + 列表 */}
        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="all">全部 (0)</TabsTrigger>
              <TabsTrigger value="submitted">需求確認 (0)</TabsTrigger>
              <TabsTrigger value="prd_review">MVP 架構確認 (0)</TabsTrigger>
              <TabsTrigger value="sp_review">開案確認 (0)</TabsTrigger>
              <TabsTrigger value="developing">開發中 (0)</TabsTrigger>
              <TabsTrigger value="acceptance">驗收中 (0)</TabsTrigger>
              <TabsTrigger value="closed">已結案 (0)</TabsTrigger>
              <TabsTrigger value="rejected">已駁回 (0)</TabsTrigger>
            </TabsList>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="搜尋需求標題、編號或子公司..." className="pl-9" />
            </div>
          </div>

          {["all", "submitted", "prd_review", "sp_review", "developing", "acceptance", "closed", "rejected"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">尚無資料</p>
                  {tab === "all" && (
                    <Button variant="outline" className="mt-4" asChild>
                      <Link href="/governance/create">
                        <Plus className="mr-2 h-4 w-4" />
                        建立第一筆需求
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  )
}
