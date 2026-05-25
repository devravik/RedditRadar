import OpenAI from 'openai'
import { MessageType } from '@/types'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const TONE_BY_TYPE: Record<MessageType, string> = {
  REDDIT_DM: 'a casual Reddit DM — short, developer-to-developer, no marketing fluff, 3–5 sentences max',
  EMAIL: 'a brief cold email — subject line on first line, 4–6 sentences, direct and respectful',
  LINKEDIN: 'a LinkedIn connection message — under 300 characters, direct value hook, no buzzwords',
}

interface PostContext {
  title: string
  body: string
  author: string
  subreddit: string
}

interface SignalContext {
  technologies: string[]
  painPoints: string[]
  startupStage: string
  summary: string
}

export async function generateOutreachMessage(
  post: PostContext,
  signal: SignalContext,
  type: MessageType
): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You write outreach messages for a backend engineer reaching out to founders on Reddit.

Style: ${TONE_BY_TYPE[type]}
Voice: technical credibility, genuine interest, no recruiter-speak, no AI-spam tone.
Engineer background: 12 years backend (Laravel, Go, PostgreSQL, Redis, SaaS infrastructure).
Never: "I came across your post", "I would love to", "synergy", "leverage", corporate language.`,
      },
      {
        role: 'user',
        content: `Post: "${post.title}" by u/${post.author} in r/${post.subreddit}
Body excerpt: ${post.body.slice(0, 400)}

Detected signals:
- Technologies: ${signal.technologies.join(', ') || 'none'}
- Pain points: ${signal.painPoints.join(', ') || 'none'}
- Stage: ${signal.startupStage}
- Summary: ${signal.summary}

Write the ${type.replace('_', ' ').toLowerCase()} message now. Output only the message text.`,
      },
    ],
  })

  return response.choices[0].message.content!.trim()
}
