'use client';

import { useState, useRef, useEffect } from 'react';

const TMDB = 'https://image.tmdb.org/t/p/w500';

const PLATFORMS = ['Netflix', 'Prime Video', 'Hulu', 'Max', 'Apple TV+', 'Disney+', 'Peacock'];
const MOODS = [
  { label: 'Chill',         value: 'chill' },
  { label: 'Smart',         value: 'smart' },
  { label: 'Funny',         value: 'funny' },
  { label: 'Dark',          value: 'dark' },
  { label: 'Romantic',      value: 'romantic' },
  { label: 'Intense',       value: 'intense' },
  { label: 'Short',         value: 'short' },
  { label: 'Award-winning', value: 'award' },
];

// Ask Fred — keyword-matched responses
const FRED_LINES = [
  { k:['tired','exhausted','easy','anything','simple'],
    text:"Abbott Elementary. Twenty-five minutes. You'll laugh three times before you realize you feel better.",
    title:"Abbott Elementary", meta:"Hulu · Series · 22 min" },
  { k:['short','45','quick','brief'],
    text:"Baby Reindeer. Six episodes, twenty-five minutes each. Starts unsettling, ends devastating.",
    title:"Baby Reindeer", meta:"Netflix · Limited series · 25 min" },
  { k:['bear','stress','anxious','calm','relax'],
    text:"Slow Horses. Same pressure-cooker energy, but British intelligence instead of kitchens. Gary Oldman is extraordinary.",
    title:"Slow Horses", meta:"Apple TV+ · Series" },
  { k:['funny','laugh','comedy','lighten'],
    text:"The Holdovers. Paul Giamatti at his absolute peak. Warm, sharp, and funnier than the trailer suggests.",
    title:"The Holdovers", meta:"Peacock · 2h 13m" },
  { k:['dark','grim','heavy','bleak'],
    text:"Ripley. Black and white, obsessive, gorgeous. The kind of show you watch slowly and feel the weight of.",
    title:"Ripley", meta:"Netflix · Series" },
  { k:['smart','think','intelligent','cerebral'],
    text:"Severance. The most original concept on television right now. Gets inside your head and stays.",
    title:"Severance", meta:"Apple TV+ · Series" },
  { k:['romantic','love','romance','date','feelings'],
    text:"Past Lives. Quiet, emotionally precise, not sleepy. Makes your night feel intentional.",
    title:"Past Lives", meta:"Prime Video · 1h 46m" },
  { k:['intense','thriller','edge','seat','tension'],
    text:"Fallout. Big-world sci-fi that doesn't ask you to do homework first. Walton Goggins is a revelation.",
    title:"Fallout", meta:"Prime Video · Series" },
  { k:['award','oscar','best','acclaimed','masterpiece'],
    text:"Shōgun. The most awarded TV show in years — and it earned every one. Epic without being exhausting.",
    title:"Shōgun", meta:"Hulu · Series" },
  { k:['weird','strange','bold','different','unusual'],
    text:"Poor Things. Weird, beautiful, and impossible to ignore. You've never seen anything quite like it.",
    title:"Poor Things", meta:"Hulu · 2h 21m" },
  { k:['sci','science','fiction','future','space'],
    text:"Severance. Corporate dystopia as psychological thriller. The most unsettling office drama ever made.",
    title:"Severance", meta:"Apple TV+ · Series" },
];

function getFredResponse(text) {
  const q = text.toLowerCase();
  return FRED_LINES.find(r => r.k.some(kw => q.includes(kw)))
    || FRED_LINES[Math.floor(Math.random() * FRED_LINES.length)];
}

function bgClass(title) {
  const l = (title || 'S').charAt(0).toLowerCase();
  const m = {a:'bg-a',b:'bg-b',c:'bg-c',d:'bg-d',e:'bg-e',f:'bg-f',g:'bg-g',
    h:'bg-h',i:'bg-i',k:'bg-k',l:'bg-l',m:'bg-m',n:'bg-n',o:'bg-o',p:'bg-p',
    r:'bg-r',s:'bg-s',t:'bg-t',w:'bg-w',z:'bg-z'};
  return m[l] || 'bg-s';
}

// ── SVG ICONS ──
const I = {
  Bookmark: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  Refresh:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  External: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Send:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  X:        () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Movie:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/></svg>,
  Menu:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Chat:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
};

const PICK_LABELS = {
  safe:     { label: "Fred's pick",  cls: 'label-safe' },
  stretch:  { label: 'Worth the risk', cls: 'label-stretch' },
  wildcard: { label: 'Wildcard',     cls: 'label-wildcard' },
};

export default function Fred() {
  const [screen,    setScreen]    = useState('tonight');
  const [platforms, setPlatforms] = useState(['Netflix', 'Prime Video']);
  const [moods,     setMoods]     = useState(['smart', 'dark']);
  const [picks,     setPicks]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [stack,     setStack]     = useState([]);
  const [messages,  setMessages]  = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatRef = useRef(null);

  // Load picks on first mount
  useEffect(() => { loadPicks(); }, []); // eslint-disable-line

  function go(name) { setScreen(name); }

  function togglePlatform(p) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }
  function toggleMood(m) {
    setMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  async function loadPicks() {
    if (!platforms.length) return;
    go('tonight');
    setLoading(true);
    setError('');
    setPicks([]);
    try {
      const params = new URLSearchParams({
        platforms: platforms.join(','),
        moods: moods.join(','),
      });
      const res  = await fetch(`/api/picks?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPicks(data.picks || []);
    } catch (e) {
      setError(e.message || 'Fred couldn\'t connect. Try again.');
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

  function sendChat(text) {
    const t = (text || chatInput).trim();
    if (!t) return;
    setChatInput('');
    const resp = getFredResponse(t);
    setMessages(prev => [...prev,
      { role: 'user', text: t },
      { role: 'fred', text: resp.text, title: resp.title, meta: resp.meta },
    ]);
    setTimeout(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, 120);
  }

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ── SETUP ── */}
      <div className={`screen ${screen === 'setup' ? 'active' : ''}`}>
        <div className="setup-wrap">
          <div className="logo">Fred</div>
          <div className="logo-sub">Your film friend</div>

          <div className="sec-label">Your platforms</div>
          <div className="chips">
            {PLATFORMS.map(p => (
              <div key={p} className={`chip ${platforms.includes(p) ? 'on' : ''}`}
                onClick={() => togglePlatform(p)}>{p}</div>
            ))}
          </div>

          <div className="sec-label">Tonight's mood</div>
          <div className="chips">
            {MOODS.map(m => (
              <div key={m.value} className={`chip ${moods.includes(m.value) ? 'on' : ''}`}
                onClick={() => toggleMood(m.value)}>{m.label}</div>
            ))}
          </div>

          <button className="cta" onClick={loadPicks}>
            Fred, show me tonight's picks
          </button>
        </div>
      </div>

      {/* ── TONIGHT ── */}
      <div className={`screen ${screen === 'tonight' ? 'active' : ''}`}>
        <div className="t-hdr">
          <div className="screen-title">Tonight</div>
          <div className="screen-sub">2 films · 1 series · curated for you</div>
        </div>
        <div className="picks-wrap">
          {loading && (
            <div className="loading">
              <div className="spinner" />
              <div className="load-txt">Fred is thinking…</div>
            </div>
          )}
          {!loading && error && (
            <div className="err-txt">{error}<br/><br/>
              <button className="cta" style={{fontSize:'14px',padding:'12px'}} onClick={loadPicks}>
                Try again
              </button>
            </div>
          )}
          {!loading && !error && picks.length === 0 && (
            <div className="loading">
              <div className="load-txt">
                Choose your platforms and mood in Setup, then tap the button.
              </div>
            </div>
          )}
          {!loading && picks.map((pick, idx) => {
            const lbl = PICK_LABELS[pick.pick_type] || PICK_LABELS.safe;
            const bg  = bgClass(pick.title);
            const metaParts = [pick.year, pick.runtime,
              pick.type === 'series' ? 'Series' : 'Film',
              pick.platform].filter(Boolean);
            return (
              <div key={pick.id}>
                <div className={`pick-label ${lbl.cls}`}>{lbl.label}</div>
                <div className="card">
                  <div className={`poster-wrap ${bg}`}>
                    <div className="poster-ph">{pick.title?.charAt(0)}</div>
                    {pick.poster && (
                      <img
                        src={`${TMDB}${pick.poster}`}
                        alt={pick.title}
                        className="poster-img"
                        onError={e => { e.target.style.opacity = 0; }}
                      />
                    )}
                    <div className="poster-grad" />
                    <div className="poster-title-ov">{pick.title}</div>
                    <div className="poster-tl">
                      {pick.letterboxd && <span className="bdg bdg-lb">↑ Letterboxd</span>}
                      {pick.rating >= 8.3 && <span className="bdg bdg-top">Top rated</span>}
                    </div>
                    {pick.rating && (
                      <div className="poster-score">
                        <div className="score-n">{Number(pick.rating).toFixed(1)}</div>
                        <div className="score-l">IMDB</div>
                      </div>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="card-meta">{metaParts.join(' · ')}</div>
                    {pick.fred_note && (
                      <div className="card-note">"{pick.fred_note}"</div>
                    )}
                  </div>
                  <div className="card-actions">
                    <button className="ca sv" onClick={() => saveToStack(pick)}>
                      <I.Bookmark /> Save
                    </button>
                    <button className="ca" onClick={loadPicks}>
                      <I.Refresh /> More
                    </button>
                    <button className="ca">
                      <I.External /> Open
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ASK FRED ── */}
      <div
        className={`screen ${screen === 'ask' ? 'active' : ''}`}
        style={{ paddingBottom: '140px' }}
        ref={chatRef}
      >
        <div className="a-hdr">
          <div className="screen-title">Ask Fred</div>
          <div className="a-sub">What do you feel like?</div>
        </div>
        <div className="prompt-chips">
          {['Smart but not depressing','Under 45 minutes','Like The Bear but calmer',"I'm exhausted, easy pick"].map(p => (
            <div key={p} className="pc" onClick={() => sendChat(p)}>{p}</div>
          ))}
        </div>
        <div className="chat-area">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' && (
                <div className="user-msg-wrap">
                  <span className="user-msg">{msg.text}</span>
                </div>
              )}
              {msg.role === 'fred' && (
                <div className="fred-bubble">
                  <div className="fred-text">"{msg.text}"</div>
                  {msg.title && (
                    <div className="resp-mini">
                      <div className={`resp-ph ${bgClass(msg.title)}`}>
                        {msg.title.charAt(0)}
                      </div>
                      <div className="resp-info">
                        <div className="resp-title">{msg.title}</div>
                        <div className="resp-meta">{msg.meta}</div>
                      </div>
                    </div>
                  )}
                  <div className="resp-actions">
                    <button className="rb p"
                      onClick={() => msg.title && saveToStack({
                        id: `ask-${i}`, title: msg.title,
                        platform: msg.meta?.split(' · ')[0] || '',
                        runtime: msg.meta?.split(' · ')[1] || '',
                        type: msg.meta?.toLowerCase().includes('series') ? 'series' : 'movie',
                        poster: null,
                      })}>
                      <I.Bookmark style={{width:12,height:12,marginRight:3}} /> Save
                    </button>
                    <button className="rb s"
                      onClick={() => setMessages(prev => prev.filter((_,j) => j!==i && j!==i-1))}>
                      Ask again
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="chat-bar">
          <input
            className="ci"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            placeholder="Ask Fred something specific…"
          />
          <button className="cs" onClick={() => sendChat()}><I.Send /></button>
        </div>
      </div>

      {/* ── STACK ── */}
      <div className={`screen ${screen === 'stack' ? 'active' : ''}`}>
        <div className="st-hdr">
          <div className="screen-title">Your Stack</div>
          <div className="a-sub" style={{marginTop:'4px'}}>Stuff you actually meant to watch.</div>
        </div>
        <div className="st-list">
          {stack.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><I.Bookmark /></div>
              <div className="empty-text">Nothing saved yet.<br />Save picks from Tonight or Ask Fred.</div>
            </div>
          ) : stack.map(item => (
            <div className="si" key={item.id}>
              {item.poster
                ? <img src={`${TMDB}${item.poster}`} alt={item.title} className="si-img"
                    onError={e => e.target.style.display='none'} />
                : <div className={`si-ph ${bgClass(item.title)}`}>{item.title?.charAt(0)}</div>
              }
              <div className="si-info">
                <div className="si-type">{item.type === 'series' ? 'Series' : 'Film'}</div>
                <div className="si-title">{item.title}</div>
                <div className="si-meta">{item.platform} · {item.runtime}</div>
              </div>
              <button className="si-rm" onClick={() => removeFromStack(item.id)}>
                <I.X />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── NAV ── */}
      <nav className="nav">
        <button className={`nv ${screen==='setup'   ?'active':''}`} onClick={()=>go('setup')}>
          <I.Menu /> Setup
        </button>
        <button className={`nv ${screen==='tonight' ?'active':''}`} onClick={()=>go('tonight')}>
          <I.Movie /> Tonight
        </button>
        <button className={`nv ${screen==='ask'     ?'active':''}`} onClick={()=>go('ask')}>
          <I.Chat /> Ask Fred
        </button>
        <button className={`nv ${screen==='stack'   ?'active':''}`} onClick={()=>go('stack')}>
          <I.Bookmark /> Stack
        </button>
      </nav>
    </div>
  );
}
