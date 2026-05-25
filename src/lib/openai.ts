import OpenAI from 'openai'
import { AnalysisResult } from '@/types'

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

const MAX_BODY_CHARS = 3000

export async function analyzePost(
  title: string,
  body: string,
  engineerProfile: string,
  provider = 'openai',
  model = 'gpt-4o'
): Promise<AnalysisResult> {
  const client = createClient(provider)

  if (body && body.length > MAX_BODY_CHARS) {
    body = body.slice(0, MAX_BODY_CHARS) + '\n\n[truncated]'
  }

  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a technical opportunity analyst. Given a Reddit post, analyze it for engineering job/contract opportunities.

Engineer profile:
${engineerProfile}

Return a JSON object with exactly these keys:
- technologies: string[] - detected tech stack mentioned
- painPoints: string[] - specific technical problems mentioned
- seniority: "junior" | "mid" | "senior" | "lead" | "unknown" - level sought
- remote: boolean - remote work mentioned or implied
- startupStage: "idea" | "early" | "growth" | "mature" | "unknown"
- matchScore: number 0-100 - fit with engineer profile (100 = perfect match)
- summary: string - one sentence describing the opportunity`,
      },
      {
        role: 'user',
        content: `Post title: ${title}\n\nPost body: ${body || '(no body text)'}`,
      },
    ],
  })

  let content = response.choices[0].message.content!
  content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  return JSON.parse(content) as AnalysisResult
}
