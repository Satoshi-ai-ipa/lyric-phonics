'use client';

import YouTube from 'react-youtube';
import { useState, useRef } from 'react';

const LYRICS = [
  { time: 14, text: "The club isn't the best place to find a lover" },
  { time: 17, text: "So the bar is where I go" },
  { time: 20, text: "Me and my friends at the table doing shots" },
  { time: 23, text: "Drinking fast and then we talk slow" },
];

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(1);
  const [player, setPlayer] = useState<any>(null);
  const [speed, setSpeed] = useState(1.0);
  const [repeat, setRepeat] = useState(3);
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const loopRef = useRef<any>(null);
  const remainRef = useRef(0);

  const onReady = (e: any) => setPlayer(e.target);

  const seekTo = (time: number, index: number) => {
    setActiveIndex(index);
    if (player) {
      player.seekTo(time, true);
      player.playVideo();
    }
  };

  const getCurrentTime = () => player?.getCurrentTime() ?? 0;

  const setA = () => {
    const t = getCurrentTime();
    setPointA(t);
  };

  const setB = () => {
    const t = getCurrentTime();
    setPointB(t);
  };

  const clearAB = () => {
    setPointA(null);
    setPointB(null);
    if (loopRef.current) clearInterval(loopRef.current);
  };

  const startLoop = () => {
    if (!player || pointA === null || pointB === null) return;
    if (loopRef.current) clearInterval(loopRef.current);
    remainRef.current = repeat;
    player.seekTo(pointA, true);
    player.setPlaybackRate(speed);
    player.playVideo();

    loopRef.current = setInterval(() => {
      const current = player.getCurrentTime();
      if (current >= pointB) {
        if (remainRef.current <= 1) {
          clearInterval(loopRef.current);
          player.pauseVideo();
        } else {
          remainRef.current -= 1;
          player.seekTo(pointA, true);
        }
      }
    }, 200);
  };

  const fmt = (n: number) => {
    const m = Math.floor(n / 60);
    const s = Math.floor(n % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Lyric Phonics</h1>
        <p className="text-sm text-gray-500 mb-6">洋楽で発音を学ぶ</p>

        {/* YouTubeプレイヤー */}
        <div className="rounded-xl overflow-hidden mb-0">
          <YouTube
            videoId="JGwWNGJdvx8"
            onReady={onReady}
            opts={{ width: '100%', height: '360' }}
          />
        </div>

        {/* コントロールパネル */}
        <div className="bg-white border border-gray-100 rounded-b-xl px-4 py-4 mb-6">

          {/* A・B・クリアボタン */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={setA}
              className={`flex-1 h-9 rounded-full text-sm border transition-colors ${
                pointA !== null
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {pointA !== null ? `A: ${fmt(pointA)}` : 'A ここから'}
            </button>
            <button
              onClick={setB}
              className={`flex-1 h-9 rounded-full text-sm border transition-colors ${
                pointB !== null
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {pointB !== null ? `B: ${fmt(pointB)}` : 'B ここまで'}
            </button>
            <button
              onClick={clearAB}
              className="px-4 h-9 rounded-full text-sm border border-gray-200 text-gray-400 hover:bg-gray-50"
            >
              クリア
            </button>
          </div>

          {/* 速度・繰り返し・スタート */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* 速度 */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-full px-3 h-9">
              <span className="text-xs text-gray-400">速度</span>
              <button onClick={() => setSpeed(s => Math.max(0.5, Math.round((s - 0.25) * 100) / 100))} className="text-gray-400 hover:text-gray-700 text-lg leading-none">−</button>
              <span className="text-sm font-medium w-10 text-center">{speed.toFixed(2)}×</span>
              <button onClick={() => setSpeed(s => Math.min(2.0, Math.round((s + 0.25) * 100) / 100))} className="text-gray-400 hover:text-gray-700 text-lg leading-none">+</button>
            </div>

            {/* 繰り返し */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-full px-3 h-9">
              <span className="text-xs text-gray-400">繰り返し</span>
              <button onClick={() => setRepeat(r => Math.max(1, r - 1))} className="text-gray-400 hover:text-gray-700 text-lg leading-none">−</button>
              <span className="text-sm font-medium w-8 text-center">{repeat}回</span>
              <button onClick={() => setRepeat(r => Math.min(10, r + 1))} className="text-gray-400 hover:text-gray-700 text-lg leading-none">+</button>
            </div>

            {/* ループスタート */}
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
                  activeIndex === i
                    ? 'bg-purple-50 border border-purple-100'
                    : 'hover:bg-gray-50'
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