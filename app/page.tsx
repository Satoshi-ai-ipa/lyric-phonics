'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (q: string) => {
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setVideos(data.videos ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) search(initialQuery);
  }, []);

  const handleSearch = () => {
    if (!query) return;
    const isAdmin = searchParams.get('admin') === 'true';
    router.push(`/?q=${encodeURIComponent(query)}${isAdmin ? '&admin=true' : ''}`);
    search(query);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-gray-900">IPA Visualizer</h1>
        <div className="flex gap-4">
          <a href="/search" className="text-sm text-gray-500 hover:text-gray-900">表現検索</a>
          <a href="/ranking" className="text-sm text-gray-500 hover:text-gray-900">ランキング</a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="アーティスト名・曲名で検索..."
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-300"
            />
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700"
            >
              検索
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-gray-400 text-center">読み込み中...</p>}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => router.push(`/${video.id}${searchParams.get('admin') === 'true' ? '?admin=true' : ''}`)}
              className="cursor-pointer group"
            >
              <div className="rounded-xl overflow-hidden mb-2">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity"
                />
              </div>
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{video.title}</p>
              <p className="text-xs text-gray-500 mt-1">{video.channelTitle}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}