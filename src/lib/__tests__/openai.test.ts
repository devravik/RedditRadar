import { analyzePost } from '@/lib/openai'
import { AnalysisResult } from '@/types'

jest.mock('openai')

const mockResult: AnalysisResult = {
  technologies: ['Laravel', 'PostgreSQL', 'Redis'],
  painPoints: ['slow queries', 'queue bottlenecks'],
  seniority: 'senior',
  remote: true,
  startupStage: 'growth',
  matchScore: 88,
  summary: 'Laravel SaaS startup needs backend scaling help.',
}

describe('analyzePost', () => {
  beforeEach(() => {
    const OpenAI = jest.requireMock('openai').default
    OpenAI.prototype.chat = {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(mockResult) } }],
        }),
      },
    }
  })

  it('returns parsed AnalysisResult for a post', async () => {
    const result = await analyzePost(
      'Backend engineer needed for SaaS startup',
      'We are struggling with Laravel queues and slow reporting'
    )

    expect(result.matchScore).toBe(88)
    expect(result.technologies).toContain('Laravel')
    expect(result.painPoints).toContain('slow queries')
    expect(result.remote).toBe(true)
  })

  it('sends both title and body in the user message', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await analyzePost('My Title', 'My Body')

    const call = createSpy.mock.calls[0][0]
    const userMsg = call.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMsg).toContain('My Title')
    expect(userMsg).toContain('My Body')
  })

  it('uses json_object response format', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await analyzePost('Title', 'Body')

    const call = createSpy.mock.calls[0][0]
    expect(call.response_format).toEqual({ type: 'json_object' })
  })
})
