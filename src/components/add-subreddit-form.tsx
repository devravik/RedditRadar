'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AddSubredditForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [interval, setInterval] = useState('DAILY')
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), fetchInterval: interval }),
      })
      if (!res.ok) {
        const data = await res.json()
        Swal.fire({ icon: 'error', title: data.error ?? 'Failed to add subreddit', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
        return
      }
      setName('')
      Swal.fire({ icon: 'success', title: `r/${name.trim()} added`, toast: true, position: 'top-end', timer: 2500, showConfirmButton: false })
      router.refresh()
    } catch {
      Swal.fire({ icon: 'error', title: 'Network error', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="startups or r/startups"
        className="w-48 text-sm h-8"
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />
      <select
        value={interval}
        onChange={e => setInterval(e.target.value)}
        className="text-sm border rounded px-2 py-1 bg-white text-gray-700 h-8 focus:outline-none"
      >
        <option value="HOURLY">Hourly</option>
        <option value="DAILY">Daily</option>
        <option value="WEEKLY">Weekly</option>
      </select>
      <Button onClick={handleAdd} disabled={loading || !name.trim()} size="sm" className="h-8">
        {loading ? 'Adding…' : 'Add'}
      </Button>
    </div>
  )
}
