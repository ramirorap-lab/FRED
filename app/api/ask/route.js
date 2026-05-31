import { NextResponse } from 'next/server';

const PROVIDER_IDS = {
  'Netflix': '8', 'Prime Video': '9', 'Hulu': '15',
  'Max': '1899', 'Apple TV+': '350', 'Disney+': '337', 'Peacock': '386',
};

const GENRE_IDS = {
  comedy: 35, thriller: 53, horror: 27, romance: 10749,
  drama: 18, action: 28, documentary: 99, animation: 16,
  'sci-fi': 878, mystery: 9648, crime: 80, fantasy: 14,
  adventure: 12, family: 10751,
};

// ── Step 1: Ask Haiku to interpret the conversation and output search params ──
async function interpretQuery(messages, apiKey) {
  const system = `You are a film search assistant. Given a conversation, output a JSON object describing what film to search for next.

Fields:
- genre: one of: comedy, thriller, horror, romance, drama, action, documentary, animation, sci-fi, mystery, crime, fantasy, adventure, family. Null if no genre can be determined.
- year: 4-digit year string if the user specified one (e.g. "2025"), null otherwise.
- exclude_ids: array of TMDB integer IDs already shown in this conversation (look for tmdb_id values in assistant messages).
- is_series: true if user wants a TV show/series, false for movies (default false).
- needs_recommendation: true if the user wants a new film recommendation, false if they are just asking a yes/no question about the last film.
- reasoning: one sentence explaining your interpretation.

Critical rules:
- "is that a comedy?" / "is that X?" = the user is asking about the LAST recommended film, NOT requesting a new one. Set needs_recommendation: false.
- "another one" / "different one" / "something else" = inherit the genre from earlier in the conversation. Set needs_recommendation: true.
- "I meant comedy" / "no, give me a comedy" = user is correcting the genre. Use the corrected genre. Set needs_recommendation: true.
- "ok another one" after a clarification question = user confirmed, keep the same genre context. Set needs_recommendation: true.
- Always exclude films already shown. TMDB IDs are embedded in assistant messages as [tmdb_id:NUMBER]. Extract ALL of these numbers into exclude_ids.
- Output ONLY valid JSON. No markdown, no explanation outside the JSON.`;

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
      system,
      messages,
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || '{}';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return {};
  }
}

// ── Step 2: Search TMDB with interpreted params ──
async function searchTMDB({ genre, year, exclude_ids = [], is_series = false }, platforms, tmdbToken) {
  const genreId = genre ? GENRE_IDS[genre.toLowerCase()] : null;
  if (!genreId) return null;

  const providerIds = platforms.map(p => PROVIDER_IDS[p]).filter(Boolean).join('|');
  const endpoint = is_series
    ? 'https://api.themoviedb.org/3/discover/tv'
    : 'https://api.themoviedb.org/3/discover/movie';

  const params = new URLSearchParams({
    sort_by: 'vote_average.desc',
    'vote_count.gte': '500',
    'vote_average.gte': '7.0',
    with_genres: genreId,
    language: 'en-US',
    include_adult: 'false',
    page: '1',
  });

  if (year) {
    if (is_series) params.set('first_air_date_year', year);
    else params.set('primary_release_year', year);
  }
  if (providerIds) {
    params.set('with_watch_providers', providerIds);
    params.set('watch_region', 'US');
  }

  const res = await fetch(`${endpoint}?${params}`, {
    headers: { Authorization: `Bearer ${tmdbToken}` },
  });
  const data = await res.json();
  const results = data.results || [];

  // Skip already shown titles
  return results.find(r => !exclude_ids.includes(r.id)) || results[0] || null;
}

// ── Step 3: Get runtime + platform ──
async function getDetails(id, isSeries, tmdbToken) {
  const base = isSeries
    ? `https://api.themoviedb.org/3/tv/${id}`
    : `https://api.themoviedb.org/3/movie/${id}`;

  const [detailRes, providerRes] = await Promise.all([
    fetch(`${base}?language=en-US`, { headers: { Authorization: `Bearer ${tmdbToken}` } }),
    fetch(`${base}/watch/providers`, { headers: { Authorization: `Bearer ${tmdbToken}` } }),
  ]);

  const detail = await detailRes.json();
  const providers = await providerRes.json();
  const platform = providers.results?.US?.flatrate?.[0]?.provider_name || 'Check streaming';

  let runtime = '';
  if (isSeries) {
    const seasons = detail.number_of_seasons;
    runtime = seasons ? `${seasons} season${seasons > 1 ? 's' : ''}` : '';
  } else {
    const mins = detail.runtime || 0;
    runtime = mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '';
  }

  return { platform, runtime };
}

// ── Step 4: Write the pitch ──
async function writePitch(film, platform, runtime, searchParams, apiKey) {
  const year = (film.release_date || film.first_air_date || '').slice(0, 4);
  const rating = film.vote_average ? film.vote_average.toFixed(1) : null;
  const votes = film.vote_count || 0;
  const votesFormatted = votes >= 1000 ? `${(votes / 1000).toFixed(1)}k` : votes;

  // Build a credibility line from real data
  const credibility = rating
    ? `${rating}/10 on TMDB (${votesFormatted} ratings)`
    : null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: `You are Fred, a sharp cinephile. Write a 2-sentence response about this film that directly answers what the user asked for.

Sentence 1: Confirm why this film directly answers the user's question (e.g. "This is one of the best comedies of 2025" or "If you want a thriller from 2024, this is the one"). Be specific, not generic.
Sentence 2: One sharp reason to watch it — not a plot summary.

Rules:
- Do NOT mention the title — it's shown in the card
- Naturally work in the real rating/credibility data if provided
- No filler, no "I", no "you might enjoy"
- Output only the 2 sentences. Nothing else.`,
      messages: [{
        role: 'user',
        content: `User asked for: ${searchParams.genre}${searchParams.year ? ` from ${searchParams.year}` : ''}
Film: ${film.title || film.name} (${year})
Rating: ${credibility || 'not available'}
Overview: ${film.overview}
Write the 2-sentence response.`,
      }],
    }),
  });

  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

// ── Main handler ──
export async function POST(req) {
  const {
    message,
    platforms = [],
    conversationHistory = [],  // [{ role: 'user'|'fred', text: '...' }]
  } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const tmdbToken = process.env.TMDB_TOKEN;

  if (!apiKey) return NextResponse.json({ error: 'API key missing' }, { status: 500 });

  // Build Anthropic-format messages from history + current message
  const historyMessages = conversationHistory
    .filter(m => !m.thinking && (m.text || m.content))
    .slice(-10)
    .map(m => ({
      role: m.role === 'fred' ? 'assistant' : 'user',
      // Embed tmdb_id into the text so the interpret step can see it
      content: m.tmdb_id
        ? `${m.text || m.content || ''} [tmdb_id:${m.tmdb_id}]`
        : (m.text || m.content || ''),
    }));

  const allMessages = [...historyMessages, { role: 'user', content: message }];

  try {
    // Step 1: Interpret
    const params = await interpretQuery(allMessages, apiKey);

    // If user asked a yes/no question about the last film, answer it directly
    if (params.needs_recommendation === false) {
      const answerRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 80,
          system: `You are Fred, a sharp cinephile. Answer the user's question about the last recommended film in 1-2 sentences. Be direct and honest. If the film is not that genre, say so clearly and offer to find one that is.`,
          messages: allMessages,
        }),
      });
      const answerData = await answerRes.json();
      return NextResponse.json({
        text: answerData.content?.[0]?.text?.trim() || '',
        title: '',
        platform: '',
        runtime: '',
        meta: '',
      });
    }

    // Step 2: Search TMDB (if genre found)
    let film = null;
    let platform = 'Check streaming';
    let runtime = '';

    if (params.genre && tmdbToken) {
      film = await searchTMDB(params, platforms, tmdbToken);
      if (film) {
        const details = await getDetails(film.id, params.is_series, tmdbToken);
        platform = details.platform;
        runtime = details.runtime;
      }
    }

    // Step 3: Write pitch
    if (film) {
      const pitch = await writePitch(film, platform, runtime, params, apiKey);
      const rating = film.vote_average ? film.vote_average.toFixed(1) : null;
      return NextResponse.json({
        text: pitch,
        title: film.title || film.name,
        platform,
        runtime,
        rating,
        meta: `${platform} · ${runtime}`,
        poster: film.poster_path,
        tmdb_id: film.id,
      });
    }

    // Fallback: no genre detected — let Haiku answer freely
    const fallbackRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system: `You are Fred, a sharp cinephile. Answer in 1-2 sentences. Give ONE specific recommendation. Never ask the user for information. No filler.

FORMAT:
[Pitch ending with the title name.]
→ TITLE | PLATFORM | RUNTIME`,
        messages: allMessages,
      }),
    });

    const fallbackData = await fallbackRes.json();
    const text = fallbackData.content?.[0]?.text?.trim() || '';
    const lines = text.split('\n').filter(Boolean);
    const arrowLine = lines.find(l => l.trim().startsWith('→')) || '';
    const responseText = lines.filter(l => !l.trim().startsWith('→')).join(' ').trim();
    const parts = arrowLine.replace('→', '').split('|').map(s => s.trim());

    return NextResponse.json({
      text: responseText || text,
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
