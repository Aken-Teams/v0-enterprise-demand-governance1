"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"

interface DemandForEdit {
  id: string
  demandNumber: string
  title: string
  description: string
  painPoint: string | null
  expectedBenefit: string | null
  estimatedSp: number
  desiredDate: string | null
  adminNotes: string | null
  submitter: { id: string; name: string }
  organization: { id: string; name: string }
}

/** Convert ISO date string to yyyy-MM-dd using local timezone to avoid UTC off-by-one */
function toDateInput(val: string | null) {
  if (!val) return ""
  const d = new Date(val)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function EditDemandPage() {
  const { token } = useAuth()
  const params = useParams()
  const router = useRouter()
  const demandId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [demand, setDemand] = useState<DemandForEdit | null>(null)
  const [orgUsers, setOrgUsers] = useState<{ id: string; name: string }[]>([])

  // Form state
  const [title, setTitle] = useState("")
  const [submitterId, setSubmitterId] = useState("")
  const [description, setDescription] = useState("")
  const [painPoint, setPainPoint] = useState("")
  const [expectedBenefit, setExpectedBenefit] = useState("")
  const [estimatedSp, setEstimatedSp] = useState("")
  const [desiredDate, setDesiredDate] = useState("")
  const [adminNotes, setAdminNotes] = useState("")

  const fetchDemand = useCallback(async () => {
    if (!token || !demandId) return
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok && data.demand) {
        const d = data.demand as DemandForEdit
        setDemand(d)
        setTitle(d.title)
        setSubmitterId(d.submitter.id)
        setDescription(d.description)
        setPainPoint(d.painPoint || "")
        setExpectedBenefit(d.expectedBenefit || "")
        setEstimatedSp(String(d.estimatedSp))
        setDesiredDate(toDateInput(d.desiredDate))
        setAdminNotes(d.adminNotes || "")
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [token, demandId])

  useEffect(() => {
    fetchDemand()
  }, [fetchDemand])

  // Fetch organization users for submitter dropdown
  useEffect(() => {
    if (!token || !demand) return
    fetch("/api/organizations", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.organizations) {
          const org = data.organizations.find((o: { id: string }) => o.id === demand.organization.id)
          if (org?.users) setOrgUsers(org.users)
        }
      })
      .catch(() => {})
  }, [token, demand])

  const handleSave = async () => {
    if (!token || !demand) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/demands/${demand.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          submitterId,
          description,
          painPoint,
          expectedBenefit,
          estimatedSp,
          desiredDate: desiredDate || null,
          adminNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "儲存失敗")
        return
      }
      router.push(`/governance/demands/${demand.id}`)
    } catch {
      setError("網路錯誤，請稍後再試")
    } finally {
      setSaving(false)
    }
  }

  const canSave = title.trim() !== "" && description.trim() !== "" && painPoint.trim() !== "" && estimatedSp.trim() !== ""

  if (loading) {
    return (
      <AppLayout userRole="admin">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (!demand) {
    return (
      <AppLayout userRole="admin">
        <div className="flex flex-col items-center justify-center py-32">
          <p className="text-muted-foreground mb-4">需求不存在或已被刪除</p>
          <Button variant="outline" asChild>
            <Link href="/governance/inbox"><ArrowLeft className="mr-2 h-4 w-4" />返回列表</Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout userRole="admin">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/governance/demands/${demand.id}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <p className="text-sm font-mono text-muted-foreground">{demand.demandNumber}</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">編輯需求</h1>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">基本資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">需求標題 <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="需求標題"
              />
            </div>

            <div className="space-y-2">
              <Label>需求者</Label>
              <Select value={submitterId} onValueChange={setSubmitterId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇需求者" />
                </SelectTrigger>
                <SelectContent>
                  {/* Always show current submitter even if not in org users list */}
                  {!orgUsers.some((u) => u.id === demand.submitter.id) && (
                    <SelectItem value={demand.submitter.id}>{demand.submitter.name}</SelectItem>
                  )}
                  {orgUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">所屬子公司：{demand.organization.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sp">SP 估點 <span className="text-red-500">*</span></Label>
                <Input
                  id="sp"
                  type="number"
                  min={1}
                  value={estimatedSp}
                  onChange={(e) => setEstimatedSp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desiredDate">希望完成時間</Label>
                <Input
                  id="desiredDate"
                  type="date"
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">需求內容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="description">需求說明 <span className="text-red-500">*</span></Label>
              <Textarea
                id="description"
                className="min-h-[120px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="詳細描述需求的內容、範圍和具體要求..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="painPoint">痛點說明 <span className="text-red-500">*</span></Label>
              <Textarea
                id="painPoint"
                className="min-h-[80px]"
                value={painPoint}
                onChange={(e) => setPainPoint(e.target.value)}
                placeholder="目前遇到什麼問題？對業務造成什麼影響？..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedBenefit">預期效益</Label>
              <Textarea
                id="expectedBenefit"
                className="min-h-[80px]"
                value={expectedBenefit}
                onChange={(e) => setExpectedBenefit(e.target.value)}
                placeholder="解決後預期帶來的效益..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminNotes">管理者備註</Label>
              <Textarea
                id="adminNotes"
                className="min-h-[80px]"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="內部備註..."
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Button variant="outline" asChild>
            <Link href={`/governance/demands/${demand.id}`}>取消</Link>
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            儲存變更
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
