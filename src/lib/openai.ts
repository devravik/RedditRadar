import OpenAI from 'openai'
import { AnalysisResult } from '@/types'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const ENGINEER_PROFILE = `
Backend engineer, 12+ years experience.
Core skills: Laravel, Go, PostgreSQL, Redis, API architecture, SaaS infrastructure, multi-tenant systems.
Seeking: freelance/contract, remote preferred.
Strong signal keywords: scaling, bottleneck, queue, multi-tenant, SaaS, backend, infrastructure, performance.
`

export async function analyzePost(title: string, body: string): Promise<AnalysisResult> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a technical opportunity analyst. Given a Reddit post, analyze it for engineering job/contract opportunities.

Engineer profile:
${ENGINEER_PROFILE}

Return a JSON object with exactly these keys:
- technologies: string[] — detected tech stack mentioned
- painPoints: string[] — specific technical problems mentioned
- seniority: "junior" | "mid" | "senior" | "lead" | "unknown" — level sought
- remote: boolean — remote work mentioned or implied
- startupStage: "idea" | "early" | "growth" | "mature" | "unknown"
- matchScore: number 0–100 — fit with engineer profile (100 = perfect match)
- summary: string — one sentence describing the opportunity`,
      },
      {
        role: 'user',
        content: `Post title: ${title}\n\nPost body: ${body || '(no body text)'}`,
      },
    ],
  })

  const content = response.choices[0].message.content!
  return JSON.parse(content) as AnalysisResult
}
