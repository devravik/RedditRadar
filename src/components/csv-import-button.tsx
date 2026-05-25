'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'
import { Button } from '@/components/ui/button'

export function CsvImportButton() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const text = await file.text()
      const res = await fetch('/api/subreddits/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      })
      const data = await res.json()
      if (res.ok) {
        Swal.fire({ icon: 'success', title: `${data.added} added, ${data.skipped} skipped`, toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
        router.refresh()
      } else {
        Swal.fire({ icon: 'error', title: data.error ?? 'Import failed', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Network error during import', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="hidden"
        id="csv-import-input"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {loading ? 'Importing…' : 'Import CSV'}
      </Button>
    </div>
  )
}
