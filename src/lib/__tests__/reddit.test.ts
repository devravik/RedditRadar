import { fetchSubredditPosts, fetchAllSubredditPosts, SUBREDDITS } from '@/lib/reddit'
import { RedditPost } from '@/types'

const mockPost = (id: string, subreddit: string): RedditPost => ({
  id,
  subreddit,
  title: `Test post in ${subreddit}`,
  selftext: 'We need backend help',
  author: 'founder_bob',
  url: `https://reddit.com/r/${subreddit}/comments/${id}`,
  created_utc: 1716825600,
  score: 5,
  num_comments: 2,
})

function makeRedditResponse(posts: RedditPost[]) {
  return {
    data: {
      children: posts.map(p => ({ data: p })),
    },
  }
}

describe('fetchSubredditPosts', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns parsed posts for a subreddit', async () => {
    const posts = [mockPost('abc', 'startups'), mockPost('def', 'startups')]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse(posts),
    } as Response)

    const result = await fetchSubredditPosts('startups')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.reddit.com/r/startups/new.json?limit=25',
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('abc')
    expect(result[0].subreddit).toBe('startups')
  })

  it('throws when Reddit returns non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
    } as Response)

    await expect(fetchSubredditPosts('startups')).rejects.toThrow('Reddit API error: 429')
  })
})

describe('fetchAllSubredditPosts', () => {
  it('aggregates posts from all configured subreddits', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const sub = (url as string).match(/\/r\/(\w+)\//)?.[1] ?? 'unknown'
      return Promise.resolve({
        ok: true,
        json: async () => makeRedditResponse([mockPost('x', sub)]),
      })
    })

    const result = await fetchAllSubredditPosts()

    expect(result.length).toBe(SUBREDDITS.length)
  })

  it('skips subreddits that return errors', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => makeRedditResponse([mockPost('y', 'startups')]),
      })

    const result = await fetchAllSubredditPosts()

    // One failed, rest succeeded
    expect(result.length).toBe(SUBREDDITS.length - 1)
  })
})
