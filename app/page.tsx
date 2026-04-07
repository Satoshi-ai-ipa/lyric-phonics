'use client';

import YouTube from 'react-youtube';
import { useState, useRef, useEffect } from 'react';

const LYRICS = [
  { time: 14, text: "The club isn't the best place to find a lover" },
  { time: 17, text: "So the bar is where I go" },
  { time: 20, text: "Me and my friends at the table doing shots" },
  { time: 23, text: "Drinking fast and then we talk slow" },
];

const SPEED_STEPS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(1);
  const [player, setPlayer] = useState<any>(null);
  const [speedIndex, setSpeedIndex] = useState(3);
  const [repeat, setRepeat] = useState(10);
  const [repeatInput, setRepeatInput] = useState('10');
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const loopRef = useRef<any>(null);
  const remainRef = useRef(0);
  const pointARef = useRef<number | null>(null);
  const pointBRef = useRef<number | null>(null);
  const speed = SPEED_STEPS[speedIndex];

  const onReady = (e: any) => setPlayer(e.target);

  const changeSpeed = (dir: number) => {
    const next = Math.max(0, Math.min(SPEED_STEPS.length - 1, speedIndex + dir));
    setSpeedIndex(next);
    if (player) player.setPlaybackRate(SPEED_STEPS[next]);
  };

  const seekTo = (time: number, index: number) => {
    setActiveIndex(index);
    if (player) { player.seekTo(time, true); player.playVideo(); }
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

  const NudgeBtn = ({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 h-9 text-gray-400 hover:bg-gray-100 disabled:opacity-20 text-xs border-gray-200"
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Lyric Phonics</h1>
        <p className="text-sm text-gray-500 mb-6">洋楽で発音を学ぶ</p>

        <div className="rounded-xl overflow-hidden mb-0">
          <YouTube
            videoId="JGwWNGJdvx8"
            onReady={onReady}
            opts={{ width: '100%', height: '360' }}
          />
        </div>

        {/* コントロールパネル */}
        <div className="bg-white border border-gray-100 rounded-b-xl px-4 py-4 mb-6">

          {/* A・B・クリア */}
          <div className="flex gap-2 mb-4">

            {/* A点 ◀ 中央 ▶ */}
            <div className="flex flex-1 items-center rounded-full border border-gray-200 overflow-hidden">
              <NudgeBtn disabled={pointA === null} onClick={() => updateA(pointA! - 0.1)} label="◀" />
              <div className="w-px h-5 bg-gray-200" />
              <button
                onClick={setA}
                className={`flex-1 h-9 text-sm transition-colors ${
                  pointA !== null ? 'text-purple-700 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {pointA !== null ? `A: ${fmt(pointA)}` : 'A ここから'}
              </button>
              <div className="w-px h-5 bg-gray-200" />
              <NudgeBtn disabled={pointA === null} onClick={() => updateA(pointA! + 0.1)} label="▶" />
            </div>

            {/* B点 ◀ 中央 ▶ */}
            <div className="flex flex-1 items-center rounded-full border border-gray-200 overflow-hidden">
              <NudgeBtn disabled={pointB === null} onClick={() => updateB(pointB! - 0.1)} label="◀" />
              <div className="w-px h-5 bg-gray-200" />
              <button
                onClick={setB}
                className={`flex-1 h-9 text-sm transition-colors ${
                  pointB !== null ? 'text-green-700 bg-green-50' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {pointB !== null ? `B: ${fmt(pointB)}` : 'B ここまで'}
              </button>
              <div className="w-px h-5 bg-gray-200" />
              <NudgeBtn disabled={pointB === null} onClick={() => updateB(pointB! + 0.1)} label="▶" />
            </div>

            <button onClick={clearAB} className="px-4 h-9 rounded-full text-sm border border-gray-200 text-gray-400 hover:bg-gray-50">
              クリア
            </button>
          </div>

          {/* 速度・繰り返し・ループ */}
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
              <input
                type="number" min="1" value={repeatInput}
                onChange={e => handleRepeatInput(e.target.value)}
                className="w-12 text-center text-sm font-medium bg-transparent border-none outline-none"
              />
              <span className="text-xs text-gray-400">回</span>
              <button onClick={() => changeRepeat(1)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">+</button>
            </div>

            <button
              onClick={startLoop}
              disabled={pointA === null || pointB === null}
              className={`flex-1 h-9 rounded-full text-sm font-medium transition-colors ${
                pointA !== null && pointB !== null
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              ループ再生
            </button>
          </div>
        </div>

        {/* 字幕リスト */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-3">Shape of You — Ed Sheeran</p>
          <div className="space-y-2">
            {LYRICS.map((line, i) => (
              <div
                key={i}
                onClick={() => seekTo(line.time, i)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  activeIndex === i ? 'bg-purple-50 border border-purple-100' : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-xs text-gray-400 mr-3">
                  {Math.floor(line.time / 60)}:{String(line.time % 60).padStart(2, '0')}
                </span>
                <span className="text-gray-900">{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}