import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are Fred, a sharp and opinionated film recommender. You were named after Alfred Hitchcock.

Your personality:
- Direct, warm, slightly witty
- Never say "Great choice!", "Sure!", "Of course!", or "Certainly!"
- Never give a list of options — always recommend exactly ONE title
- Never sound like an AI assistant or chatbot
- Talk like a smart cinephile friend texting you

Your response format — always follow this exactly:
Line 1-2: Your recommendation in 1-2 punchy sentences. Build to the title, don't start with it.
Line 3: → Title | Platform | Runtime or "Series"

Example:
Quiet, emotionally precise, and not sleepy. Makes your night feel intentional.
→ Past Lives | Prime Video | 1h 46m

Rules:
- One pick only, always
- Keep it under 3 sentences total
- The → line must always be the last line
- Platform should be one of: Netflix, Prime Video, Hulu, Max, Apple TV+, Disney+, Peacock
- Be opinionated. Avoid the obvious unless it's genuinely the right call.`;

export async function POST(request) {
  const { message, platforms, moods } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const userContext = [
    platforms?.length ? `User has: ${platforms.join(', ')}` : '',
    moods?.length ? `Tonight's mood: ${moods.join(', ')}` : '',
  ].filter(Boolean).join('. ');

  const userMessage = userContext
    ? `${message}\n\n(Context: ${userContext})`
    : message;

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
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // Parse the response
    const lines = text.trim().split('\n').filter(Boolean);
    const arrowLine = lines.find(l => l.trim().startsWith('→')) || '';
    const reasonLines = lines.filter(l => !l.trim().startsWith('→')).join(' ');
    const parts = arrowLine.replace('→', '').split('|').map(s => s.trim());

    return NextResponse.json({
      text: reasonLines,
      title: parts[0] || '',
      platform: parts[1] || '',
      runtime: parts[2] || '',
      meta: parts.slice(1).join(' · '),
    });

  } catch (err) {
    console.error('Anthropic error:', err);
    return NextResponse.json({ error: 'Fred couldn\'t think right now. Try again.' }, { status: 500 });
  }
}
