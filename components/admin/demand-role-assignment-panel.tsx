"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, FolderOpen, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SIGNOFF_ROLE_LABELS } from "@/lib/constants/demand"

export type SignoffRole = "REQUESTER" | "MANAGER" | "BOARD" | "OBSERVER"

export interface DemandAssignment {
  demandId: string
  signoffRole: SignoffRole
}

export interface DemandOption {
  id: string
  demandNumber: string
  title: string
  status: string
  organization?: string
}

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700",
  PRD_REVIEW: "bg-amber-50 text-amber-700",
  SP_REVIEW: "bg-orange-50 text-orange-700",
  DEVELOPING: "bg-violet-50 text-violet-700",
  ACCEPTANCE: "bg-purple-50 text-purple-700",
  CLOSED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "需求確認",
  PRD_REVIEW: "MVP 確認",
  SP_REVIEW: "開案確認",
  DEVELOPING: "開發中",
  ACCEPTANCE: "驗收中",
  CLOSED: "已結案",
  REJECTED: "已駁回",
}

const ROLE_OPTIONS: { value: SignoffRole; label: string }[] = [
  { value: "OBSERVER", label: "觀察者" },
  { value: "REQUESTER", label: "需求者" },
  { value: "MANAGER", label: "主管" },
]

interface DemandRoleAssignmentPanelProps {
  value: DemandAssignment[]
  onChange: (assignments: DemandAssignment[]) => void
  allDemands: DemandOption[]
  loading?: boolean
}

export function DemandRoleAssignmentPanel({
  value,
  onChange,
  allDemands,
  loading = false,
}: DemandRoleAssignmentPanelProps) {
  const [search, setSearch] = useState("")
  const [orgFilter, setOrgFilter] = useState("all")

  const assignmentMap = useMemo(() => {
    const map = new Map<string, SignoffRole>()
    for (const a of value) map.set(a.demandId, a.signoffRole)
    return map
  }, [value])

  // Unique organization names for filter dropdown
  const orgOptions = useMemo(() => {
    const set = new Set<string>()
    for (const d of allDemands) if (d.organization) set.add(d.organization)
    return Array.from(set).sort()
  }, [allDemands])

  const filteredDemands = useMemo(() => {
    let list = allDemands
    if (orgFilter !== "all") {
      list = list.filter((d) => d.organization === orgFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (d) =>
          d.demandNumber.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q),
      )
    }
    return list
  }, [allDemands, search, orgFilter])

  const summary = useMemo(() => {
    const counts: Record<string, number> = { REQUESTER: 0, MANAGER: 0, BOARD: 0, OBSERVER: 0 }
    for (const a of value) counts[a.signoffRole] = (counts[a.signoffRole] || 0) + 1
    return counts
  }, [value])

  const toggleDemand = (demandId: string, checked: boolean) => {
    if (checked) {
      onChange([...value, { demandId, signoffRole: "OBSERVER" }])
    } else {
      onChange(value.filter((a) => a.demandId !== demandId))
    }
  }

  const changeRole = (demandId: string, role: SignoffRole) => {
    onChange(value.map((a) => (a.demandId === demandId ? { ...a, signoffRole: role } : a)))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        載入專案清單中...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* Summary */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="text-muted-foreground">已選 {value.length} 個專案</span>
        {value.length > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            {summary.REQUESTER > 0 && (
              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                {SIGNOFF_ROLE_LABELS.REQUESTER} {summary.REQUESTER}
              </Badge>
            )}
            {summary.MANAGER > 0 && (
              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                {SIGNOFF_ROLE_LABELS.MANAGER} {summary.MANAGER}
              </Badge>
            )}
            {summary.BOARD > 0 && (
              <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700">
                {SIGNOFF_ROLE_LABELS.BOARD} {summary.BOARD}
              </Badge>
            )}
            {summary.OBSERVER > 0 && (
              <Badge variant="secondary" className="text-xs bg-gray-50 text-gray-600">
                {SIGNOFF_ROLE_LABELS.OBSERVER} {summary.OBSERVER}
              </Badge>
            )}
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {orgOptions.length > 1 && (
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs shrink-0">
              <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="全部組織" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">全部組織</SelectItem>
              {orgOptions.map((org) => (
                <SelectItem key={org} value={org} className="text-xs">{org}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋專案編號或標題..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Demand list */}
      <div className="flex-1 min-h-0 border rounded-md bg-background overflow-y-auto max-h-[360px]">
        {filteredDemands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="h-8 w-8 mb-2" />
            <p className="text-sm">{search ? "無符合的專案" : "目前沒有可指派的專案"}</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredDemands.map((d) => {
              const isChecked = assignmentMap.has(d.id)
              const role = assignmentMap.get(d.id)
              return (
                <div
                  key={d.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors",
                    isChecked ? "bg-blue-50/50" : "hover:bg-muted/40",
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => toggleDemand(d.id, !!checked)}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {d.demandNumber}
                      </span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded", STATUS_BADGE[d.status] || "bg-gray-100 text-gray-600")}>
                        {STATUS_LABEL[d.status] || d.status}
                      </span>
                      {d.organization && (
                        <span className="text-[10px] text-muted-foreground">
                          {d.organization}
                        </span>
                      )}
                    </div>
                    <p className="text-sm truncate mt-0.5">{d.title}</p>
                  </div>
                  {isChecked && (
                    <Select
                      value={role}
                      onValueChange={(v) => changeRole(d.id, v as SignoffRole)}
                    >
                      <SelectTrigger className="w-[100px] h-8 text-xs shrink-0 bg-blue-50 border-blue-200 text-blue-700 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
