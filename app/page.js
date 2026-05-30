// ── REPLACE the entire sendChat function in page.js ──

async function sendChat(text) {
  const t = (text || chatInput).trim();
  if (!t || chatLoading) return;
  setChatInput('');

  const userMsg = { role: 'user', text: t };
  setMessages(prev => [...prev, userMsg]);
  setChatLoading(true);
  setMessages(prev => [...prev, { role: 'fred', thinking: true }]);

  try {
    // Build clean history for the route — include tmdb_id so interpret step can exclude seen films
    const conversationHistory = messages
      .filter(m => !m.thinking)
      .slice(-10)
      .map(m => ({
        role: m.role,
        text: m.text || '',
        tmdb_id: m.tmdb_id || null,   // ← carry tmdb_id so interpret step can exclude seen films
      }));

    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: t,
        platforms,
        moods,
        tasteProfile,
        conversationHistory,           // ← was "history", now matches route param name
      }),
    });

    const data = await res.json();

    setMessages(prev => {
      const u = [...prev];
      const idx = u.findLastIndex(m => m.thinking);
      if (idx !== -1) u[idx] = {
        role: 'fred',
        thinking: false,
        text: data.text || data.error || "Fred couldn't connect.",
        title: data.title || '',
        meta: data.meta || '',
        poster: data.poster || null,
        tmdb_id: data.tmdb_id || null,   // ← store so next sendChat can pass it back
        rating: data.rating || null,
      };
      return u;
    });
  } catch {
    setMessages(prev => {
      const u = [...prev];
      const idx = u.findLastIndex(m => m.thinking);
      if (idx !== -1) u[idx] = {
        role: 'fred', thinking: false,
        text: "Fred couldn't connect. Try again.",
        title: '', meta: '',
      };
      return u;
    });
  } finally {
    setChatLoading(false);
    setTimeout(() => chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight, behavior: 'smooth'
    }), 120);
  }
}
