import OpenAI from 'openai'
import { MessageType } from '@/types'

const PROVIDER_CONFIG: Record<string, { baseURL: string; envKey: string }> = {
  openai: { baseURL: 'https://api.openai.com/v1', envKey: 'OPENAI_API_KEY' },
  openrouter: { baseURL: 'https://openrouter.ai/api/v1', envKey: 'OPENROUTER_API_KEY' },
  groq: { baseURL: 'https://api.groq.com/openai/v1', envKey: 'GROQ_API_KEY' },
}

function createClient(provider: string): OpenAI {
  const config = PROVIDER_CONFIG[provider]
  if (!config) throw new Error(`Unknown AI provider: ${provider}`)

  const apiKey = process.env[config.envKey]
  if (!apiKey) {
    throw new Error(`Missing ${config.envKey} environment variable for provider "${provider}"`)
  }

  return new OpenAI({ apiKey, baseURL: config.baseURL })
}

const TONE_BY_TYPE: Record<MessageType, string> = {
  REDDIT_DM: 'a casual Reddit DM - short, developer-to-developer, no marketing fluff, 3-5 sentences max',
  EMAIL: 'a brief cold email - subject line on first line, 4-6 sentences, direct and respectful',
  LINKEDIN: 'a LinkedIn connection message - under 300 characters, direct value hook, no buzzwords',
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
  matchScore: number
  remote: boolean | null
}

export async function generateOutreachMessage(
  post: PostContext,
  signal: SignalContext,
  type: MessageType,
  senderName: string,
  provider = 'openai',
  model = 'gpt-4o'
): Promise<string> {
  const client = createClient(provider)

  const techMatch = signal.technologies.length > 0
    ? `You share ${signal.technologies.slice(0, 3).join(', ')} expertise.`
    : ''

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You write outreach messages for ${senderName || 'a backend engineer'} reaching out to founders on Reddit.

Style: ${TONE_BY_TYPE[type]}
Voice: technical credibility, genuine interest, no recruiter-speak, no AI-spam tone.
Engineer background: 12 years backend (Laravel, Go, PostgreSQL, Redis, SaaS infrastructure).

RULE: Start by referencing the OP's specific problem from their post — not the post itself. Show you read and understood their pain point. Then offer relevant experience or a specific question.
SIGNAL CALIBRATION: match score ${signal.matchScore}/100. Higher score = stronger alignment. Adjust confidence proportionally.

Never: "I came across your post", "I saw your post", "I was browsing", "reaching out", "I would love to", "I was wondering if", "your profile", "noticed you", "synergy", "leverage", "circle back", "touch base", corporate language, vague praise.`,
      },
      {
        role: 'user',
        content: `Post: "${post.title}" by u/${post.author} in r/${post.subreddit}
Body excerpt: ${post.body.slice(0, 500)}

Detected signals:
- Technologies: ${signal.technologies.join(', ') || 'none'}
- Pain points: ${signal.painPoints.join(', ') || 'none'}
- Stage: ${signal.startupStage}
- Remote: ${signal.remote ?? 'unknown'}
- Match score: ${signal.matchScore}/100
- Summary: ${signal.summary}
${techMatch}

Write the ${type.replace('_', ' ').toLowerCase()} message now. Output only the message text — no explanations, no subject line wrapper.`,
      },
    ],
  })

  return response.choices[0].message.content!.trim()
}
