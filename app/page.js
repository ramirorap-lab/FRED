'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
// Auth handled via API routes

const TMDB = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_PLATFORMS = ['Netflix', 'Prime Video'];
const DEFAULT_MOODS     = ['funny'];

const PLATFORMS = ['Netflix', 'Prime Video', 'Hulu', 'Max', 'Apple TV+', 'Disney+', 'Peacock'];
const MOODS = [
  { label: 'Smart',     value: 'smart' },
  { label: 'Dark',      value: 'dark' },
  { label: 'Funny',     value: 'funny' },
  { label: 'Romantic',  value: 'romantic' },
  { label: 'Intense',   value: 'intense' },
  { label: 'Horror',    value: 'horror' },
  { label: 'Adventure', value: 'adventure' },
  { label: 'Family',    value: 'family' },
];

const FRED_GREETINGS = [
  "You actually showed up. Good. Most people just scroll Netflix for 40 minutes and go to bed. Not you. So — what are we working with tonight?",
  "Fred here. Not an algorithm. I don't care what's trending. Tell me what you're feeling and I'll find you something that earns it.",
  "Let's make this count. Life's too short for bad movies and good movies watched at the wrong time. What's tonight about?",
  "Finally, someone who wants a real recommendation. I've seen everything. Ask me anything. What kind of film night are we building?",
  "You came to the right place. Netflix will give you The Gray Man again. I won't. What are you in the mood for?",
  "Ask me anything. Best film about obsession? Underrated 90s thriller? Something Italian that will ruin you for other cinema? I'm here.",
];

const PICK_LABELS = {
  safe:     { label: "Fred's Pick",    cls: 'label-safe' },
  stretch:  { label: 'Worth the Risk', cls: 'label-stretch' },
  wildcard: { label: "Director's Pick", cls: 'label-director' },
};

function stripMd(text) {
  return (text || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
}

function bgClass(title) {
  const l = (title || 'S').charAt(0).toLowerCase();
  const m = {a:'bg-a',b:'bg-b',c:'bg-c',d:'bg-d',e:'bg-e',f:'bg-f',g:'bg-g',
    h:'bg-h',i:'bg-i',k:'bg-k',l:'bg-l',m:'bg-m',n:'bg-n',o:'bg-o',p:'bg-p',
    r:'bg-r',s:'bg-s',t:'bg-t',w:'bg-w',z:'bg-z'};
  return m[l] || 'bg-s';
}

function platformUrl(platform, title) {
  const t = encodeURIComponent(title || '');
  const urls = {
    'Netflix':     `https://www.netflix.com/search?q=${t}`,
    'Prime Video': `https://www.amazon.com/s?k=${t}&i=instant-video`,
    'Hulu':        `https://www.hulu.com/search?query=${t}`,
    'Max':         `https://play.max.com/search?q=${t}`,
    'Apple TV+':   `https://tv.apple.com/search?term=${t}`,
    'Disney+':     `https://www.disneyplus.com/search/${t}`,
    'Peacock':     `https://www.peacocktv.com/search?q=${t}`,
  };
  return urls[platform] || `https://www.google.com/search?q=${t}+streaming`;
}

const I = {
  Bookmark: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  External: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Send:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  X:        () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Movie:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/></svg>,
  Search:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Chat:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Play:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>,
  Eye:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
};

function Poster({ poster, title, bg }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <div className={`poster-ph ${bg}`}>{title?.charAt(0)}</div>
      {poster && !failed && (
        <img
          src={`https://image.tmdb.org/t/p/w500${poster}`}
          alt={title}
          className="poster-img"
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

function FredCard({ msg, onSave }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const bg = bgClass(msg.title);
  const isGreeting = !msg.title;
  return (
    <div className="fred-row">
      <div className="fred-avatar">F</div>
      <div className={`fred-bubble ${isGreeting ? 'fred-greeting' : ''}`}>
        <div className="fred-text">{isGreeting ? stripMd(msg.text) : `"${stripMd(msg.text)}"`}</div>
        {msg.title && (
          <div className="fred-pick-card">
            <div className={`fred-pick-poster ${bg}`}>
              <div className="fred-pick-ph">{msg.title.charAt(0)}</div>
              {msg.poster && !posterFailed && (
                <img src={`${TMDB}${msg.poster}`} alt={msg.title}
                  onError={() => setPosterFailed(true)}
                  style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', objectFit:'cover' }} />
              )}
              <div className="fred-pick-grad" />
              <div className="fred-pick-title-ov">{msg.title}</div>
            </div>
            <div className="fred-pick-footer">
              <div className="fred-pick-meta">{msg.meta}</div>
              <button className="fred-save-btn" onClick={() => onSave(msg)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span>Save</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LetterboxdUpload({ onProfileLoaded }) {
  const [uploading, setUploading] = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const form = new FormData();
      form.append('ratings', file);
      const res  = await fetch('/api/letterboxd', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onProfileLoaded(data.profile);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (done) return (
    <div className="lb-done">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      <span>Letterboxd connected</span>
    </div>
  );

  return (
    <div className="lb-upload">
      <div className="lb-label">Personalize with Letterboxd</div>
      <div className="lb-sub">Export from letterboxd.com/settings/data — upload ratings.csv</div>
      <button className="lb-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {uploading ? 'Analyzing…' : 'Upload ratings.csv'}
      </button>
      {error && <div className="lb-error">{error}</div>}
      <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleFile} />
    </div>
  );
}

function AuthModal({ email, setEmail, onSend, sent, loading, onSkip, onClose }) {
  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <button className="auth-close" onClick={onClose}>✕</button>
        {!sent ? (
          <>
            <div className="auth-logo">Fred</div>
            <div className="auth-title">Remember everything.</div>
            <div className="auth-sub">
              Your picks, your watchlist, your taste — saved forever across all your devices.
            </div>
            <input
              className="auth-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSend()}
              autoFocus
            />
            <button className="auth-btn" onClick={onSend} disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
            <button className="auth-skip" onClick={onSkip}>
              Not now — continue without saving
            </button>
          </>
        ) : (
          <>
            <div className="auth-logo">✓</div>
            <div className="auth-title">Check your email.</div>
            <div className="auth-sub">
              We sent a magic link to <strong>{email}</strong>.<br/>
              Tap it to sign in — no password needed.
            </div>
            <button className="auth-skip" onClick={onSkip}>
              Continue without signing in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Intro({ onDone }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 2000);
    const t3 = setTimeout(() => onDone(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);
  return (
    <div className="intro-screen" style={{ opacity: phase === 2 ? 0 : 1 }}>
      <div className="intro-logo" style={{ opacity: phase >= 0 ? 1 : 0, transform: phase >= 0 ? 'translateY(0)' : 'translateY(16px)' }}>
        Fred
      </div>
      <div className="intro-tagline" style={{ opacity: phase >= 1 ? 1 : 0 }}>
        Your film friend
      </div>
    </div>
  );
}

export default function Fred() {
  const [showIntro,    setShowIntro]    = useState(true);
  const [screen,       setScreen]       = useState('taste');
  const [platforms,    setPlatforms]    = useState(DEFAULT_PLATFORMS);
  const [moods,        setMoods]        = useState(DEFAULT_MOODS);
  const [picks,        setPicks]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [stack,        setStack]        = useState([]);
  const [flippingId,   setFlippingId]   = useState(null);
  const [flippedIn,    setFlippedIn]    = useState(null);
  const [replacingId,  setReplacingId]  = useState(null);
  const [watched,      setWatched]      = useState(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('fred_watched') || '[]'); } catch { return []; }
  });
  const [messages, setMessages] = useState(() => {
    const greeting = FRED_GREETINGS[Math.floor(Math.random() * FRED_GREETINGS.length)];
    return [{ role: 'fred', text: greeting, title: '', meta: '', poster: null }];
  });
  const [chatInput,    setChatInput]    = useState('');
  const [chatLoading,  setChatLoading]  = useState(false);
  const [tasteProfile, setTasteProfile] = useState(null);
  const [user,         setUser]         = useState(null);
  const [pickCount,    setPickCount]    = useState(() => {
    if (typeof window === 'undefined') return 0;
    try { return parseInt(localStorage.getItem('fred_pick_count') || '0'); } catch { return 0; }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail,     setAuthEmail]     = useState('');
  const [authSent,      setAuthSent]      = useState(false);
  const [authLoading,   setAuthLoading]   = useState(false);
  const chatRef = useRef(null);

  const fetchPicks = useCallback(async (plats, mds, profile, seen) => {
    if (!plats.length) return;
    setLoading(true); setError(''); setPicks([]);
    try {
      const params = new URLSearchParams({
        platforms: plats.join(','),
        moods:     mds.join(','),
        ...(profile && { taste: encodeURIComponent(JSON.stringify(profile)) }),
        ...(seen?.length && { exclude: seen.map(w => w.id).join(',') }),
      });
      const res  = await fetch(`/api/picks?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPicks(data.picks || []);
    } catch (e) {
      setError(e.message || "Fred couldn't connect. Try again.");
    } finally { setLoading(false); }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Check session via API
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user);
    }).catch(() => {});
  }, []);

  // Load user data from Supabase via API
  useEffect(() => {
    if (!user) return;
    fetch('/api/auth/userdata').then(r => r.json()).then(d => {
      if (d.watched?.length) setWatched(d.watched);
      if (d.watchlist?.length) setStack(d.watchlist);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem('fred_watched') || '[]'); } catch { return []; }
    })();
    fetchPicks(DEFAULT_PLATFORMS, DEFAULT_MOODS, null, saved);
  }, [fetchPicks]);

  function go(name)          { setScreen(name); }
  function togglePlatform(p) { setPlatforms(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p]); }
  function toggleMood(m)     { setMoods(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev,m]); }
  function loadPicks() {
    const newCount = pickCount + 1;
    setPickCount(newCount);
    try { localStorage.setItem('fred_pick_count', String(newCount)); } catch {}
    if (newCount === 2 && !user) {
      setShowAuthModal(true);
      return;
    }
    go('tonight');
    fetchPicks(platforms, moods, tasteProfile, watched);
  }

  function saveToStack(pick) {
    const id = pick.id || pick.title;
    if (stack.find(s => s.id === id)) return;
    const entry = { ...pick, id };
    setStack(prev => [...prev, entry]);
    try { localStorage.setItem('fred_stack', JSON.stringify([...stack, entry])); } catch {}
    if (user) {
      fetch('/api/auth/save', { method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ tmdb_id: pick.tmdb_id || pick.id, title: pick.title, type: pick.type, platform: pick.platform, poster: pick.poster })
      }).catch(console.error);
    }
  }
  function removeFromStack(id) { setStack(prev => prev.filter(s => s.id !== id)); }

  function markWatched(pick) {
    const entry = { id: pick.tmdb_id || pick.id, title: pick.title, type: pick.type };
    setWatched(prev => {
      if (prev.find(w => w.id === entry.id)) return prev;
      const next = [...prev, entry];
      try { localStorage.setItem('fred_watched', JSON.stringify(next)); } catch {}
      return next;
    });
    if (user) {
      fetch('/api/auth/seen', { method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ tmdb_id: entry.id, title: entry.title, type: entry.type })
      }).catch(console.error);
    }
  }

  function isWatched(pick) {
    return watched.some(w => w.id === (pick.tmdb_id || pick.id));
  }

  async function seenAndReplace(pick) {
    markWatched(pick);
    setFlippingId(pick.id);
    setReplacingId(pick.id);
    const newWatched = [...watched, { id: pick.tmdb_id || pick.id, title: pick.title, type: pick.type }];
    const excludeAll = [...picks, ...newWatched].map(p => p.tmdb_id || p.id).filter(Boolean);
    try {
      const params = new URLSearchParams({
        platforms: platforms.join(','),
        moods:     moods.join(','),
        type:      pick.type,
        exclude:   excludeAll.join(','),
      });
      const res  = await fetch(`/api/replace?${params}`);
      const data = await res.json();
      if (data.picks?.length) {
        const replacement = data.picks.find(p => p.type === pick.type) || data.picks[0];
        setTimeout(() => {
          setPicks(prev => prev.map(p => (p.id === pick.id ? { ...replacement } : p)));
          setFlippingId(null);
          setReplacingId(null);
          setFlippedIn(replacement.id);
          setTimeout(() => setFlippedIn(null), 500);
        }, 320);
      }
    } catch (e) {
      console.error('Replace failed', e);
      setFlippingId(null);
      setReplacingId(null);
    }
  }

  function saveFredPick(msg) {
    saveToStack({ id:`ask-${msg.title}`, title:msg.title,
      platform:msg.meta?.split(' · ')[0]||'', runtime:msg.meta?.split(' · ')[1]||'',
      type:msg.meta?.toLowerCase().includes('series')?'series':'movie', poster:msg.poster||null });
  }

  async function sendMagicLink() {
    if (!authEmail.trim()) return;
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/magic', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: authEmail.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAuthSent(true);
    } catch (e) {
      console.error('Auth error:', e);
    } finally {
      setAuthLoading(false);
    }
  }

  async function sendChat(text) {
    const t = (text || chatInput).trim();
    if (!t || chatLoading) return;
    setChatInput('');
    setMessages(prev => [...prev, { role:'user', text:t }]);
    setChatLoading(true);
    setMessages(prev => [...prev, { role:'fred', thinking:true }]);
    try {
      const res = await fetch('/api/ask', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          message:t, platforms, moods, tasteProfile,
          history: messages.filter(m => !m.thinking).slice(-8),
        }),
      });
      const data = await res.json();
      setMessages(prev => {
        const u = [...prev];
        const idx = u.findLastIndex(m => m.thinking);
        if (idx !== -1) u[idx] = { role:'fred', thinking:false,
          text:data.text||data.error||"Fred couldn't connect.",
          title:data.title||'', meta:data.meta||'', poster:data.poster||null };
        return u;
      });
    } catch {
      setMessages(prev => {
        const u = [...prev];
        const idx = u.findLastIndex(m => m.thinking);
        if (idx !== -1) u[idx] = { role:'fred', thinking:false, text:"Fred couldn't connect. Try again.", title:'', meta:'' };
        return u;
      });
    } finally {
      setChatLoading(false);
      setTimeout(() => chatRef.current?.scrollTo({ top:chatRef.current.scrollHeight, behavior:'smooth' }), 120);
    }
  }

  if (showIntro) return <Intro onDone={() => setShowIntro(false)} />;

  function handleSkipAuth() {
    setShowAuthModal(false);
    // Bump pick count so modal doesn't show again this session
    setPickCount(prev => prev + 1);
    go('tonight');
    fetchPicks(platforms, moods, tasteProfile, watched);
  }

  return (
    <div className="app">

      {showAuthModal && (
        <AuthModal
          email={authEmail}
          setEmail={setAuthEmail}
          onSend={sendMagicLink}
          sent={authSent}
          loading={authLoading}
          onSkip={handleSkipAuth}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* TASTE */}
      <div className={`screen ${screen==='taste'?'active':''}`}>
        <div className="taste-wrap">
          <div className="taste-logo">Fred</div>
          <div className="taste-slogan">Your film friend</div>
          <div className="taste-question">
            What are you<br />
            <strong>in the mood for?</strong>
          </div>
          <div className="t-divider" />
          <div className="mood-list">
            {MOODS.map((m, i) => (
              <div key={m.value} className={`mood-item ${moods.includes(m.value)?'on':''}`}
                onClick={() => toggleMood(m.value)}>
                <span className="mood-num">0{i+1}</span>
                <span className="mood-name">{m.label}</span>
                <span className="mood-check">
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor"><polyline points="2,6 5,9 10,3"/></svg>
                </span>
              </div>
            ))}
          </div>
          <div className="t-divider" />
          <div className="sec-label">Your platforms</div>
          <div className="platform-row">
            {PLATFORMS.map(p => (
              <div key={p} className={`plat-pill ${platforms.includes(p)?'on':''}`}
                onClick={() => togglePlatform(p)}>{p}</div>
            ))}
          </div>
          <div className="t-divider" />
          <LetterboxdUpload onProfileLoaded={profile => setTasteProfile(profile)} />
          <button className="taste-cta" onClick={loadPicks}>Fred's picks</button>
        </div>
      </div>

      {/* PICKS */}
      <div className={`screen ${screen==='tonight'?'active':''}`}>
        <div className="topbar">
          <div className="topbar-logo" onClick={() => go('taste')}>Fred</div>
          <div className="topbar-right" style={{display:'flex',alignItems:'center',gap:'8px'}}>
            {user && <span style={{fontSize:'8px',color:'#00c27a',letterSpacing:'.1em',textTransform:'uppercase'}}>● Saved</span>}
            Picks
          </div>
        </div>
        <div className="tonight-count">
          2 films · 1 series
          {tasteProfile && <span className="taste-badge">↑ Letterboxd</span>}
        </div>
        <div className="picks-wrap">
          {loading && (
            <div className="loading">
              <div className="spinner"/>
              <div className="load-txt">Fred is thinking…</div>
            </div>
          )}
          {!loading && error && (
            <div className="err-txt">{error}<br/><br/>
              <button className="taste-cta" style={{fontSize:'14px',padding:'12px'}} onClick={loadPicks}>Try again</button>
            </div>
          )}
          {!loading && !error && picks.length===0 && (
            <div className="loading"><div className="load-txt">No picks found — try different platforms or mood.</div></div>
          )}
          {!loading && picks.map(pick => {
            const lbl = PICK_LABELS[pick.pick_type] || PICK_LABELS.safe;
            const bg  = bgClass(pick.title);
            const trailerUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(pick.title + ' official trailer')}`;
            return (
              <div key={pick.id} style={{position:'relative'}}>
                {replacingId === pick.id && (
                  <div className="card-replacing">
                    <div className="spinner" style={{width:'18px',height:'18px',borderWidth:'2px'}}/>
                    <span>Good taste — finding something else…</span>
                  </div>
                )}
                <div className={`pick-block ${flippingId === pick.id ? 'is-flipping' : ''} ${flippedIn === pick.id ? 'is-flipped-in' : ''}`}>
                  <div className="pick-header">
                    <span className={`pick-label ${lbl.cls}`}>
                      {pick.pick_type === 'wildcard' && pick.director_name
                        ? `${pick.director_name.split(' ').pop()}'s Pick`
                        : lbl.label}
                    </span>
                    <span className="pick-sep">·</span>
                    <span className={`type-badge ${pick.type === 'series' ? 'type-series' : 'type-film'}`}>
                      {pick.type === 'series' ? 'Series' : 'Film'}
                    </span>
                    <span className="pick-sep">·</span>
                    <span className="plat-name">{pick.platform}</span>
                    <span className="pick-sep">·</span>
                    <span className="pick-meta-line">{[pick.year, pick.runtime].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div className="card">
                    <div className={`poster-wrap ${bg}`}>
                      <Poster poster={pick.poster} title={pick.title} bg={bg} />
                      <div className="poster-grad"/>
                      <div className="poster-title-ov">{pick.title}</div>
                      {pick.letterboxd && (
                        <div className="poster-tl">
                          <span className="bdg bdg-lb">↑ Letterboxd</span>
                        </div>
                      )}
                      {pick.rating && (
                        <div className="poster-score">
                          <div className="score-n">{Number(pick.rating).toFixed(1)}</div>
                          <div className="score-l">IMDB</div>
                        </div>
                      )}
                      <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="trailer-btn" onClick={e => e.stopPropagation()}>
                        <I.Play /> Trailer
                      </a>
                    </div>
                    <div className="card-body">
                      {pick.pick_type === 'wildcard' && pick.director_quote && (
                        <div className="director-note">"{pick.director_quote}" — {pick.director_name}</div>
                      )}
                      {pick.fred_note && <div className="card-note">"{pick.fred_note}"</div>}
                    </div>
                    <div className="card-actions">
                      <button className="ca sv" onClick={() => saveToStack(pick)}><I.Bookmark /> Save</button>
                      <button className={`ca ${isWatched(pick) ? 'ca-seen-active' : ''}`}
                        onClick={() => !isWatched(pick) && seenAndReplace(pick)}>
                        <I.Eye /> {isWatched(pick) ? 'Seen ✓' : 'Seen it'}
                      </button>
                      <a className="ca" href={platformUrl(pick.platform, pick.title)} target="_blank" rel="noopener noreferrer">
                        <I.External /> Open
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ASK FRED */}
      <div className={`screen ${screen==='ask'?'active':''}`} style={{paddingBottom:'130px'}} ref={chatRef}>
        <div className="topbar">
          <div className="topbar-logo" onClick={() => go('taste')}>Fred</div>
          <div className="topbar-right">Ask Fred</div>
        </div>
        <div className="prompt-chips">
          {['Best film about obsession?','Something Italian','Underrated 90s thriller',"Under 90 minutes, no superheroes"].map(p=>(
            <div key={p} className="pc" onClick={() => sendChat(p)}>{p}</div>
          ))}
        </div>
        <div className="chat-area">
          {messages.map((msg,i) => (
            <div key={i}>
              {msg.role==='user' && (
                <div className="user-row">
                  <div className="user-bubble">{msg.text}</div>
                </div>
              )}
              {msg.role==='fred' && (
                msg.thinking ? (
                  <div className="fred-row">
                    <div className="fred-avatar">F</div>
                    <div className="fred-bubble fred-greeting">
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <div className="spinner" style={{width:'14px',height:'14px',borderWidth:'1.5px'}}/>
                        <span style={{fontSize:'11px',color:'var(--dim)',letterSpacing:'.06em'}}>Fred is thinking…</span>
                      </div>
                    </div>
                  </div>
                ) : <FredCard msg={msg} onSave={saveFredPick} />
              )}
            </div>
          ))}
        </div>
        <div className="chat-bar">
          <input className="ci" value={chatInput} onChange={e=>setChatInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="Ask Fred something specific…" disabled={chatLoading}/>
          <button className="cs" onClick={() => sendChat()} disabled={chatLoading}><I.Send /></button>
        </div>
      </div>

      {/* WATCHLIST */}
      <div className={`screen ${screen==='watchlist'?'active':''}`}>
        <div className="topbar">
          <div className="topbar-logo" onClick={() => go('taste')}>Fred</div>
          <div className="topbar-right">Watchlist</div>
        </div>
        <div className="st-list">
          {stack.length===0 ? (
            <div className="empty">
              <div className="empty-icon"><I.Bookmark /></div>
              <div className="empty-text">Nothing saved yet.<br/>Save picks from Picks or Ask Fred.</div>
            </div>
          ) : stack.map(item=>(
            <div className="si" key={item.id}>
              {item.poster ? <img src={`${TMDB}${item.poster}`} alt={item.title} className="si-img" onError={e=>{e.target.style.display='none';}}/>
                : <div className={`si-ph ${bgClass(item.title)}`}>{item.title?.charAt(0)}</div>}
              <div className="si-info">
                <div className="si-type">{item.type==='series'?'Series':'Film'}</div>
                <div className="si-title">{item.title}</div>
                <div className="si-meta">{item.platform} · {item.runtime}</div>
              </div>
              <button className="si-rm" onClick={() => removeFromStack(item.id)}><I.X /></button>
            </div>
          ))}
        </div>
      </div>

      {/* NAV */}
      <nav className="nav">
        <button className={`nv ${screen==='taste'?'active':''}`}     onClick={() => go('taste')}>    <I.Search />   Search   </button>
        <button className={`nv ${screen==='tonight'?'active':''}`}   onClick={() => go('tonight')}>  <I.Movie />    Picks    </button>
        <button className={`nv ${screen==='ask'?'active':''}`}       onClick={() => go('ask')}>      <I.Chat />     Ask Fred </button>
        <button className={`nv ${screen==='watchlist'?'active':''}`} onClick={() => go('watchlist')}><I.Bookmark /> Watchlist</button>
      </nav>
    </div>
  );
}
