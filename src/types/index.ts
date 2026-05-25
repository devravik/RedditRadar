export type LeadStatus = 'NEW' | 'CONTACTED' | 'REPLIED' | 'ARCHIVED'
export type MessageType = 'REDDIT_DM' | 'EMAIL' | 'LINKEDIN'

export interface RedditPost {
  id: string          // Reddit's own ID (e.g. "t3_abc123")
  subreddit: string
  title: string
  selftext: string
  author: string
  url: string
  created_utc: number // Unix timestamp
  score: number
  num_comments: number
}

export interface AnalysisResult {
  technologies: string[]
  painPoints: string[]
  seniority: string
  remote: boolean
  startupStage: string
  matchScore: number  // 0-100
  summary: string
}

export type { FetchInterval } from '@prisma/client'
