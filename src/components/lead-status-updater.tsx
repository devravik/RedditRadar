'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LeadStatus } from '@/types'
import { StatusBadge } from '@/components/status-badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'REPLIED', 'ARCHIVED']

export function LeadStatusUpdater({ leadId, currentStatus }: { leadId: string; currentStatus: LeadStatus }) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)

  const handleChange = useCallback(async (next: LeadStatus | null) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setStatus(next as LeadStatus)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }, [leadId, router])

  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={status} />
      <Select value={status} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map(s => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
