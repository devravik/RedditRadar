import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ScoreBadge } from '@/components/score-badge'
import { StatusBadge } from '@/components/status-badge'
import { OutreachPanel } from '@/components/outreach-panel'
import { LeadStatus, MessageType } from '@/types'

async function getLead(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      post: {
        include: { signal: true }
      },
      messages: { orderBy: { createdAt: 'desc' } },
    },
  })
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = await getLead(id)
  if (!lead) notFound()

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Dashboard
      </Link>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-400">r/{lead.post.subreddit}</span>
          {lead.post.signal && <ScoreBadge score={lead.post.signal.matchScore} />}
          <StatusBadge status={lead.status as LeadStatus} />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">{lead.post.title}</h1>
        <p className="text-sm text-gray-500 mb-4">
          by u/{lead.post.author} · {new Date(lead.post.postedAt).toLocaleDateString()}
        </p>

        {lead.post.body && (
          <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-4 mb-4 max-h-48 overflow-y-auto">
            {lead.post.body}
          </div>
        )}

        <a
          href={lead.post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          View on Reddit →
        </a>
      </div>

      {lead.post.signal && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-semibold mb-3">AI Analysis</h2>
          <p className="text-sm text-gray-700 mb-3">{lead.post.signal.summary}</p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Technologies</p>
              <div className="flex flex-wrap gap-1">
                {lead.post.signal.technologies.map(t => (
                  <span key={t} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Pain Points</p>
              <div className="flex flex-wrap gap-1">
                {lead.post.signal.painPoints.map(p => (
                  <span key={p} className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs">{p}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Remote</p>
              <p>{lead.post.signal.remote ? 'Yes' : 'No/Unknown'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Stage</p>
              <p className="capitalize">{lead.post.signal.startupStage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6">
        <h2 className="font-semibold mb-4">Generate Outreach</h2>
        {lead.post.signal ? (
          <OutreachPanel
            leadId={lead.id}
            existingMessages={lead.messages.map(m => ({
              id: m.id,
              type: m.type as MessageType,
              content: m.content,
            }))}
          />
        ) : (
          <p className="text-sm text-gray-500">This post has not been analyzed yet. Run analysis from the dashboard.</p>
        )}
      </div>
    </div>
  )
}
