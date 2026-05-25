'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Interval = 'HOURLY' | 'DAILY' | 'WEEKLY'

const LABELS: Record<Interval, string> = {
  HOURLY: 'Hourly',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
}

export function IntervalSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter()
  const [current, setCurrent] = useState(value as Interval)

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Interval
    setCurrent(next)
    await fetch(`/api/subreddits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fetchInterval: next }),
    })
    router.refresh()
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="text-sm border rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
    >
      {(Object.keys(LABELS) as Interval[]).map(k => (
        <option key={k} value={k}>{LABELS[k]}</option>
      ))}
    </select>
  )
}
