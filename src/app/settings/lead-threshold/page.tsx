import { prisma } from '@/lib/db'
import { LeadThresholdEditor } from '@/components/lead-threshold-editor'

export default async function LeadThresholdPage() {
  const setting = await prisma.setting.findUnique({ where: { key: 'LEAD_THRESHOLD' } })
  const threshold = parseInt(setting?.value ?? '70', 10)

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Lead Threshold</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Automatically create a lead when a post&apos;s AI match score is at or above this value
        </p>
      </div>

      <div className="bg-white border rounded-lg p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Minimum match score</label>
        <LeadThresholdEditor initialThreshold={threshold} />
      </div>
    </div>
  )
}
