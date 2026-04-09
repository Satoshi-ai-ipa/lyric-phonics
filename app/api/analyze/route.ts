import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { videoId, lyrics } = await request.json();

  if (!videoId || !lyrics?.length) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  const { data: existing } = await supabase
    .from('phrases')
    .select('offset_ms, ipa, meanings')
    .eq('video_id', videoId);

  const existingMap = new Map(
    existing?.map((r: any) => [Number(r.offset_ms), { ipa: r.ipa, meanings: r.meanings }]) ?? []
  );

  console.log(`DB件数: ${existingMap.size} / 全体: ${lyrics.length}`);

  const missing = lyrics.filter((l: any) => {
    const rec = existingMap.get(Number(l.offset));
    return !rec?.ipa || !rec?.meanings;
  });

  console.log(`未解析: ${missing.length}件`);

  if (missing.length === 0) {
    console.log('全部キャッシュから返します');
    const ipaMap: Record<number, string> = {};
    const meaningsMap: Record<number, string> = {};
    existingMap.forEach((val, offset) => {
      ipaMap[offset] = val.ipa;
      meaningsMap[offset] = val.meanings;
    });
    return NextResponse.json({ ipaMap, meaningsMap, cached: true });
  }

  const lyricsText = missing
    .map((l: any, i: number) => `${i + 1}. [${l.offset}ms] ${l.text}`)
    .join('\n');

  const prompt = `You are an expert in Ed Sheeran's pronunciation and a Japanese English teacher.
For each phrase below, provide:
1. IPA based on how Ed Sheeran actually sings it (British English, Suffolk accent, natural sound changes)
2. Context-aware Japanese meanings broken into natural chunks.

Rules for meanings:
- Each chunk must end with a Japanese particle or conjugation that connects naturally to the next chunk
- Verbs must be their own chunk (e.g. "is" → "である" or context-appropriate form)
- Adjective phrases should end with で or な to flow into the next chunk
- The whole sequence of chunks should read naturally top-to-bottom in Japanese
- Reflect the actual meaning in THIS sentence context, not dictionary definitions
- Group words into meaningful chunks based on grammatical and semantic units

Phrases:
${lyricsText}

Return ONLY a JSON array in this exact format:
[{
  "offset": <offset_ms as number>,
  "ipa": "<IPA notation>",
  "meanings": "<chunk1>=<日本語> / <chunk2>=<日本語> / ..."
}]

Example for "The club isn't the best place to find a lover":
"meanings": "The club=そのクラブは / isn't=ではない / the best place=最高の場所で / to find=見つけるための / a lover=恋人を"

Example for "So the bar is where I go":
"meanings": "So=だから / the bar=そのバーが / is=である / where I go=私の行く場所"

Example for "Me and my friends at the table doing shots":
"meanings": "Me and my friends=私と友達が / at the table=テーブルで / doing shots=ショットを飲んでいる"`;

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
    const results: { offset: number; ipa: string; meanings: string }[] = JSON.parse(raw);

    for (const r of results) {
      const exists = existingMap.has(Number(r.offset));
      if (exists) {
        await supabase
          .from('phrases')
          .update({ ipa: r.ipa, meanings: r.meanings })
          .eq('video_id', videoId)
          .eq('offset_ms', r.offset);
      } else {
        const line = missing.find((l: any) => Number(l.offset) === Number(r.offset));
        await supabase.from('phrases').insert({
          video_id: videoId,
          offset_ms: r.offset,
          text: line?.text ?? '',
          ipa: r.ipa,
          meanings: r.meanings,
        });
      }
    }

    const ipaMap: Record<number, string> = {};
    const meaningsMap: Record<number, string> = {};
    existingMap.forEach((val, offset) => {
      ipaMap[offset] = val.ipa;
      meaningsMap[offset] = val.meanings;
    });
    results.forEach(r => {
      ipaMap[r.offset] = r.ipa;
      meaningsMap[r.offset] = r.meanings;
    });

    return NextResponse.json({ ipaMap, meaningsMap, cached: false });
  } catch (e) {
    console.error('analyze error:', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}