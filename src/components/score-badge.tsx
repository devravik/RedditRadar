function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 border-green-200'
  if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (score >= 40) return 'bg-orange-100 text-orange-800 border-orange-200'
  return 'bg-red-100 text-red-800 border-red-200'
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${scoreColor(score)}`}>
      {score}%
    </span>
  )
}
