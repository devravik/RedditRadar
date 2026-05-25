import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ScoreBadge } from '@/components/score-badge'
import { AnalyzePostButton } from '@/components/analyze-post-button'
import Link from 'next/link'

export default async function PostPage({
  params,
}: {
  params: Promise<{ redditId: string }>
}) {
  const { redditId } = await params

  const post = await prisma.post.findUnique({
    where: { redditId },
    include: {
      signal: true,
      lead: { select: { id: true, status: true } },
    },
  })

  if (!post) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link href="/posts" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        &larr; Back to posts
      </Link>

      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <span>r/{post.subreddit}</span>
          <span>&middot;</span>
          <span>{new Date(post.postedAt).toLocaleDateString()}</span>
          <span>&middot;</span>
          <span>by {post.author}</span>
        </div>

        <h1 className="text-xl font-semibold mb-4">{post.title}</h1>

        {post.body && (
          <div className="text-sm text-gray-700 whitespace-pre-wrap mb-6 leading-relaxed">
            {post.body}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
          <span>&uarr; {post.score} points</span>
          <span>{post.numComments} comments</span>
        </div>

        <a
          href={`https://www.reddit.com/r/${post.subreddit}/comments/${post.redditId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-blue-600 hover:underline mb-6"
        >
          View on Reddit &rarr;
        </a>

        {post.signal ? (
          <div className="border-t pt-4 mt-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Analysis</h2>

            <div className="flex items-center gap-3 mb-3">
              <ScoreBadge score={post.signal.matchScore} />
              {post.lead && (
                <Link href={`/leads/${post.lead.id}`}>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                    Lead ({post.lead.status})
                  </span>
                </Link>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-3">{post.signal.summary}</p>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400">Technologies</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {post.signal.technologies.length > 0
                    ? post.signal.technologies.map(t => (
                      <span key={t} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>
                    ))
                    : <span className="text-gray-300">-</span>}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Pain Points</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {post.signal.painPoints.length > 0
                    ? post.signal.painPoints.map(p => (
                      <span key={p} className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{p}</span>
                    ))
                    : <span className="text-gray-300">-</span>}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Seniority</span>
                <p className="text-gray-700 mt-1 capitalize">{post.signal.seniority}</p>
              </div>
              <div>
                <span className="text-gray-400">Remote</span>
                <p className="text-gray-700 mt-1">{post.signal.remote ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-gray-400">Stage</span>
                <p className="text-gray-700 mt-1 capitalize">{post.signal.startupStage}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t pt-4 mt-2">
            <p className="text-sm text-gray-400 mb-3">Not yet analyzed</p>
            <AnalyzePostButton postId={post.id} />
          </div>
        )}
      </div>
    </div>
  )
}
