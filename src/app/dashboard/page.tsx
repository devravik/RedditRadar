import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ScoreBadge } from '@/components/score-badge'
import { StatusBadge } from '@/components/status-badge'
import { PipelineButtons } from '@/components/pipeline-buttons'
import { LeadStatus } from '@/types'

async function getLeads(status?: string) {
  return prisma.lead.findMany({
    where: status ? { status: status as LeadStatus } : undefined,
    include: {
      post: {
        include: {
          signal: { select: { matchScore: true, technologies: true, painPoints: true, summary: true } },
        },
      },
      messages: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

async function getUnanalyzedCount() {
  return prisma.post.count({ where: { signal: null } })
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const resolvedParams = await searchParams
  const [leads, unanalyzed] = await Promise.all([
    getLeads(resolvedParams.status),
    getUnanalyzedCount(),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} tracked · {unanalyzed} posts awaiting analysis</p>
        </div>
        <PipelineButtons />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4">
        {(['', 'NEW', 'CONTACTED', 'REPLIED', 'ARCHIVED'] as const).map(s => (
          <Link
            key={s}
            href={s ? `?status=${s}` : '/dashboard'}
            className={`px-3 py-1 rounded text-sm border ${
              (resolvedParams.status ?? '') === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {s || 'All'}
          </Link>
        ))}
      </div>

      {leads.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No leads yet</p>
          <p className="text-sm mt-1">Click &quot;Refresh Reddit&quot; then &quot;Analyze Posts&quot; to get started</p>
        </div>
      )}

      <div className="space-y-3">
        {leads.map(lead => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="block bg-white border rounded-lg px-5 py-4 hover:border-gray-400 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400">r/{lead.post.subreddit}</span>
                  {lead.post.signal && <ScoreBadge score={lead.post.signal.matchScore} />}
                  <StatusBadge status={lead.status as LeadStatus} />
                  {lead.messages.length > 0 && (
                    <span className="text-xs text-gray-400">{lead.messages.length} msg</span>
                  )}
                </div>
                <p className="font-medium text-gray-900 truncate">{lead.post.title}</p>
                {lead.post.signal?.summary && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{lead.post.signal.summary}</p>
                )}
                {lead.post.signal?.technologies && lead.post.signal.technologies.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {lead.post.signal.technologies.slice(0, 5).map(t => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(lead.post.postedAt).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
