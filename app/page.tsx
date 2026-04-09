'use client';

import YouTube from 'react-youtube';
import { useState, useRef, useEffect } from 'react';

const SPEED_STEPS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
type Line = { text: string; offset: number; duration: number };

const BASE_URL = 'https://storage.googleapis.com/ipa-visualizer-assets-ipa-visualizer-secure/assets/';

const IPA_ASSETS: Record<string, string> = {
  'ɑ': BASE_URL + 'aa.png', 'æ': BASE_URL + 'ae.png',
  'ʌ': BASE_URL + 'uh.png', 'ə': BASE_URL + 'schwa.png',
  'ɝ': BASE_URL + 'er_stressed.png', 'ɚ': BASE_URL + 'er_unstressed.png',
  'ɔ': BASE_URL + 'aw.png', 'ɛ': BASE_URL + 'eh.png',
  'ɪ': BASE_URL + 'ih.png', 'i': BASE_URL + 'iy.png',
  'ʊ': BASE_URL + 'uh_book.png', 'u': BASE_URL + 'uw.png',
  'aɪ': BASE_URL + 'ay.png', 'aʊ': BASE_URL + 'aw_out.png',
  'oʊ': BASE_URL + 'ow.png', 'ɔɪ': BASE_URL + 'oy.png',
  'eɪ': BASE_URL + 'ey.png',
  'p': BASE_URL + 'p.png', 'p̚': BASE_URL + 'p_stop.png',
  'b': BASE_URL + 'b.png', 'b̚': BASE_URL + 'b_stop.png',
  'k': BASE_URL + 'k.png', 'k̚': BASE_URL + 'k_stop.png',
  'ɡ': BASE_URL + 'g.png', 'ɡ̚': BASE_URL + 'g_stop.png',
  't': BASE_URL + 't.png', 't̚': BASE_URL + 't_stop.png',
  'd': BASE_URL + 'd.png', 'd̚': BASE_URL + 'd_stop.png',
  'ɾ': BASE_URL + 'flap_t.png', 'ʔ': BASE_URL + 'glottal.png',
  'f': BASE_URL + 'f.png', 'v': BASE_URL + 'v.png',
  'θ': BASE_URL + 'th_unvoiced.png', 'ð': BASE_URL + 'th_voiced.png',
  's': BASE_URL + 's.png', 'z': BASE_URL + 'z.png',
  'ʃ': BASE_URL + 'sh.png', 'ʒ': BASE_URL + 'zh.png',
  'tʃ': BASE_URL + 'ch.png', 'dʒ': BASE_URL + 'jh.png',
  'h': BASE_URL + 'h.png', 'm': BASE_URL + 'm.png',
  'n': BASE_URL + 'n.png', 'ŋ': BASE_URL + 'ng.png',
  'w': BASE_URL + 'w.png', 'j': BASE_URL + 'y.png',
  'r': BASE_URL + 'r.png', 'l': BASE_URL + 'l.png',
  'ɫ': BASE_URL + 'l_dark.png',
};

const STRESSED_VOWELS = ['ɑ','æ','ʌ','ɝ','ɔ','ɛ','ɪ','i','ʊ','u','aɪ','aʊ','oʊ','ɔɪ','eɪ'];

function parseIPA(ipa: string): string[] {
  const tokens: string[] = [];
  const clean = ipa.replace(/[ˈˌ.‿͡]/g, ' ').replace(/\s+/g, ' ').trim();
  let i = 0;
  while (i < clean.length) {
    if (clean[i] === ' ') { i++; continue; }
    // 2文字の二重母音・破擦音を優先
    const two = clean.slice(i, i + 2);
    if (['aɪ','aʊ','oʊ','ɔɪ','eɪ','tʃ','dʒ'].includes(two)) {
      tokens.push(two); i += 2; continue;
    }
    // 非破裂記号付き
    const withStop = clean.slice(i, i + 2);
    if (withStop.length === 2 && withStop[1] === '̚') {
      tokens.push(withStop); i += 2; continue;
    }
    tokens.push(clean[i]); i++;
  }
  return tokens.filter(t => IPA_ASSETS[t] !== undefined || t.length > 0);
}

function IPAVisualizer({ ipa }: { ipa: string }) {
  const tokens = parseIPA(ipa);
  if (tokens.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {tokens.map((token, i) => {
        const imgUrl = IPA_ASSETS[token];
        const isStressed = STRESSED_VOWELS.includes(token);
        return (
          <div
            key={i}
            className={`flex flex-col items-center rounded-lg p-1 border ${
              isStressed
                ? 'bg-purple-50 border-purple-200'
                : 'bg-gray-50 border-gray-200'
            }`}
            style={{ minWidth: 44 }}
          >
            <span className="text-xs font-mono text-gray-700">{token}</span>
            {imgUrl ? (
              <img src={imgUrl} alt={token} className="w-9 h-9 object-contain mt-0.5" />
            ) : (
              <div className="w-9 h-9 mt-0.5 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-gray-300 text-xs">?</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [lyrics, setLyrics] = useState<Line[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [player, setPlayer] = useState<any>(null);
  const [speedIndex, setSpeedIndex] = useState(3);
  const [repeat, setRepeat] = useState(10);
  const [repeatInput, setRepeatInput] = useState('10');
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const [ipaMap, setIpaMap] = useState<Record<number, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const loopRef = useRef<any>(null);
  const remainRef = useRef(0);
  const pointARef = useRef<number | null>(null);
  const pointBRef = useRef<number | null>(null);
  const speed = SPEED_STEPS[speedIndex];
  const VIDEO_ID = 'JGwWNGJdvx8';

  useEffect(() => {
    fetch(`/api/captions?videoId=${VIDEO_ID}`)
      .then(r => r.json())
      .then(data => {
        const filtered = data.transcript.filter((l: Line) =>
          !l.text.startsWith('[') && !l.text.startsWith('♪ (')
        );
        setLyrics(filtered);
        analyzeAll(filtered);
      });
  }, []);

  const analyzeAll = async (lines: Line[]) => {
    setAnalyzing(true);
    try {
      const payload = lines.map(l => ({
        offset: l.offset,
        text: cleanText(l.text),
      }));
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: VIDEO_ID, lyrics: payload }),
      });
      const data = await res.json();
      if (data.ipaMap) setIpaMap(data.ipaMap);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const onReady = (e: any) => setPlayer(e.target);

  const changeSpeed = (dir: number) => {
    const next = Math.max(0, Math.min(SPEED_STEPS.length - 1, speedIndex + dir));
    setSpeedIndex(next);
    if (player) player.setPlaybackRate(SPEED_STEPS[next]);
  };

  const seekTo = (offsetMs: number, index: number) => {
    setActiveIndex(index);
    if (player) {
      player.seekTo(offsetMs / 1000, true);
      player.playVideo();
    }
  };

  const getCurrentTime = () => player?.getCurrentTime() ?? 0;

  const updateA = (val: number) => {
    const v = Math.max(0, Math.round(val * 10) / 10);
    setPointA(v); pointARef.current = v;
    if (player) player.seekTo(v, true);
  };

  const updateB = (val: number) => {
    const v = Math.max(0, Math.round(val * 10) / 10);
    setPointB(v); pointBRef.current = v;
    if (player) player.seekTo(v, true);
  };

  const setA = () => updateA(getCurrentTime());
  const setB = () => updateB(getCurrentTime());

  const clearAB = () => {
    setPointA(null); setPointB(null);
    pointARef.current = null; pointBRef.current = null;
    if (loopRef.current) clearInterval(loopRef.current);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && pointARef.current !== null) {
        e.preventDefault(); updateA(pointARef.current - 0.1);
      }
      if (e.key === 'ArrowRight' && pointARef.current !== null) {
        e.preventDefault(); updateA(pointARef.current + 0.1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [player]);

  const handleRepeatInput = (val: string) => {
    setRepeatInput(val);
    const n = parseInt(val);
    if (!isNaN(n) && n >= 1) setRepeat(n);
  };

  const changeRepeat = (dir: number) => {
    const next = Math.max(1, repeat + dir);
    setRepeat(next); setRepeatInput(String(next));
  };

  const startLoop = () => {
    if (!player || pointA === null || pointB === null) return;
    if (loopRef.current) clearInterval(loopRef.current);
    remainRef.current = repeat;
    player.seekTo(pointA, true);
    player.setPlaybackRate(speed);
    player.playVideo();
    loopRef.current = setInterval(() => {
      const a = pointARef.current;
      const b = pointBRef.current;
      if (a === null || b === null) return;
      if (player.getCurrentTime() >= b) {
        if (remainRef.current <= 1) {
          clearInterval(loopRef.current);
          player.pauseVideo();
        } else {
          remainRef.current -= 1;
          player.seekTo(a, true);
        }
      }
    }, 100);
  };

  const fmt = (n: number) => {
    const m = Math.floor(n / 60);
    const s = (n % 60).toFixed(1);
    return `${m}:${s.padStart(4, '0')}`;
  };

  const fmtMs = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const cleanText = (text: string) =>
    text.replace(/♪\s*/g, '').replace(/\s*♪/g, '').replace(/\n/g, ' ').trim();

  const NudgeBtn = ({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} className="px-2 h-9 text-gray-400 hover:bg-gray-100 disabled:opacity-20 text-xs">
      {label}
    </button>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Lyric Phonics</h1>
        <p className="text-sm text-gray-500 mb-6">洋楽で発音を学ぶ</p>

        <div className="rounded-xl overflow-hidden mb-0">
          <YouTube videoId={VIDEO_ID} onReady={onReady} opts={{ width: '100%', height: '360' }} />
        </div>

        {/* コントロールパネル */}
        <div className="bg-white border border-gray-100 rounded-b-xl px-4 py-4 mb-6">
          <div className="flex gap-2 mb-4">
            <div className="flex flex-1 items-center rounded-full border border-gray-200 overflow-hidden">
              <NudgeBtn disabled={pointA === null} onClick={() => updateA(pointA! - 0.1)} label="◀" />
              <div className="w-px h-5 bg-gray-200" />
              <button onClick={setA} className={`flex-1 h-9 text-sm transition-colors ${pointA !== null ? 'text-purple-700 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}>
                {pointA !== null ? `A: ${fmt(pointA)}` : 'A ここから'}
              </button>
              <div className="w-px h-5 bg-gray-200" />
              <NudgeBtn disabled={pointA === null} onClick={() => updateA(pointA! + 0.1)} label="▶" />
            </div>
            <div className="flex flex-1 items-center rounded-full border border-gray-200 overflow-hidden">
              <NudgeBtn disabled={pointB === null} onClick={() => updateB(pointB! - 0.1)} label="◀" />
              <div className="w-px h-5 bg-gray-200" />
              <button onClick={setB} className={`flex-1 h-9 text-sm transition-colors ${pointB !== null ? 'text-green-700 bg-green-50' : 'text-gray-500 hover:bg-gray-50'}`}>
                {pointB !== null ? `B: ${fmt(pointB)}` : 'B ここまで'}
              </button>
              <div className="w-px h-5 bg-gray-200" />
              <NudgeBtn disabled={pointB === null} onClick={() => updateB(pointB! + 0.1)} label="▶" />
            </div>
            <button onClick={clearAB} className="px-4 h-9 rounded-full text-sm border border-gray-200 text-gray-400 hover:bg-gray-50">クリア</button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-gray-50 rounded-full px-3 h-9">
              <span className="text-xs text-gray-400">速度</span>
              <button onClick={() => changeSpeed(-1)} disabled={speedIndex === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-lg leading-none">−</button>
              <span className="text-sm font-medium w-12 text-center">{speed.toFixed(2)}×</span>
              <button onClick={() => changeSpeed(1)} disabled={speedIndex === SPEED_STEPS.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-lg leading-none">+</button>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-full px-3 h-9">
              <span className="text-xs text-gray-400">繰り返し</span>
              <button onClick={() => changeRepeat(-1)} disabled={repeat <= 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-lg leading-none">−</button>
              <input type="number" min="1" value={repeatInput} onChange={e => handleRepeatInput(e.target.value)} className="w-12 text-center text-sm font-medium bg-transparent border-none outline-none" />
              <span className="text-xs text-gray-400">回</span>
              <button onClick={() => changeRepeat(1)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">+</button>
            </div>
            <button
              onClick={startLoop}
              disabled={pointA === null || pointB === null}
              className={`flex-1 h-9 rounded-full text-sm font-medium transition-colors ${pointA !== null && pointB !== null ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
            >
              ループ再生
            </button>
          </div>
        </div>

        {/* 字幕リスト */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">Shape of You — Ed Sheeran</p>
            {analyzing && <p className="text-xs text-purple-400">IPA解析中...</p>}
          </div>
          {lyrics.length === 0 && <p className="text-sm text-gray-400">読み込み中...</p>}
          <div className="space-y-2">
            {lyrics.map((line, i) => (
              <div
                key={i}
                onClick={() => seekTo(line.offset, i)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${activeIndex === i ? 'bg-purple-50 border border-purple-100' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-400 mt-1 flex-shrink-0">{fmtMs(line.offset)}</span>
                  <div className="flex-1">
                    <p className="text-gray-900 text-sm">{cleanText(line.text)}</p>
                    {ipaMap[line.offset] && (
                      <>
                        <p className="text-xs text-purple-500 font-mono mt-1">{ipaMap[line.offset]}</p>
                        <IPAVisualizer ipa={ipaMap[line.offset]} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}