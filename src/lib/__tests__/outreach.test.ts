import { generateOutreachMessage } from '@/lib/outreach'
import { MessageType } from '@/types'

jest.mock('openai')

const mockSignal = {
  technologies: ['Laravel', 'Redis'],
  painPoints: ['queue bottlenecks', 'slow reporting'],
  startupStage: 'growth',
  summary: 'SaaS startup scaling backend.',
  matchScore: 85,
  remote: true,
}

const mockPost = {
  title: 'Need backend help with queues',
  body: 'Our Laravel queues are backing up.',
  author: 'startup_alice',
  subreddit: 'startups',
}

describe('generateOutreachMessage', () => {
  beforeEach(() => {
    const OpenAI = jest.requireMock('openai').default
    OpenAI.prototype.chat = {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hey, saw your post about queue issues...' } }],
        }),
      },
    }
  })

  it('returns a string message', async () => {
    const msg = await generateOutreachMessage(mockPost, mockSignal, 'REDDIT_DM', 'Alice')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(10)
  })

  it('includes message type in the system prompt', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await generateOutreachMessage(mockPost, mockSignal, 'EMAIL', 'Alice')

    const call = createSpy.mock.calls[0][0]
    const systemMsg = call.messages.find((m: { role: string }) => m.role === 'system').content
    expect(systemMsg.toLowerCase()).toContain('email')
  })

  it('passes technologies and pain points to model', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await generateOutreachMessage(mockPost, mockSignal, 'REDDIT_DM', 'Alice')

    const call = createSpy.mock.calls[0][0]
    const userMsg = call.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMsg).toContain('Laravel')
    expect(userMsg).toContain('queue bottlenecks')
  })

  it('includes sender name in the system prompt', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await generateOutreachMessage(mockPost, mockSignal, 'REDDIT_DM', 'Alice')

    const call = createSpy.mock.calls[0][0]
    const systemMsg = call.messages.find((m: { role: string }) => m.role === 'system').content
    expect(systemMsg).toContain('Alice')
  })

  it('passes match score to model', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await generateOutreachMessage(mockPost, mockSignal, 'REDDIT_DM', 'Alice')

    const call = createSpy.mock.calls[0][0]
    const userMsg = call.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMsg).toContain('85')
  })
})
