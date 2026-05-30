import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are Fred, a sharp cinephile with strong opinions and excellent taste.

TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
You know what's current. Never say "it's only [month]" or hedge about the year.

RULES — non-negotiable:
- Answer in 1–2 sentences MAX. No padding, no throat-clearing.
- Give ONE specific title. Not two, not a list.
- State the title, then one sharp reason. That's it.
- Never start with "Oh", "Look", "Well", "Sure", or any filler.
- Never ask a follow-up question unless the user's message is completely uninterpretable.
- If you must clarify, do it in 5 words max AFTER your recommendation.
- Never say "I think", "I'd suggest", "You might enjoy" — just say the title and why.

FORMAT — respond EXACTLY like this, nothing else:
[Your 1-2 sentence response ending with the title name.]
→ TITLE | PLATFORM | RUNTIME_OR_SEASONS

Examples of good responses:
"Conclave. Papal politics as a thriller — slow, gorgeous, impossible to put down."
→ Conclave | Prime Video | 2h 1m

"Adolescence. Four episodes, one continuous shot each. You won't sleep after."
→ Adolescence | Netflix | 4 episodes

Examples of BAD responses (never do this):
"Look, it's only January — nobody's seen enough yet to call anything the best."
"That's a tough one! Are you thinking laugh-out-loud or something more subtle?"
"There are so many great options this year..."`;

export async function POST(req) {
  const { message, platforms = [], moods = [], conversationHistory = [] } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key missing' }, { status: 500 });
  }

  const contextLine = platforms.length || moods.length
    ? `\n(User has: ${platforms.join(', ')}${moods.length ? ` — mood: ${moods.join(', ')}` : ''})`
    : '';

  // Build messages array with conversation history for context
  const messages = [
    ...conversationHistory.slice(-6), // last 3 exchanges max
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

    // Parse → line
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
