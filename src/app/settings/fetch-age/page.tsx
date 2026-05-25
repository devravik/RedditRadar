import { prisma } from '@/lib/db'
import { MaxAgeEditor } from '@/components/max-age-editor'

export default async function FetchAgePage() {
  const setting = await prisma.setting.findUnique({ where: { key: 'FETCH_MAX_AGE_DAYS' } })
  const days = parseInt(setting?.value ?? '60', 10)

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Fetch Max Age</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Skip posts older than this many days when fetching from Reddit
        </p>
      </div>

      <div className="bg-white border rounded-lg p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Maximum post age</label>
        <MaxAgeEditor initialDays={days} />
      </div>
    </div>
  )
}
