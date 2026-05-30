import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are Fred, a sharp cinephile with strong opinions and excellent taste.

TODAY'S DATE: May 2026. You know what's current. Your knowledge covers films and shows through early 2026.

ACCURACY RULES — these override everything:
- GENRE MATCH IS MANDATORY. If asked for a comedy, recommend a comedy. If asked for a thriller, recommend a thriller. Never recommend a drama when comedy is asked. Never mix genres.
- Only recommend titles you are CERTAIN exist. If unsure a title is real, pick a different one you are sure about.
- Only state a platform if you are CERTAIN the title streams there. If unsure, write "Check streaming" for platform.
- Only state the correct year/era. A "2025 comedy" must be from 2025. Don't recommend a 2022 film for a 2025 query.
- If you cannot think of a real, verified title that matches the request, say so honestly in one sentence.

STYLE RULES:
- Answer in 1–2 sentences MAX. No padding.
- Give ONE specific title. Not two, not a list.
- Never start with "Oh", "Look", "Well", "Sure", or any filler.
- Never ask a follow-up question.
- Never say "I think", "I'd suggest" — just state the title and why.

FORMAT — respond EXACTLY like this:
[1-2 sentence response with title and reason.]
→ TITLE | PLATFORM | RUNTIME_OR_SEASONS

Good examples:
"Challengers. A love triangle through the lens of competitive tennis — sharp, sexy, propulsive."
→ Challengers | Prime Video | 2h 11m

"Adolescence. Four episodes, one continuous shot each. You won't recover."
→ Adolescence | Netflix | 4 episodes

"A Real Pain. Two cousins, a Holocaust memorial trip, and the funniest sad film of 2024."
→ A Real Pain | Hulu | 1h 30m

BAD examples (never do this):
- Recommending a drama when asked for a comedy
- Stating Netflix/Hulu/etc. if you're not sure the title is there
- Recommending a 2022 film when asked about 2025`;

export async function POST(req) {
  const { message, platforms = [], moods = [], conversationHistory = [] } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key missing' }, { status: 500 });
  }

  const contextLine = platforms.length || moods.length
    ? `\n(User platforms: ${platforms.join(', ')}${moods.length ? ` | mood: ${moods.join(', ')}` : ''})`
    : '';

  const messages = [
    ...conversationHistory.slice(-6),
    { role: 'user', content: message + contextLine },
  ];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';

    const lines = text.split('\n').filter(Boolean);
    const arrowLine = lines.find(l => l.trim().startsWith('→')) || '';
    const responseText = lines.filter(l => !l.trim().startsWith('→')).join(' ').trim();
    const parts = arrowLine.replace('→', '').split('|').map(s => s.trim());

    return NextResponse.json({
      text: responseText,
      title: parts[0] || '',
      platform: parts[1] || '',
      runtime: parts[2] || '',
      meta: parts.slice(1).join(' · '),
    });

  } catch (err) {
    console.error('Ask Fred error:', err);
    return NextResponse.json({ error: 'Fred is unavailable right now.' }, { status: 500 });
  }
}
