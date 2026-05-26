'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

const PLATFORMS = ['Netflix', 'Prime Video', 'Hulu', 'Max', 'Apple TV+', 'Disney+', 'Peacock'];
const MOODS = [
  { label: 'Chill', value: 'chill' },
  { label: 'Smart', value: 'smart' },
  { label: 'Funny', value: 'funny' },
  { label: 'Dark', value: 'dark' },
  { label: 'Romantic', value: 'romantic' },
  { label: 'Intense', value: 'intense' },
  { label: 'Short', value: 'short' },
  { label: 'Award-winning', value: 'award' },
];

const FRED_RESPONSES = [
  { k: ['tired', 'exhausted', 'easy', 'simple', 'anything'],
    text: "Abbott Elementary. Twenty-five minutes. You'll laugh three times before you realize you feel better.",
    title: "Abbott Elementary", meta: "Hulu · Series · 25 min" },
  { k: ['short', '45', 'quick', 'fast'],
    text: "Baby Reindeer. Six episodes, twenty-five minutes each. Starts unsettling, ends devastating. You won't stop.",
    title: "Baby Reindeer", meta: "Netflix · Series · 25 min" },
  { k: ['bear', 'stress', 'relax', 'calm', 'anxious'],
    text: "Slow Horses. Same pressure-cooker energy as The Bear, but British intelligence instead of kitchens. Gary Oldman is extraordinary.",
    title: "Slow Horses", meta: "Apple TV+ · Series" },
  { k: ['funny', 'laugh', 'comedy', 'light'],
    text: "The Holdovers. Paul Giamatti at his absolute peak. Warm, sharp, and funnier than the trailer suggests.",
    title: "The Holdovers", meta: "Peacock · 2h 13m" },
  { k: ['dark', 'grim', 'heavy'],
    text: "Ripley. Black and white, obsessive, gorgeous. The kind of thing you watch slowly and feel the weight of.",
    title: "Ripley", meta: "Netflix · Series" },
  { k: ['smart', 'intelligent', 'think', 'good', 'great'],
    text: "Severance. The most original concept on television right now. Gets inside your head and stays there.",
    title: "Severance", meta: "Apple TV+ · Series" },
  { k: ['romantic', 'love', 'romance', 'date'],
    text: "Past Lives. Quiet, emotionally precise, not sleepy. Makes your night feel intentional.",
    title: "Past Lives", meta: "Prime Video · 1h 46m" },
  { k: ['intense', 'action', 'edge', 'thriller'],
    text: "Fallout. Big-world sci-fi that doesn't ask you to do homework first. Genuinely thrilling.",
    title: "Fallout", meta: "Prime Video · Series" },
  { k: ['award', 'oscar', 'emmy', 'best'],
    text: "Shōgun. The most awarded TV show in years, and it earned every one. Epic without being exhausting.",
    title: "Shōgun", meta: "Hulu · Series" },
  { k: ['weird', 'strange', 'different', 'bold'],
    text: "Poor Things. Weird, beautiful, and impossible to ignore. You've never seen anything quite like it.",
    title: "Poor Things", meta: "Hulu · 2h 21m" },
];

function getBgClass(title) {
  const l = (title || 'S').charAt(0).toLowerCase();
  const map = { a:'bg-a',b:'bg-b',c:'bg-c',d:'bg-d',e:'bg-e',f:'bg-f',g:'bg-g',h:'bg-h',
    i:'bg-i',k:'bg-k',l:'bg-l',m:'bg-m',n:'bg-n',o:'bg-o',p:'bg-p',r:'bg-r',
    s:'bg-s',t:'bg-t',w:'bg-w',z:'bg-z' };
  return map[l] || 'bg-s';
}

function IconBookmark() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
}
function IconRefresh() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}
function IconExternal() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
}
function IconSend() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>;
}
function IconX() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconMovie() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>;
}
function IconSettings() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>;
}
function IconChat() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}

export default function Fred() {
  const [screen, setScreen] = useState('tonight');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['Netflix', 'Prime Video']);
  const [selectedMoods, setSelectedMoods] = useState(['smart', 'dark']);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stack, setStack] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef(null);

  function go(name) {
    setScreen(name);
  }

  function togglePlatform(p) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  function toggleMood(m) {
    setSelectedMoods(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  }

  async function loadPicks() {
    go('tonight');
    setLoading(true);
    setPicks([]);
    try {
      const params = new URLSearchParams({
        platforms: selectedPlatforms.join(','),
        moods: selectedMoods.join(','),
      });
      const res = await fetch(`/api/picks?${params}`);
      const data = await res.json();
      setPicks(data.picks || []);
    } catch {
      setPicks([]);
    } finally {
      setLoading(false);
    }
  }

  function saveToStack(pick) {
    if (stack.find(s => s.id === pick.id)) return;
    setStack(prev => [...prev, pick]);
  }

  function removeFromStack(id) {
    setStack(prev => prev.filter(s => s.id !== id));
  }

  function getFredResponse(text) {
    const q = text.toLowerCase();
    const match = FRED_RESPONSES.find(r => r.k.some(kw => q.includes(kw)));
    return match || FRED_RESPONSES[Math.floor(Math.random() * FRED_RESPONSES.length)];
  }

  function sendChat(text) {
    const t = (text || chatInput).trim();
    if (!t) return;
    setChatInput('');
    const userMsg = { role: 'user', text: t };
    const resp = getFredResponse(t);
    const fredMsg = { role: 'fred', text: resp.text, title: resp.title, meta: resp.meta };
    setMessages(prev => [...prev, userMsg, fredMsg]);
    setTimeout(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }

  return (
    <div className="app">

      {/* ── SETUP ── */}
      <div id="s-setup" className={`screen ${screen === 'setup' ? 'active' : ''}`}>
        <div className="setup-wrap">
          <div className="logo">Fred</div>
          <div className="logo-sub">Your film friend</div>

          <div className="sec-label">Your platforms</div>
          <div className="chips">
            {PLATFORMS.map(p => (
              <div key={p} className={`chip ${selectedPlatforms.includes(p) ? 'on' : ''}`}
                onClick={() => togglePlatform(p)}>{p}</div>
            ))}
          </div>

          <div className="sec-label">Tonight's mood</div>
          <div className="chips">
            {MOODS.map(m => (
              <div key={m.value} className={`chip ${selectedMoods.includes(m.value) ? 'on' : ''}`}
                onClick={() => toggleMood(m.value)}>{m.label}</div>
            ))}
          </div>

          <button className="cta" onClick={loadPicks}>
            Fred, show me tonight's picks
          </button>
        </div>
      </div>

      {/* ── TONIGHT ── */}
      <div id="s-tonight" className={`screen ${screen === 'tonight' ? 'active' : ''}`}>
        <div className="t-hdr">
          <div className="screen-title">Tonight</div>
          <div className="screen-sub">Fred's picks for you</div>
        </div>
        <div className="picks-wrap">
          {loading && (
            <div className="loading">
              <div className="spinner" />
              <div className="load-txt">Fred is thinking…</div>
            </div>
          )}
          {!loading && picks.length === 0 && (
            <div className="loading">
              <div className="load-txt">
                Choose your platforms and mood, then tap "Show me picks"
              </div>
            </div>
          )}
          {picks.map(pick => (
            <div className="card" key={pick.id}>
              <div className={`poster-wrap ${getBgClass(pick.title)}`}>
                <div className="poster-ph">{pick.title.charAt(0)}</div>
                {pick.poster && (
                  <img
                    src={`${TMDB_IMG}${pick.poster}`}
                    alt={pick.title}
                    className="poster-img"
                    style={{ position: 'absolute', top: 0, left: 0 }}
                    onError={e => e.target.style.display = 'none'}
                  />
                )}
                <div className="poster-grad" />
                <div className="poster-title">{pick.title}</div>
                <div className="poster-badges">
                  {pick.letterboxd && <span className="bdg bdg-lb">↑ Letterboxd</span>}
                  {pick.topRated && <span className="bdg bdg-top">Top rated</span>}
                </div>
                {pick.rating && (
                  <div className="poster-score">
                    <div className="score-n">{Number(pick.rating).toFixed(1)}</div>
                    <div className="score-l">IMDB</div>
                  </div>
                )}
              </div>
              <div className="card-body">
                <div className="card-meta">
                  {[pick.year, pick.runtime, pick.type === 'tv' ? 'Series' : 'Film'].filter(Boolean).join(' · ')}
                </div>
                <div className="card-reason">"{pick.reason}"</div>
              </div>
              <div className="card-actions">
                <button className="ca sv" onClick={() => saveToStack(pick)}>
                  <IconBookmark /> Save
                </button>
                <button className="ca" onClick={loadPicks}>
                  <IconRefresh /> More
                </button>
                <button className="ca">
                  <IconExternal /> Open
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ASK FRED ── */}
      <div id="s-ask" className={`screen ${screen === 'ask' ? 'active' : ''}`}
        style={{ paddingBottom: '130px' }} ref={chatRef}>
        <div className="a-hdr">
          <div className="screen-title">Ask Fred</div>
          <div className="a-sub">What do you feel like?</div>
        </div>
        <div className="prompt-chips">
          {['Smart but not depressing', 'Under 45 minutes', 'Like The Bear but calmer', "I'm exhausted, easy pick"].map(p => (
            <div key={p} className="pc" onClick={() => sendChat(p)}>{p}</div>
          ))}
        </div>
        <div className="chat-area">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' && (
                <div style={{ textAlign: 'right', marginBottom: '11px' }}>
                  <span style={{
                    display: 'inline-block', background: 'var(--card)',
                    border: '0.5px solid var(--border)',
                    borderRadius: '12px 12px 2px 12px',
                    padding: '9px 13px', fontSize: '13px', color: '#fff', maxWidth: '82%'
                  }}>{msg.text}</span>
                </div>
              )}
              {msg.role === 'fred' && (
                <div className="fred-bubble">
                  <div className="f-text">"{msg.text}"</div>
                  {msg.title && (
                    <div className="resp-card">
                      <div className={`resp-ph ${getBgClass(msg.title)}`}>{msg.title.charAt(0)}</div>
                      <div className="resp-info">
                        <div className="resp-title">{msg.title}</div>
                        <div className="resp-meta">{msg.meta}</div>
                      </div>
                    </div>
                  )}
                  <div className="resp-actions">
                    <button className="rb primary"
                      onClick={() => msg.title && saveToStack({ id: msg.title, title: msg.title, meta: msg.meta, poster: null })}>
                      Save
                    </button>
                    <button className="rb secondary"
                      onClick={() => setMessages(prev => prev.filter((_, j) => j !== i && j !== i - 1))}>
                      Ask again
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="chat-bar">
          <input className="ci" value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            placeholder="Ask Fred something specific…" />
          <button className="cs" onClick={() => sendChat()}>
            <IconSend />
          </button>
        </div>
      </div>

      {/* ── STACK ── */}
      <div id="s-stack" className={`screen ${screen === 'stack' ? 'active' : ''}`}>
        <div className="st-hdr">
          <div className="screen-title">Your Stack</div>
          <div className="a-sub" style={{ marginTop: '4px' }}>Stuff you actually meant to watch.</div>
        </div>
        <div className="st-list">
          {stack.length === 0 && (
            <div className="empty">
              <div style={{ fontSize: '34px', opacity: '.15', marginBottom: '12px' }}>
                <IconBookmark />
              </div>
              <div className="empty-text">Nothing saved yet.<br />Save picks from Tonight or Ask Fred.</div>
            </div>
          )}
          {stack.map(item => (
            <div className="si" key={item.id}>
              {item.poster
                ? <img src={`${TMDB_IMG}${item.poster}`} alt={item.title} className="si-img"
                    onError={e => e.target.style.display = 'none'} />
                : <div className={`si-ph ${getBgClass(item.title)}`}>{item.title.charAt(0)}</div>
              }
              <div className="si-info">
                <div className="si-title">{item.title}</div>
                <div className="si-meta">{item.meta || item.platform}</div>
              </div>
              <button className="si-rm" onClick={() => removeFromStack(item.id)}>
                <IconX />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── NAV ── */}
      <nav className="nav">
        <button className={`nv ${screen === 'setup' ? 'active' : ''}`} onClick={() => go('setup')}>
          <IconSettings /> Setup
        </button>
        <button className={`nv ${screen === 'tonight' ? 'active' : ''}`} onClick={() => go('tonight')}>
          <IconMovie /> Tonight
        </button>
        <button className={`nv ${screen === 'ask' ? 'active' : ''}`} onClick={() => go('ask')}>
          <IconChat /> Ask Fred
        </button>
        <button className={`nv ${screen === 'stack' ? 'active' : ''}`} onClick={() => go('stack')}>
          <IconBookmark /> Stack
        </button>
      </nav>
    </div>
  );
}
