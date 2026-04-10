'use client';

import YouTube from 'react-youtube';
import { useState, useRef, useEffect } from 'react';

const SPEED_STEPS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
type Line = { text: string; offset: number; duration: number };

const BASE_URL = 'https://storage.googleapis.com/ipa-visualizer-assets-ipa-visualizer-secure/assets/';
const NEW_BASE_URL = 'https://storage.googleapis.com/lyric-phonics-assets/assets/';

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
  'ː': BASE_URL + 'long.png',
  'ɜ': NEW_BASE_URL + 'er_open.png',
  'ɒ': NEW_BASE_URL + 'o_short.png',
};

// ★ 母音セット — ə（シュワ）と ɚ は弱母音なので除外 → 絶対にピンクにならない
const VOWELS = new Set([
  'a', 'e', 'i', 'o', 'u',
  'ɪ', 'ɛ', 'æ', 'ʌ', 'ɒ', 'ɔ', 'ʊ', 'ɜ', 'ɑ', 'ɝ',
  'aɪ', 'aʊ', 'oʊ', 'ɔɪ', 'eɪ',
]);

function applyUnreleasedStops(ipa: string): string {
  const stops = ['p', 'b', 't', 'd', 'k', 'g', 'ɡ'];
  const vowels = ['a', 'ɑ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɔ', 'ɛ', 'ɪ', 'i', 'ʊ', 'u', 'ɜ', 'ɒ'];

  // スペースで単語に分割
  const words = ipa.split(' ');

  const result = words.map((word, wordIndex) => {
    // tʃ, dʒ で終わる単語は対象外
    if (word.endsWith('tʃ') || word.endsWith('dʒ')) return word;

    // ˈ を除いた実質的な末尾文字を取得
    const clean = word.replace(/ˈ|ˌ/g, '');

    // 末尾が閉鎖音かチェック
    const lastChar = clean.slice(-1);
    if (!stops.includes(lastChar)) return word;

    // 次の単語の頭の文字を取得
    const nextWord = words[wordIndex + 1];
    if (!nextWord) {
      // 文末 → ̚ をつける
      return word + '̚';
    }

    const nextClean = nextWord.replace(/ˈ|ˌ/g, '');
    const nextFirstChar = nextClean[0];

    // 次の音が母音 → ̚ をつけない
    if (vowels.includes(nextFirstChar)) return word;

    // 次の音が子音 → ̚ をつける
    return word + '̚';
  });

  return result.join(' ');
}

function parseIPA(ipa: string): { token: string; stressed: boolean }[] {
  const result: { token: string; stressed: boolean }[] = [];
  const clean = ipa
    .replace(/'/g, 'ˈ')
    .replace(/ər/g, 'ɚ')
    .replace(/ɜːr/g, 'ɝ')
    .replace(/ɡ/g, 'g')
    .replace(/[.‿͡]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let i = 0;
  let pendingStress = false;

  while (i < clean.length) {
    if (clean[i] === ' ') { i++; continue; }
    if (clean[i] === '[' || clean[i] === ']') { i++; continue; }
    if (clean[i] === 'ˈ' || clean[i] === 'ˌ') {
      pendingStress = clean[i] === 'ˈ';
      i++; continue;
    }

    const two = clean.slice(i, i + 2);
    if (['aɪ', 'aʊ', 'oʊ', 'ɔɪ', 'eɪ', 'tʃ', 'dʒ'].includes(two)) {
      const isVowel = VOWELS.has(two);
      result.push({ token: two, stressed: isVowel && pendingStress });
      if (isVowel) pendingStress = false;
      i += 2; continue;
    }

    const withStop = clean.slice(i, i + 2);
    if (withStop.length === 2 && withStop[1] === '̚') {
      result.push({ token: withStop, stressed: false });
      i += 2; continue;
    }

    const ch = clean[i];
    const isStressableVowel = VOWELS.has(ch);
    result.push({ token: ch, stressed: isStressableVowel && pendingStress });
    if (isStressableVowel) pendingStress = false;
    i++;
  }
  return result.filter(t => t.token.length > 0);
}

function IPAVisualizer({ ipa }: { ipa: string }) {
  const correctedIpa = applyUnreleasedStops(ipa);
  console.log('補正前:', ipa, '補正後:', correctedIpa);
  const tokens = parseIPA(correctedIpa);
  if (tokens.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {tokens.map(({ token, stressed }, i) => {
        const imgUrl = IPA_ASSETS[token];
        return (
          // ★ ② 強調色を rose に変更（選択行の purple 背景と被らない）
          <div key={i} className={`flex flex-col items-center rounded-lg p-1 border ${stressed ? 'bg-rose-100 border-rose-300' : 'bg-gray-50 border-gray-200'}`} style={{ minWidth: 44 }}>
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

function MeaningsRow({ meanings }: { meanings: string }) {
  if (!meanings) return null;
  const pairs = meanings.split('/').map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {pairs.map((pair, i) => {
        const [word, meaning] = pair.split('=').map(s => s.trim());
        return (
          <div key={i} className="flex flex-col items-center bg-amber-50 border border-amber-200 rounded-lg px-2 py-1" style={{ minWidth: 48 }}>
            <span className="text-xs text-amber-800 font-medium">{meaning}</span>
            <span className="text-xs text-amber-600">{word}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [lyrics, setLyrics] = useState<Line[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [player, setPlayer] = useState<any>(null);
  const [speedIndex, setSpeedIndex] = useState(3);
  const [repeat, setRepeat] = useState(10);
  const [repeatInput, setRepeatInput] = useState('10');
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const [ipaMap, setIpaMap] = useState<Record<number, string>>({});
  const [meaningsMap, setMeaningsMap] = useState<Record<number, string>>({});
  const [explanationMap, setExplanationMap] = useState<Record<number, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [devMode, setDevMode] = useState(true);
  const [analyzeMode, setAnalyzeMode] = useState<'all' | 'ipa' | 'meanings' | 'explanation' | 'tags'>('all');
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
        analyzeAll(filtered, true);
      });
  }, []);

  const DEV_LINE_COUNT = 5;
  const analyzeAll = async (lines: Line[], isDev?: boolean, mode?: string) => {
    setAnalyzing(true);
    try {
      const targetLines = isDev ?? devMode ? lines.slice(0, DEV_LINE_COUNT) : lines;
      const payload = targetLines.map(l => ({ offset: l.offset, text: cleanText(l.text) }));
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: VIDEO_ID, lyrics: payload, devMode: isDev ?? devMode, mode: mode ?? analyzeMode }),
      });
      const data = await res.json();
      if (data.ipaMap) setIpaMap(data.ipaMap);
      if (data.meaningsMap) setMeaningsMap(data.meaningsMap);
      if (data.explanationMap) setExplanationMap(data.explanationMap);
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
    if (player) { player.seekTo(offsetMs / 1000, true); player.playVideo(); }
  };

  const toggleExpand = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setExpandedIndex(expandedIndex === index ? null : index);
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
      if (e.key === 'ArrowLeft' && pointARef.current !== null) { e.preventDefault(); updateA(pointARef.current - 0.1); }
      if (e.key === 'ArrowRight' && pointARef.current !== null) { e.preventDefault(); updateA(pointARef.current + 0.1); }
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
      const a = pointARef.current; const b = pointBRef.current;
      if (a === null || b === null) return;
      if (player.getCurrentTime() >= b) {
        if (remainRef.current <= 1) { clearInterval(loopRef.current); player.pauseVideo(); }
        else { remainRef.current -= 1; player.seekTo(a, true); }
      }
    }, 100);
  };

  const fmt = (n: number) => `${Math.floor(n / 60)}:${(n % 60).toFixed(1).padStart(4, '0')}`;
  const fmtMs = (ms: number) => {
    const t = Math.floor(ms / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  const cleanText = (text: string) => text.replace(/♪\s*/g, '').replace(/\s*♪/g, '').replace(/\n/g, ' ').trim();

  const NudgeBtn = ({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} className="px-2 h-9 text-gray-400 hover:bg-gray-100 disabled:opacity-20 text-xs">{label}</button>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Lyric Phonics</h1>
        <p className="text-sm text-gray-500 mb-6">洋楽で発音を学ぶ</p>

        <div className="rounded-xl overflow-hidden mb-0">
          <YouTube videoId={VIDEO_ID} onReady={onReady} opts={{ width: '100%', height: '360' }} />
        </div>

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
            <button onClick={startLoop} disabled={pointA === null || pointB === null}
              className={`flex-1 h-9 rounded-full text-sm font-medium transition-colors ${pointA !== null && pointB !== null ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
              ループ再生
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">Shape of You — Ed Sheeran</p>
            <div className="flex items-center gap-3">
              {analyzing && <p className="text-xs text-purple-400">解析中...</p>}
              <button
                onClick={() => {
                  const next = !devMode;
                  setDevMode(next);
                  analyzeAll(lyrics, next);
                }}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${devMode
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-green-50 border-green-300 text-green-700'
                  }`}
              >
                {devMode ? `🛠️ 開発モード（先頭${DEV_LINE_COUNT}行）` : '🎵 本番モード（全行）'}
              </button>
              <div className="flex gap-2 mt-2 flex-wrap">
                {(['all', 'ipa', 'meanings', 'explanation', 'tags'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setAnalyzeMode(m);
                      analyzeAll(lyrics, devMode, m);
                    }}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${analyzeMode === m
                        ? 'bg-purple-50 border-purple-300 text-purple-700'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                  >
                    {m === 'all' ? '🔄 全再解析' : m === 'ipa' ? '📝 IPA再解析' : m === 'meanings' ? '🈯 意味再解析' : m === 'explanation' ? '💬 解説再解析' : '🏷️ タグ再解析'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {lyrics.length === 0 && <p className="text-sm text-gray-400">読み込み中...</p>}
          <div className="space-y-2">
            {lyrics.map((line, i) => (
              <div key={i} className={`rounded-lg border transition-colors ${activeIndex === i ? 'border-purple-100 bg-purple-50' : 'border-transparent hover:bg-gray-50'}`}>
                <div className="p-3 cursor-pointer" onClick={() => seekTo(line.offset, i)}>
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-400 mt-1 flex-shrink-0">{fmtMs(line.offset)}</span>
                    <div className="flex-1">
                      {meaningsMap[line.offset] && <MeaningsRow meanings={meaningsMap[line.offset]} />}
                      <p className="text-gray-900 text-sm mt-1">{cleanText(line.text)}</p>
                      {ipaMap[line.offset] && <p className="text-xs text-purple-500 font-mono mt-1">{ipaMap[line.offset]}</p>}
                      {ipaMap[line.offset] && <IPAVisualizer ipa={ipaMap[line.offset]} />}
                    </div>
                    {explanationMap[line.offset] && (
                      <button
                        onClick={(e) => toggleExpand(e, i)}
                        className={`flex-shrink-0 text-xs px-2 py-1 rounded-full border transition-colors ${expandedIndex === i ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-400 hover:bg-gray-100'}`}
                      >
                        解説
                      </button>
                    )}
                  </div>
                </div>
                {expandedIndex === i && explanationMap[line.offset] && (
                  <div className="px-4 pb-3 pt-0">
                    <div className="bg-blue-50 border-l-4 border-blue-300 rounded-r-lg p-3">
                      <p className="text-xs text-blue-800 leading-relaxed">{explanationMap[line.offset]}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}