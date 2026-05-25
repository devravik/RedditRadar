export interface PrefilterResult {
  skip: boolean
  reason?: string
}

const NOISE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /(rate|roast|review)\s+my\s+(resume|portfolio|cv|code|site|app|project)/i, reason: 'resume_review' },
  { pattern: /^business\s+name/i, reason: 'business_name_only' },
  { pattern: /name\s+my\s+business/i, reason: 'business_name_only' },
  { pattern: /weekly\s+(self\s+)?promotion/i, reason: 'weekly_thread' },
  { pattern: /weekly\s+(help|discussion|chat|thread)/i, reason: 'weekly_thread' },
  { pattern: /welcome\s+to\s+r\//i, reason: 'welcome_intro' },
  { pattern: /introduce\s+yourself/i, reason: 'welcome_intro' },
  { pattern: /(need|looking\s+for|want)\s+(some\s+)?(advice|guidance|tips?)/i, reason: 'advice_seeking' },
  { pattern: /advice\s+(needed|request|please|required)/i, reason: 'advice_seeking' },
  { pattern: /(how\s+(do\s+i|to|can\s+i)|best\s+way\s+to)\s+(learn|start\s+with|study|get\s+into)/i, reason: 'learning_question' },
  { pattern: /(looking\s+for|recommend|suggest)\s+(a|an|some|any)?\s*(monitor|laptop|keyboard|mouse|headphone|desk|chair)/i, reason: 'hardware_shopping' },
  { pattern: /(roast|critique|tear\s+apart)\s+(my|this|our)/i, reason: 'showcase_review' },
  { pattern: /show\s+(and\s+)?tell/i, reason: 'showcase_review' },
  { pattern: /(what\s+(are|is)\s+your\s+(thoughts|opinion|take)\s+on|what\s+do\s+you\s+think\s+about)/i, reason: 'opinion_poll' },
]

export function shouldSkipPost(
  title: string,
  body: string,
  score?: number,
  numComments?: number
): PrefilterResult {
  for (const { pattern, reason } of NOISE_PATTERNS) {
    if (pattern.test(title) || pattern.test(body)) {
      return { skip: true, reason }
    }
  }

  if (
    (!body || body.trim().length < 50) &&
    title.length < 25 &&
    (score ?? 99) < 3 &&
    (numComments ?? 99) < 2
  ) {
    return { skip: true, reason: 'low_content' }
  }

  return { skip: false }
}
