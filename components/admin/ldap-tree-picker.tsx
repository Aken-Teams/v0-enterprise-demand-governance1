"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown, Search, Users, Building2, Loader2, AlertCircle, User as UserIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

/** Supported LDAP domains */
export const LDAP_DOMAIN_OPTIONS = [
  { code: "PANJIT", label: "PANJIT（強茂）" },
  { code: "PYNMAX", label: "PYNMAX（璟茂）" },
  { code: "WXPJ", label: "WXPJ（無錫強茂）" },
  { code: "GDPJ", label: "GDPJ（蘇州群鑫）" },
  { code: "PJWS", label: "PJWS（強茂深圳）" },
  { code: "PJXZ", label: "PJXZ（強茂徐州）" },
  { code: "PJSD", label: "PJSD（山東強茂）" },
] as const

export type LdapDomain = (typeof LDAP_DOMAIN_OPTIONS)[number]["code"]

export interface LdapMember {
  username: string
  displayName: string
}

export interface LdapOU {
  name: string
  dn: string
  type: "organization" | "ou"
  members: LdapMember[]
  memberCount: number
  children: LdapOU[]
  childCount: number
}

export interface LdapTreeResponse {
  success: boolean
  message?: string
  domain: string
  tree: LdapOU
  totalDepartments?: number
  totalMembers?: number
}

export interface LdapSelectedMember {
  username: string
  displayName: string
  domain: LdapDomain
  departmentName: string
  departmentDn: string
}

interface LdapTreePickerProps {
  /** Called when a member is clicked. If omitted, member rows are not clickable. */
  onSelectMember?: (member: LdapSelectedMember) => void
  /** Initial domain, default PANJIT */
  initialDomain?: LdapDomain
  /** Show the domain selector (default true) */
  showDomainSelector?: boolean
  /** Compact mode - smaller paddings and fonts */
  compact?: boolean
}

/** Recursive tree node row */
function TreeNode({
  ou,
  depth,
  expanded,
  toggleExpand,
  isVisible,
  matchedMemberIds,
  onSelectMember,
  domain,
  compact,
}: {
  ou: LdapOU
  depth: number
  expanded: Set<string>
  toggleExpand: (dn: string) => void
  isVisible: (ou: LdapOU) => boolean
  matchedMemberIds: Set<string> | null
  onSelectMember?: (member: LdapSelectedMember) => void
  domain: LdapDomain
  compact?: boolean
}) {
  if (!isVisible(ou)) return null
  const isOpen = expanded.has(ou.dn)
  const hasChildren = ou.children.length > 0 || ou.members.length > 0
  const padding = compact ? "py-1" : "py-1.5"
  const fontSize = compact ? "text-xs" : "text-sm"

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleExpand(ou.dn)}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 hover:bg-muted/60 rounded transition-colors text-left",
          padding,
          fontSize,
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <span className="truncate font-medium">{ou.name}</span>
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {ou.memberCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {ou.memberCount}
            </span>
          )}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Members */}
          {ou.members.map((m) => {
            const memberKey = `${ou.dn}|${m.username}`
            if (matchedMemberIds && !matchedMemberIds.has(memberKey)) return null
            return (
              <button
                key={memberKey}
                type="button"
                onClick={
                  onSelectMember
                    ? () =>
                        onSelectMember({
                          username: m.username,
                          displayName: m.displayName,
                          domain,
                          departmentName: ou.name,
                          departmentDn: ou.dn,
                        })
                    : undefined
                }
                disabled={!onSelectMember}
                className={cn(
                  "w-full flex items-center gap-1.5 px-2 text-left rounded transition-colors",
                  padding,
                  fontSize,
                  onSelectMember
                    ? "hover:bg-blue-50 cursor-pointer"
                    : "cursor-default",
                )}
                style={{ paddingLeft: `${depth * 16 + 28}px` }}
              >
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{m.displayName}</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono shrink-0">
                  {m.username}
                </span>
              </button>
            )
          })}

          {/* Child OUs */}
          {ou.children.map((child) => (
            <TreeNode
              key={child.dn}
              ou={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              isVisible={isVisible}
              matchedMemberIds={matchedMemberIds}
              onSelectMember={onSelectMember}
              domain={domain}
              compact={compact}
            />
          ))}
        </>
      )}
    </div>
  )
}

export function LdapTreePicker({
  onSelectMember,
  initialDomain = "PANJIT",
  showDomainSelector = true,
  compact = false,
}: LdapTreePickerProps) {
  const { token } = useAuth()
  const [domain, setDomain] = useState<LdapDomain>(initialDomain)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tree, setTree] = useState<LdapTreeResponse | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")

  const fetchTree = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    setTree(null)
    try {
      const res = await fetch(`/api/admin/ldap/tree?domain=${domain}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "載入失敗")
      } else {
        setTree(data as LdapTreeResponse)
        // Auto-expand root level
        setExpanded(new Set([data.tree.dn]))
      }
    } catch {
      setError("網路錯誤")
    } finally {
      setLoading(false)
    }
  }, [token, domain])

  useEffect(() => {
    fetchTree()
  }, [fetchTree])

  const toggleExpand = useCallback((dn: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(dn)) next.delete(dn)
      else next.add(dn)
      return next
    })
  }, [])

  /** Recursively collect DN set where either the OU name matches or contains matching members */
  const { matchedMemberIds, visibleDnSet, autoExpandDnSet } = useMemo(() => {
    if (!tree) {
      return { matchedMemberIds: null, visibleDnSet: null, autoExpandDnSet: null }
    }
    const q = search.trim().toLowerCase()
    if (!q) {
      return { matchedMemberIds: null, visibleDnSet: null, autoExpandDnSet: null }
    }

    const memberIds = new Set<string>()
    const visible = new Set<string>()
    const toExpand = new Set<string>()

    const walk = (ou: LdapOU, ancestors: string[]): boolean => {
      let hasMatch = false

      // Check members
      for (const m of ou.members) {
        const nameMatch = (m.displayName ?? "").toLowerCase().includes(q)
        const userMatch = (m.username ?? "").toLowerCase().includes(q)
        if (nameMatch || userMatch) {
          memberIds.add(`${ou.dn}|${m.username}`)
          hasMatch = true
        }
      }

      // OU name match
      const ouNameMatch = ou.name.toLowerCase().includes(q)
      if (ouNameMatch) hasMatch = true

      // Recurse children
      for (const child of ou.children) {
        if (walk(child, [...ancestors, ou.dn])) {
          hasMatch = true
        }
      }

      if (hasMatch) {
        visible.add(ou.dn)
        for (const a of ancestors) {
          visible.add(a)
          toExpand.add(a)
        }
        toExpand.add(ou.dn)
      }

      return hasMatch
    }

    walk(tree.tree, [])

    return {
      matchedMemberIds: memberIds,
      visibleDnSet: visible,
      autoExpandDnSet: toExpand,
    }
  }, [tree, search])

  // When searching, auto expand matching branches
  useEffect(() => {
    if (autoExpandDnSet) {
      setExpanded((prev) => {
        const next = new Set(prev)
        autoExpandDnSet.forEach((dn) => next.add(dn))
        return next
      })
    }
  }, [autoExpandDnSet])

  const isVisible = useCallback(
    (ou: LdapOU) => {
      if (!visibleDnSet) return true
      return visibleDnSet.has(ou.dn)
    },
    [visibleDnSet]
  )

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* Domain selector + search + refresh */}
      <div className="flex items-center gap-2">
        {showDomainSelector && (
          <Select value={domain} onValueChange={(v) => setDomain(v as LdapDomain)}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LDAP_DOMAIN_OPTIONS.map((opt) => (
                <SelectItem key={opt.code} value={opt.code}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋部門或成員..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTree}
          disabled={loading}
          className="h-9 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "重新載入"}
        </Button>
      </div>

      {/* Stats */}
      {tree && !loading && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {tree.totalDepartments ?? 0} 部門
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {tree.totalMembers ?? 0} 成員
          </span>
          {search && matchedMemberIds && (
            <span className="text-blue-600">已找到 {matchedMemberIds.size} 位符合成員</span>
          )}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 min-h-0 border rounded-md bg-background overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            載入中...
          </div>
        )}
        {error && !loading && (
          <div className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">無法載入組織架構</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </div>
        )}
        {tree && !loading && !error && (
          <div className="py-1">
            <TreeNode
              ou={tree.tree}
              depth={0}
              expanded={expanded}
              toggleExpand={toggleExpand}
              isVisible={isVisible}
              matchedMemberIds={matchedMemberIds}
              onSelectMember={onSelectMember}
              domain={domain}
              compact={compact}
            />
          </div>
        )}
      </div>
    </div>
  )
}
