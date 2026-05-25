import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SubredditToggle } from '@/components/subreddit-toggle'
import { IntervalSelect } from '@/components/interval-select'
import { AddSubredditForm } from '@/components/add-subreddit-form'
import { DeleteSubredditButton } from '@/components/delete-subreddit-button'
import { CsvImportButton } from '@/components/csv-import-button'

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default async function SubredditsSettingsPage() {
  const subreddits = await prisma.subreddit.findMany({ orderBy: { name: 'asc' } })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Subreddits</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {subreddits.length} subreddits &middot; manage which are monitored and how often
        </p>
      </div>

      <div className="bg-white border rounded-lg mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left">Subreddit</th>
              <th className="px-4 py-2.5 text-left">Enabled</th>
              <th className="px-4 py-2.5 text-left">Interval</th>
              <th className="px-4 py-2.5 text-left">Last Fetched</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {subreddits.map(sub => (
              <tr key={sub.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-800">r/{sub.name}</td>
                <td className="px-4 py-3">
                  <SubredditToggle id={sub.id} enabled={sub.enabled} />
                </td>
                <td className="px-4 py-3">
                  <IntervalSelect id={sub.id} value={sub.fetchInterval} />
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {sub.lastFetchedAt ? formatRelative(sub.lastFetchedAt) : 'never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteSubredditButton id={sub.id} name={sub.name} />
                </td>
              </tr>
            ))}
            {subreddits.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No subreddits yet &mdash; add one below
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t bg-gray-50">
          <AddSubredditForm />
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-medium text-sm mb-3">CSV</h2>
        <div className="flex gap-3 items-center flex-wrap">
          <Link
            href="/api/subreddits/export"
            className="text-sm px-3 py-1.5 border rounded hover:border-gray-400 transition-colors"
          >
            Export CSV
          </Link>
          <CsvImportButton />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          CSV format: <code>name,enabled,fetchInterval</code> &mdash; import adds new subreddits only, never overwrites
        </p>
      </div>
    </div>
  )
}
