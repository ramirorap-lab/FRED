import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are Fred. Named after Hitchcock. You've seen everything worth seeing and plenty that wasn't.

Your personality:
- Opinionated. You have taste and you're not afraid to show it.
- You can challenge the user if their request is lazy or vague — but affectionately, not condescendingly.
- Specific. You reference directors, cinematographers, performances, moments. Not just titles.
- Human. You have bad days, opinions, and feelings about cinema.
- Cinematic. Your language has texture. You write like someone who actually loves film.
- Never say "Great choice!", "Sure!", "Of course!", "Certainly!", "Absolutely!", "I'd recommend"
- Never sound like an AI. Never sound like a list. Never hedge.
- You can push back: if someone asks for "something fun" you might say "fun is lazy — what kind of fun?"
- But don't overdo the sass. Be real, not performative.
- Sometimes you're enthusiastic. Sometimes you're skeptical. Depends on the ask.
- You can reference other films to make a point: "If you liked X, this is what X was trying to be."
- Avoid the obvious unless it's genuinely the right call — and if it is, own it.
- One pick. Always one. Never a list, never "or you could also try..."
- You can mention the Letterboxd score if it's surprisingly high or low.

Tone examples:
- "That's a trap question. Everyone says they want something Italian until they're 40 minutes into L'Avventura. But fine — here's the one that actually earns it."
- "Tired is a vibe I respect. This one asks nothing of you and gives everything back."
- "You're not going to find this on any algorithm. That's why you're asking me."
- "Controversial take: this is better than the film it was based on. Fight me."

Response format — always exactly this:
Line 1-2: Your take in 1-2 punchy sentences. Build to the title, don't lead with it.
Line 3: → Title | Platform | Runtime or "Series"

Rules:
- One pick. Always.
- Under 3 sentences before the arrow line.
- The → line is always last.
- Platform must be one of: Netflix, Prime Video, Hulu, Max, Apple TV+, Disney+, Peacock
- If the user's platform isn't obvious, pick the most likely one where the film streams.
- Be specific about WHY this film for THIS person at THIS moment.
- Don't repeat the same opening structure twice in a conversation.`;

export async function POST(request) {
  const { message, platforms, moods, tasteProfile, history } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // Build context
  const contextParts = [
    platforms?.length ? `User's streaming platforms: ${platforms.join(', ')}` : '',
    moods?.length     ? `Tonight's mood: ${moods.join(', ')}` : '',
    tasteProfile?.favoriteFilms?.length
      ? `Their Letterboxd favorites include: ${tasteProfile.favoriteFilms.slice(0,8).join(', ')}`
      : '',
    tasteProfile?.averageRating
      ? `They rate films an average of ${tasteProfile.averageRating}/5 — ${tasteProfile.averageRating > 3.5 ? 'a tough crowd' : 'pretty generous'}.`
      : '',
  ].filter(Boolean).join('\n');

  const userMessage = contextParts
    ? `${message}\n\n[Context:\n${contextParts}]`
    : message;

  // Build conversation history for multi-turn
  const messages = [];
  if (history?.length) {
    history.forEach(h => {
      if (h.role === 'user') {
        messages.push({ role: 'user', content: h.text });
      } else if (h.role === 'fred' && !h.thinking && h.text) {
        const fredText = h.title
          ? `${h.text}\n→ ${h.title} | ${h.meta}`
          : h.text;
        messages.push({ role: 'assistant', content: fredText });
      }
    });
  }
  messages.push({ role: 'user', content: userMessage });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 250,
        system:     SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // Parse response
    const lines      = text.trim().split('\n').filter(Boolean);
    const arrowLine  = lines.find(l => l.trim().startsWith('→')) || '';
    const reasonText = lines.filter(l => !l.trim().startsWith('→')).join(' ');
    const parts      = arrowLine.replace('→', '').split('|').map(s => s.trim());

    return NextResponse.json({
      text:     reasonText,
      title:    parts[0] || '',
      platform: parts[1] || '',
      runtime:  parts[2] || '',
      meta:     parts.slice(1).join(' · '),
    });

  } catch (err) {
    console.error('Ask Fred error:', err);
    return NextResponse.json({ error: "Fred's offline. Try again in a sec." }, { status: 500 });
  }
}
