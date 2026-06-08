'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

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
  Share:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
};

function Poster({ poster, title, bg, useBackdrop }) {
  const [failed, setFailed] = useState(false);
  // Backdrops use w1280 for crisp 16:9, posters use w500
  const size = useBackdrop ? 'w1280' : 'w500';
  return (
    <>
      <div className={`poster-ph ${bg}`}>{title?.charAt(0)}</div>
      {poster && !failed && (
        <img
          src={`https://image.tmdb.org/t/p/${size}${poster}`}
          alt={title}
          className="poster-img"
          style={{ objectPosition: useBackdrop ? 'center center' : 'center top' }}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

function FredCard({ msg, onSave }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [usePoster, setUsePoster]       = useState(false); // fallback to poster if backdrop fails
  const bg = bgClass(msg.title);
  const isGreeting = !msg.title;
  const trailerUrl = msg.title
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(msg.title + ' official trailer')}`
    : null;
  return (
    <div className="fred-row">
      <div className="fred-avatar">F</div>
      <div className={`fred-bubble ${isGreeting ? 'fred-greeting' : ''}`}>
        <div className="fred-text">{isGreeting ? stripMd(msg.text) : `"${stripMd(msg.text)}"`}</div>
        {msg.title && (
          <div className="fred-pick-card">
            <div className={`fred-pick-poster ${bg}`}>
              <div className="fred-pick-ph">{msg.title.charAt(0)}</div>
              {!posterFailed && (msg.backdrop || msg.poster) && (
                <img
                  src={usePoster
                    ? `https://image.tmdb.org/t/p/w500${msg.poster}`
                    : `https://image.tmdb.org/t/p/w780${msg.backdrop || msg.poster}`}
                  alt={msg.title}
                  onError={() => {
                    if (!usePoster && msg.poster && msg.backdrop) {
                      setUsePoster(true); // backdrop failed, try poster
                    } else {
                      setPosterFailed(true);
                    }
                  }}
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    objectPosition: (msg.backdrop && !usePoster) ? 'center center' : 'center top',
                  }}
                />
              )}
              <div className="fred-pick-grad" />
              <div className="fred-pick-title-ov">{msg.title}</div>
              {trailerUrl && (
                <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="trailer-btn"
                  style={{position:'absolute',bottom:'10px',right:'10px'}}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5"/><polygon points="10 8 16 12 10 16"/></svg>
                  Trailer
                </a>
              )}
            </div>
            <div className="fred-pick-footer">
              {msg.awardBadge && (
                <div className="fred-award-badge">{msg.awardBadge}</div>
              )}
              <div className="fred-pick-meta">
                {[
                  msg.platform || (msg.meta ? msg.meta.split(' · ')[0] : ''),
                  msg.runtime  || (msg.meta ? msg.meta.split(' · ')[1] : ''),
                  msg.rating   ? `★ ${msg.rating}` : null,
                ].filter(Boolean).join(' · ')}
              </div>
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
  const chatRef       = useRef(null);
  const seenPickIds   = useRef(new Set()); // accumulates all shown pick IDs across refreshes
  const searchRef    = useRef(null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone,    setSearchDone]    = useState(false);
  const [personName,    setPersonName]    = useState('');
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const pullStartY  = useRef(null);
  const [pullDist,       setPullDist]       = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);

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
      const newPicks = data.picks || [];
      // Track all shown IDs so refreshes never repeat
      newPicks.forEach(p => seenPickIds.current.add(p.tmdb_id || p.id));
      setPicks(newPicks);
    } catch (e) {
      setError(e.message || "Fred couldn't connect. Try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user);
    }).catch(() => {});
  }, []);

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
    // Reset seen IDs on fresh search — new mood/platform = new slate
    seenPickIds.current = new Set();
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
    saveToStack({
      id: `ask-${msg.title}`,
      title: msg.title,
      platform: msg.platform || (msg.meta ? msg.meta.split(' · ')[0] : ''),
      runtime:  msg.runtime  || (msg.meta ? msg.meta.split(' · ')[1] : ''),
      type: msg.meta?.toLowerCase().includes('series') ? 'series' : 'movie',
      poster: msg.poster || null,
      tmdb_id: msg.tmdb_id || null,
    });
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

  const [sharingId, setSharingId] = useState(null);

  async function sharePick(pick) {
    if (sharingId) return;
    const pickId = pick.id || pick.tmdb_id;
    setSharingId(pickId);

    try {
      // Portrait card 540x960 — perfect for Stories/WhatsApp
      const W = 540, H = 960, PAD = 40;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      const drawCard = (img) => {
        ctx.fillStyle = '#0E0E0F';
        ctx.fillRect(0, 0, W, H);

        if (img) {
          const imgH = H * 0.58;
          const scale = Math.max(W / img.width, imgH / img.height);
          const iw = img.width * scale, ih = img.height * scale;
          ctx.save();
          ctx.beginPath(); ctx.rect(0, 0, W, imgH); ctx.clip();
          ctx.drawImage(img, (W - iw) / 2, (imgH - ih) / 2, iw, ih);
          ctx.restore();
          const grad = ctx.createLinearGradient(0, imgH * 0.35, 0, imgH);
          grad.addColorStop(0, 'rgba(14,14,15,0)');
          grad.addColorStop(1, 'rgba(14,14,15,1)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, imgH);
        }

        // Rating badge
        if (pick.rating) {
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.beginPath(); ctx.roundRect(W - 82, 24, 62, 50, 6); ctx.fill();
          ctx.fillStyle = '#F5C518'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
          ctx.fillText(pick.rating, W - 51, 48);
          ctx.fillStyle = '#666'; ctx.font = '11px Arial';
          ctx.fillText('TMDB', W - 51, 64);
        }

        let y = H * 0.58 + 16;

        // FRED SAYS label
        ctx.textAlign = 'left';
        ctx.font = 'bold 12px Arial'; ctx.fillStyle = '#E50914';
        ctx.fillText('FRED SAYS WATCH THIS', PAD, y); y += 32;

        // Title
        ctx.font = 'bold 44px Georgia'; ctx.fillStyle = '#fff';
        const wds = (pick.title || '').split(' ');
        let ln = ''; const tLines = [];
        for (const w of wds) {
          const t = ln ? ln + ' ' + w : w;
          if (ctx.measureText(t).width > W - PAD * 2 && ln) { tLines.push(ln); ln = w; } else ln = t;
        }
        tLines.push(ln);
        tLines.slice(0, 2).forEach(l => { ctx.fillText(l, PAD, y); y += 54; });

        // Note
        if (pick.fred_note) {
          y += 12;
          ctx.font = 'italic 17px Georgia'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
          const note = (pick.fred_note || '').replace(/^"|"$/g, '');
          const nwds = note.split(' '); let nl = ''; const nLines = [];
          for (const w of nwds) {
            const t = nl ? nl + ' ' + w : w;
            if (ctx.measureText(t).width > W - PAD * 2 && nl) { nLines.push(nl); nl = w; } else nl = t;
          }
          nLines.push(nl);
          nLines.slice(0, 3).forEach(l => { ctx.fillText(l, PAD, y); y += 26; });
        }

        // Bottom bar
        const by = H - 52;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD, by); ctx.lineTo(W - PAD, by); ctx.stroke();
        ctx.font = '12px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'left';
        ctx.fillText((pick.platform || '').toUpperCase(), PAD, by + 24);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#E50914'; ctx.font = 'bold 15px Georgia';
        ctx.fillText('FRED', W - PAD, by + 24);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '11px Arial';
        ctx.fillText('fred-psi.vercel.app', W - PAD, by + 40);
      };

      const imgSrc = (pick.backdrop || pick.poster)
        ? 'https://image.tmdb.org/t/p/w780' + (pick.backdrop || pick.poster)
        : null;

      const finishShare = async () => {
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        if (!blob) { setSharingId(null); return; }
        const fname = 'fred-' + (pick.title||'pick').replace(/[^a-z0-9]/gi,'-').toLowerCase() + '.png';
        const file = new File([blob], fname, { type: 'image/png' });
        try {
          // Deep links to the film on each platform
          const t = encodeURIComponent(pick.title || '');
          const platformLinks = {
            'Netflix':          `https://www.netflix.com/search?q=${t}`,
            'Prime Video':      `https://www.amazon.com/s?k=${t}&i=instant-video`,
            'Amazon Prime Video': `https://www.amazon.com/s?k=${t}&i=instant-video`,
            'Hulu':             `https://www.hulu.com/search?query=${t}`,
            'Max':              `https://play.max.com/search?q=${t}`,
            'Apple TV+':        `https://tv.apple.com/search?term=${t}`,
            'Disney+':          `https://www.disneyplus.com/search/${t}`,
            'Peacock':          `https://www.peacocktv.com/search?q=${t}`,
            'Paramount+':       `https://www.paramountplus.com/search/?q=${t}`,
            'Criterion Channel':`https://www.criterionchannel.com/search#stq=${t}`,
            'Mubi':             `https://mubi.com/search/${t}`,
          };
          const platform = pick.platform || '';
          const watchUrl = platformLinks[platform] || `https://www.google.com/search?q=${t}+streaming+watch+online`;

          const year = pick.year ? ` (${pick.year})` : '';
          const rating = pick.rating ? ` · ${pick.rating}/10` : '';
          const note = pick.fred_note ? pick.fred_note.replace(/^"|"$/g, '') : '';
          const shareText = [
            `Fred picked: ${pick.title}${year}${rating}`,
            note ? `"${note}"` : '',
            `Watch on ${platform || 'streaming'}`,
          ].filter(Boolean).join('\n\n');

          if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: pick.title, text: shareText, url: watchUrl });
          } else if (navigator.share) {
            await navigator.share({ title: pick.title, text: shareText, url: watchUrl });
          } else {
            const url = URL.createObjectURL(blob);
            Object.assign(document.createElement('a'), { href: url, download: fname }).click();
            URL.revokeObjectURL(url);
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            const url = URL.createObjectURL(blob);
            Object.assign(document.createElement('a'), { href: url, download: fname }).click();
            URL.revokeObjectURL(url);
          }
        }
        setSharingId(null);
      };

      if (imgSrc) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { drawCard(img); finishShare(); };
        img.onerror = () => { drawCard(null); finishShare(); };
        img.src = imgSrc;
      } else {
        drawCard(null);
        finishShare();
      }
    } catch (e) {
      console.error('Share failed:', e);
      setSharingId(null);
    }
  }

  async function runSearch(q) {
    const query = (q || searchQuery).trim();
    if (!query) return;
    setSearchLoading(true);
    setSearchDone(false);
    setSearchResults([]);
    setPersonName('');
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
      setPersonName(data.person_name || '');
      setSearchDone(true);
    } catch {
      setSearchDone(true);
    } finally {
      setSearchLoading(false);
    }
  }

  // Typewriter for taste screen
  useEffect(() => {
    const phrases = [
      "Tell me what kind of night this is.",
      "I don't do algorithms. I do taste.",
      "Pick a mood. I'll find something that earns it.",
      "Life's too short for bad films.",
      "No trending lists. Just one real rec.",
    ];
    let pi = 0, ci = 0, del = false, timer;
    const el = document.getElementById('tasteTyper');
    if (!el) return;
    function type() {
      const p = phrases[pi];
      if (!del) {
        el.textContent = p.slice(0, ++ci);
        if (ci === p.length) { del = true; timer = setTimeout(type, 2600); return; }
      } else {
        el.textContent = p.slice(0, --ci);
        if (ci === 0) { del = false; pi = (pi+1) % phrases.length; timer = setTimeout(type, 350); return; }
      }
      timer = setTimeout(type, del ? 20 : 46);
    }
    timer = setTimeout(type, 700);
    return () => clearTimeout(timer);
  }, []);

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice not supported in this browser.'); return; }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    recognitionRef.current = r;
    r.onstart  = () => setListening(true);
    r.onend    = () => setListening(false);
    r.onerror  = () => setListening(false);
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      sendChat(transcript);
    };
    r.start();
  }

  async function sendChat(text) {
    const t = (text || chatInput).trim();
    if (!t || chatLoading) return;
    setChatInput('');
    const userMsg = { role: 'user', text: t };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    setMessages(prev => [...prev, { role: 'fred', thinking: true }]);
    try {
      const conversationHistory = messages
        .filter(m => !m.thinking)
        .slice(-10)
        .map(m => ({
          role: m.role,
          text: m.text || '',
          tmdb_id: m.tmdb_id || null,
        }));
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: t,
          platforms,
          moods,
          tasteProfile,
          conversationHistory,
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
          platform: data.platform || '',
          runtime: data.runtime || '',
          poster: data.poster || null,
          backdrop: data.backdrop || null,
          tmdb_id: data.tmdb_id || null,
          rating: data.rating ? String(data.rating) : null,
          awardBadge: data.awardBadge || null,
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
          title: '', meta: '', platform: '', runtime: '',
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

  // ── Pull-to-refresh handlers ──
  function onTouchStart(e) {
    const el = e.currentTarget;
    // Only activate pull if truly at the top and not already refreshing
    if (el.scrollTop === 0 && !pullRefreshing) {
      pullStartY.current = e.touches[0].clientY;
    }
  }
  function onTouchMove(e) {
    if (pullStartY.current === null) return;
    const dist = e.touches[0].clientY - pullStartY.current;
    if (dist <= 0) {
      // Scrolling up — cancel pull
      pullStartY.current = null;
      setPullDist(0);
      return;
    }
    const capped = Math.min(dist, 90);
    setPullDist(capped);
    // Haptic at threshold — fire once when crossing 70px
    if (capped >= 70 && pullDist < 70) {
      navigator.vibrate?.(12);
    }
  }
  async function onTouchEnd() {
    // Threshold raised to 70px — much harder to trigger accidentally
    if (pullDist >= 70 && !pullRefreshing && !loading) {
      navigator.vibrate?.(25);
      setPullRefreshing(true);
      setPullDist(0);
      pullStartY.current = null;
      const allSeen = [
        ...watched,
        ...[...seenPickIds.current].map(id => ({ id })),
      ];
      await fetchPicks(platforms, moods, tasteProfile, allSeen);
      setPullRefreshing(false);
    } else {
      setPullDist(0);
      pullStartY.current = null;
    }
  }

  if (showIntro) return <Intro onDone={() => setShowIntro(false)} />;

  function handleSkipAuth() {
    setShowAuthModal(false);
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
        <div className="taste-poster">
          <div className="taste-topbar">
            <div className="taste-logo">Fred{user && <span className="fred-online-dot"/>}</div>
            <div className="taste-tagline">Your film friend</div>
          </div>
          <div className="taste-headline">FIND<br/>TONIGHT'S<br/>FILM.</div>
          <div className="taste-typer" id="tasteTyper"></div>
        </div>

        <div className="mood-list">
          {MOODS.map((m, i) => (
            <div key={m.value} className={`mood-item ${moods.includes(m.value)?'on':''}`}
              onClick={() => toggleMood(m.value)}>
              <span className="mood-num">0{i+1}</span>
              <span className="mood-name">{m.label}</span>
              <span className="mood-dot"/>
            </div>
          ))}
        </div>

        <div className="taste-bottom">
          <div className="sec-label">Your platforms</div>
          <div className="platform-row">
            {PLATFORMS.map(p => (
              <div key={p} className={`plat-pill ${platforms.includes(p)?'on':''}`}
                onClick={() => togglePlatform(p)}>{p}</div>
            ))}
          </div>
          <LetterboxdUpload onProfileLoaded={profile => setTasteProfile(profile)} />
          <button className="taste-cta" onClick={loadPicks}>Fred's picks</button>
        </div>
      </div>

      {/* PICKS */}
      <div
        className={`screen ${screen==='tonight'?'active':''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div style={{
          height: pullRefreshing ? 44 : pullDist * 0.5,
          overflow: 'hidden',
          transition: pullDist === 0 ? 'height .25s ease' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {(pullDist > 20 || pullRefreshing) && (
            <div style={{display:'flex',alignItems:'center',gap:'8px',opacity: Math.min(pullDist/55,1)}}>
              <div className="spinner" style={{width:'14px',height:'14px',borderWidth:'1.5px'}}/>
              <span style={{fontSize:'11px',color:'var(--dim)',letterSpacing:'.06em'}}>
                {pullRefreshing ? 'Refreshing…' : 'Pull to refresh'}
              </span>
            </div>
          )}
        </div>
        <div className="topbar">
          <div className="topbar-logo" onClick={() => go('taste')}>
            Fred{user && <span className="fred-online-dot"/>}
          </div>
          <div className="topbar-right" style={{display:'flex',alignItems:'center',gap:'12px'}}>
            {user && <span style={{fontSize:'8px',color:'#00c27a',letterSpacing:'.1em',textTransform:'uppercase'}}>● Saved</span>}
            <span style={{fontSize:'10px',letterSpacing:'.1em',textTransform:'uppercase',color:'#666'}}>Picks</span>
            <button
              onClick={() => {
                if (loading || pullRefreshing) return;
                const allSeen = [
                  ...watched,
                  ...[...seenPickIds.current].map(id => ({ id })),
                ];
                fetchPicks(platforms, moods, tasteProfile, allSeen);
              }}
              disabled={loading || pullRefreshing}
              style={{
                background:'none', border:'.5px solid #2a2a2d', borderRadius:'50%',
                width:'28px', height:'28px', display:'flex', alignItems:'center',
                justifyContent:'center', cursor:'pointer', color:'#555',
                transition:'all .2s', flexShrink:0,
                opacity: (loading || pullRefreshing) ? .4 : 1,
              }}
              title="Refresh picks"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                width="13" height="13"
                style={{
                  animation: (loading || pullRefreshing) ? 'spin .8s linear infinite' : 'none'
                }}>
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="tonight-mood-header">
          <div className="tonight-mood-label">
            {moods.length > 0
              ? moods.map(m => m.toUpperCase()).join(' + ')
              : "TONIGHT"}
          </div>
          <div className="tonight-picks-sub">Tonight's picks</div>
          <div className="tonight-count-sub">
            2 films · 1 series
            {tasteProfile && <span className="taste-badge">↑ Letterboxd</span>}
          </div>
        </div>
        <div className="picks-wrap">
          {loading && (
            <div className="loading">
              <div className="spinner"/>
              <div className="load-txt-main">Finding your picks…</div>
              <div className="load-txt-sub">2 films + 1 series curated for {moods.length ? moods.join(' & ') : 'tonight'}</div>
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
                    <span className={`pick-label ${
                      pick.pick_type === 'reddit'      ? 'label-reddit' :
                      pick.pick_type === 'documentary' ? 'label-doc' :
                      pick.is_recent                   ? 'label-recent' :
                      lbl.cls
                    }`}>
                      {pick.pick_type === 'reddit'
                        ? `↑ Reddit`
                        : pick.pick_type === 'documentary'
                          ? 'Documentary'
                          : pick.is_recent
                            ? `✦ ${pick.year}`
                            : pick.pick_type === 'wildcard' && pick.director_name
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
                      <Poster poster={pick.backdrop || pick.poster} title={pick.title} bg={bg} useBackdrop={!!pick.backdrop} />
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
                      <button className={`ca sv ${stack.find(s => s.id === (pick.id || pick.title)) ? 'ca-saved' : ''}`}
                        onClick={() => saveToStack(pick)}>
                        <I.Bookmark /> {stack.find(s => s.id === (pick.id || pick.title)) ? 'Saved' : 'Save'}
                      </button>
                      <button className={`ca ${isWatched(pick) ? 'ca-seen-active' : ''}`}
                        onClick={() => seenAndReplace(pick)}>
                        <I.Eye /> {isWatched(pick) ? 'Seen ✓' : 'Seen it'}
                      </button>
                      <a className="ca" href={platformUrl(pick.platform, pick.title)} target="_blank" rel="noopener noreferrer">
                        <I.External /> Open
                      </a>
                      <button className={`ca ${sharingId === (pick.id || pick.title) ? 'ca-sharing' : ''}`}
                        onClick={() => sharePick(pick)}>
                        {sharingId === (pick.id || pick.title)
                          ? <div className="spinner" style={{width:'11px',height:'11px',borderWidth:'1.5px'}}/>
                          : <I.Share />}
                        Share
                      </button>
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
          <div className="topbar-logo" onClick={() => go('taste')}>
            Fred{user && <span className="fred-online-dot"/>}
          </div>
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
          <button className={`cm ${listening ? 'cm-active' : ''}`} onClick={startVoice} disabled={chatLoading} aria-label="Voice input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <rect x="9" y="2" width="6" height="12" rx="3"/>
              <path d="M5 10a7 7 0 0 0 14 0"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
              <line x1="9" y1="22" x2="15" y2="22"/>
            </svg>
          </button>
          <button className="cs" onClick={() => sendChat()} disabled={chatLoading}><I.Send /></button>
        </div>
      </div>

      {/* SEARCH */}
      <div className={`screen ${screen==='search'?'active':''}`} ref={searchRef}>
        <div className="topbar">
          <div className="topbar-logo" onClick={() => go('taste')}>
            Fred{user && <span className="fred-online-dot"/>}
          </div>
          <div className="topbar-right">Search</div>
        </div>

        <div className="search-bar-wrap">
          <div className="search-input-row">
            <input
              className="search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="Title, actor, director…"
              autoComplete="off"
            />
            {searchQuery ? (
              <button className="search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchDone(false); }}>
                <I.X />
              </button>
            ) : (
              <button className="search-go" onClick={() => runSearch()}>
                <I.Search />
              </button>
            )}
          </div>
          <div className="search-chips">
            {['Kubrick','Cate Blanchett','Parasite','Wong Kar-wai','The Godfather'].map(s => (
              <div key={s} className="pc" onClick={() => { setSearchQuery(s); runSearch(s); }}>{s}</div>
            ))}
          </div>
        </div>

        <div className="search-results">
          {searchLoading && (
            <div className="loading">
              <div className="spinner"/>
              <div className="load-txt">Searching…</div>
            </div>
          )}

          {!searchLoading && searchDone && searchResults.length === 0 && (
            <div className="loading">
              <div className="load-txt">Nothing found — try a different spelling.</div>
            </div>
          )}

          {!searchLoading && personName && (
            <div className="search-person-label">Best of {personName}</div>
          )}

          {!searchLoading && searchResults.map(result => {
            const bg = bgClass(result.title);
            const trailerUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(result.title + ' official trailer')}`;
            return (
              <div key={result.id} className="search-result-item">
                <div className="pick-header">
                  {result.award_badge && (
                    <span className="pick-label" style={{color:'#c9a84c',background:'rgba(201,168,76,.1)',border:'.5px solid rgba(201,168,76,.25)'}}>
                      {result.award_badge}
                    </span>
                  )}
                  {!result.award_badge && (
                    <span className={`pick-label ${result.type === 'series' ? 'type-series' : 'label-safe'}`}>
                      {result.type === 'series' ? 'Series' : 'Film'}
                    </span>
                  )}
                  <span className="pick-sep">·</span>
                  <span className="plat-name">{result.platform}</span>
                  <span className="pick-sep">·</span>
                  <span className="pick-meta-line">{result.year}{result.runtime ? ` · ${result.runtime}` : ''}</span>
                </div>
                <div className="card">
                  <div className={`poster-wrap ${bg}`}>
                    <Poster
                      poster={result.backdrop || result.poster}
                      title={result.title}
                      bg={bg}
                      useBackdrop={!!result.backdrop}
                    />
                    <div className="poster-grad"/>
                    <div className="poster-title-ov">{result.title}</div>
                    {result.rating && (
                      <div className="poster-score">
                        <div className="score-n">{result.rating}</div>
                        <div className="score-l">TMDB</div>
                      </div>
                    )}
                    <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="trailer-btn">
                      <I.Play /> Trailer
                    </a>
                  </div>
                  {result.overview ? (
                    <div className="card-body">
                      <div className="card-note">"{result.overview.length > 160 ? result.overview.slice(0,157)+'…' : result.overview}"</div>
                    </div>
                  ) : null}
                  <div className="card-actions">
                    <button className={`ca sv ${stack.find(s => s.id === result.id) ? 'ca-saved' : ''}`}
                      onClick={() => saveToStack(result)}>
                      <I.Bookmark /> {stack.find(s => s.id === result.id) ? 'Saved' : 'Save'}
                    </button>
                    <button className={`ca ${isWatched(result) ? 'ca-seen-active' : ''}`}
                      onClick={() => markWatched(result)}>
                      <I.Eye /> {isWatched(result) ? 'Seen ✓' : 'Seen it'}
                    </button>
                    <a className="ca" href={`https://www.google.com/search?q=${encodeURIComponent(result.title + ' streaming')}`}
                      target="_blank" rel="noopener noreferrer">
                      <I.External /> Open
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WATCHLIST */}
      <div className={`screen ${screen==='watchlist'?'active':''}`}>
        <div className="topbar">
          <div className="topbar-logo" onClick={() => go('taste')}>
            Fred{user && <span className="fred-online-dot"/>}
          </div>
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
        <button className={`nv ${screen==='search'?'active':''}`}   onClick={() => go('search')}>   <I.Search />   Search   </button>
        <button className={`nv ${screen==='tonight'?'active':''}`}   onClick={() => go('tonight')}>  <I.Movie />    Picks    </button>
        <button className={`nv ${screen==='ask'?'active':''}`}       onClick={() => go('ask')}>      <I.Chat />     Ask Fred </button>
        <button className={`nv ${screen==='watchlist'?'active':''}`} onClick={() => go('watchlist')}><I.Bookmark /> Watchlist</button>
      </nav>
    </div>
  );
}
