import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { videoId, lyrics } = await request.json();

  if (!videoId || !lyrics?.length) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // DBに既にあるものを確認
  const { data: existing } = await supabase
    .from('phrases')
    .select('offset_ms, ipa')
    .eq('video_id', videoId);

  const existingMap = new Map(existing?.map((r: any) => [Number(r.offset_ms), r.ipa]) ?? []);
  
  console.log(`DB件数: ${existingMap.size} / 全体: ${lyrics.length}`);

  // 全部DBにあればGeminiを呼ばない
  const missing = lyrics.filter((l: any) => !existingMap.has(Number(l.offset)));

  console.log(`未解析: ${missing.length}件`);

  if (missing.length === 0) {
    console.log('全部キャッシュから返します');
    const ipaMap = Object.fromEntries(
      lyrics.map((l: any) => [l.offset, existingMap.get(Number(l.offset)) ?? ''])
    );
    return NextResponse.json({ ipaMap, cached: true });
  }

  // Geminiに一括で送る
  const lyricsText = missing
    .map((l: any, i: number) => `${i + 1}. [${l.offset}ms] ${l.text}`)
    .join('\n');

  const prompt = `You are an expert in Ed Sheeran's pronunciation and singing style.
Convert each of the following song phrases to IPA based on how Ed Sheeran actually sings them.
Consider the natural flow and sound changes between phrases (linking, elision, assimilation, etc.).
Ed Sheeran sings in British English with a Suffolk accent.

Phrases:
${lyricsText}

Return ONLY a JSON array in this exact format, nothing else:
[{"offset": <offset_ms as number>, "ipa": "<IPA notation>"}]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '[]';
    const results: { offset: number; ipa: string }[] = JSON.parse(raw);

    // DBに保存
    const inserts = results.map(r => {
      const line = missing.find((l: any) => Number(l.offset) === Number(r.offset));
      return {
        video_id: videoId,
        offset_ms: r.offset,
        text: line?.text ?? '',
        ipa: r.ipa,
      };
    });

    if (inserts.length > 0) {
      await supabase.from('phrases').insert(inserts);
    }

    // 既存 + 新規をまとめて返す
    const ipaMap: Record<number, string> = {};
    existingMap.forEach((ipa, offset) => { ipaMap[offset] = ipa; });
    results.forEach(r => { ipaMap[r.offset] = r.ipa; });

    return NextResponse.json({ ipaMap, cached: false });
  } catch (e) {
    console.error('analyze error:', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}