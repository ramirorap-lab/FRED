'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const TMDB = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_PLATFORMS = ['Netflix', 'Prime Video'];
const DEFAULT_MOODS     = ['smart', 'dark'];

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

const I = {
  Bookmark: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  Refresh:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  External: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Send:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  X:        () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Movie:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/></svg>,
  Search:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Chat:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Play:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>,
  Upload:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Check:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>,
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
  return (
    <div className="fred-bubble">
      <div className="fred-text">"{stripMd(msg.text)}"</div>
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
              <I.Bookmark /><span>Save</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LetterboxdUpload({ onProfileLoaded }) {
  const [uploading, setUploading]   = useState(false);
  const [done,      setDone]        = useState(false);
  const [error,     setError]       = useState('');
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
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (done) return (
    <div className="lb-done">
      <I.Check />
      <span>Letterboxd connected — Fred knows your taste</span>
    </div>
  );

  return (
    <div className="lb-upload">
      <div className="lb-label">Personalize with Letterboxd</div>
      <div className="lb-sub">Export your data from letterboxd.com/settings/data and upload ratings.csv</div>
      <button className="lb-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
        <I.Upload />
        {uploading ? 'Analyzing…' : 'Upload ratings.csv'}
      </button>
      {error && <div className="lb-error">{error}</div>}
      <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleFile} />
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
  const [messages,     setMessages]     = useState([]);
  const [chatInput,    setChatInput]    = useState('');
  const [chatLoading,  setChatLoading]  = useState(false);
  const [tasteProfile, setTasteProfile] = useState(null);
  const chatRef = useRef(null);

  const fetchPicks = useCallback(async (plats, mds, profile) => {
    if (!plats.length) return;
    setLoading(true); setError(''); setPicks([]);
    try {
      const params = new URLSearchParams({
        platforms: plats.join(','),
        moods:     mds.join(','),
        ...(profile && { taste: encodeURIComponent(JSON.stringify(profile)) }),
      });
      const res  = await fetch(`/api/picks?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPicks(data.picks || []);
    } catch (e) {
      setError(e.message || "Fred couldn't connect. Try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPicks(DEFAULT_PLATFORMS, DEFAULT_MOODS, null); }, [fetchPicks]);

  function go(name)          { setScreen(name); }
  function togglePlatform(p) { setPlatforms(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p]); }
  function toggleMood(m)     { setMoods(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev,m]); }
  function loadPicks()       { go('tonight'); fetchPicks(platforms, moods, tasteProfile); }

  function saveToStack(pick) {
    const id = pick.id || pick.title;
    if (stack.find(s => s.id === id)) return;
    setStack(prev => [...prev, { ...pick, id }]);
  }
  function removeFromStack(id) { setStack(prev => prev.filter(s => s.id !== id)); }

  function saveFredPick(msg) {
    saveToStack({ id:`ask-${msg.title}`, title:msg.title,
      platform:msg.meta?.split(' · ')[0]||'', runtime:msg.meta?.split(' · ')[1]||'',
      type:msg.meta?.toLowerCase().includes('series')?'series':'movie', poster:msg.poster||null });
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
        body:JSON.stringify({ message:t, platforms, moods, tasteProfile }),
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

  return (
    <div className="app">

      {/* TASTE */}
      <div className={`screen ${screen==='taste'?'active':''}`}>
        <div className="taste-wrap">
          <div className="taste-logo">Fred</div>
          <div className="taste-slogan">Your film friend</div>
          <div className="taste-question">
            What are you<br />
            <strong>in the mood for</strong><br />
            tonight?
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
          <LetterboxdUpload onProfileLoaded={profile => {
            setTasteProfile(profile);
          }} />
          <button className="taste-cta" onClick={loadPicks}>
            Tonight's picks
          </button>
        </div>
      </div>

      {/* TONIGHT */}
      <div className={`screen ${screen==='tonight'?'active':''}`}>
        <div className="topbar">
          <div className="topbar-logo" onClick={() => go('taste')}>Fred</div>
          <div className="topbar-right">Tonight</div>
        </div>
        <div className="tonight-count">
          2 films · 1 series · curated for you
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
              <div key={pick.id}>
                <div className="pick-header">
                  <span className={`pick-label ${lbl.cls}`}>
                    {pick.pick_type === 'wildcard' && pick.director_name
                      ? `${pick.director_name.split(' ').pop()}'s Pick`
                      : lbl.label}
                  </span>
                  <span className="pick-sep">·</span>
                  <span className="plat-name">{pick.platform}</span>
                  <span className="pick-sep">·</span>
                  <span className="pick-meta-line">{[pick.year, pick.runtime, pick.type==='series'?'Series':'Film'].filter(Boolean).join(' · ')}</span>
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
                    <button className="ca" onClick={loadPicks}><I.Refresh /> More</button>
                    <button className="ca"><I.External /> Open</button>
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
          {['Smart but not depressing','Under 45 minutes','Like The Bear but calmer',"I'm exhausted, easy pick"].map(p=>(
            <div key={p} className="pc" onClick={() => sendChat(p)}>{p}</div>
          ))}
        </div>
        <div className="chat-area">
          {messages.map((msg,i) => (
            <div key={i}>
              {msg.role==='user' && <div className="user-msg-wrap"><span className="user-msg">{msg.text}</span></div>}
              {msg.role==='fred' && (
                msg.thinking ? (
                  <div className="fred-bubble">
                    <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                      <div className="spinner" style={{width:'16px',height:'16px',borderWidth:'1.5px'}}/>
                      <span style={{fontSize:'11px',color:'var(--dim)',letterSpacing:'.1em',textTransform:'uppercase'}}>Fred is thinking…</span>
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
              <div className="empty-text">Nothing saved yet.<br/>Save picks from Tonight or Ask Fred.</div>
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
        <button className={`nv ${screen==='tonight'?'active':''}`}   onClick={() => go('tonight')}>  <I.Movie />    Tonight  </button>
        <button className={`nv ${screen==='ask'?'active':''}`}       onClick={() => go('ask')}>      <I.Chat />     Ask Fred </button>
        <button className={`nv ${screen==='watchlist'?'active':''}`} onClick={() => go('watchlist')}><I.Bookmark /> Watchlist</button>
      </nav>
    </div>
  );
}
