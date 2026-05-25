import { prisma } from '@/lib/db'
import { BlockedKeywordList } from '@/components/blocked-keyword-list'

export default async function FiltersPage() {
  const keywords = await prisma.blockedKeyword.findMany({ orderBy: { word: 'asc' } })

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Filter Words</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Posts containing any of these words in the title or body will be skipped during import
        </p>
      </div>

      <BlockedKeywordList initial={keywords} />
    </div>
  )
}
