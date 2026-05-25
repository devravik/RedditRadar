import { LeadStatus } from '@/types'

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800 border-blue-200',
  CONTACTED: 'bg-purple-100 text-purple-800 border-purple-200',
  REPLIED: 'bg-green-100 text-green-800 border-green-200',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}
