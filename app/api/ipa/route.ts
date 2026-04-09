import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { videoId, offsetMs, text } = await request.json();

  if (!videoId || offsetMs === undefined || !text) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('phrases')
    .select('ipa')
    .eq('video_id', videoId)
    .eq('offset_ms', offsetMs)
    .single();

  if (existing?.ipa) {
    return NextResponse.json({ ipa: existing.ipa, cached: true });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `You are an expert in Ed Sheeran's pronunciation. Convert the following English phrase to IPA based on how Ed Sheeran actually sings it. Return ONLY the IPA notation, nothing else.

Phrase: "${text}"

Rules:
- Ed Sheeran sings in British English with a Suffolk accent
- Reflect natural sound changes in singing (linking, elision, etc.)
- Return ONLY the IPA. No explanations, no extra text.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    console.log('Gemini response:', JSON.stringify(data));
    
    const ipa = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (ipa) {
      await supabase.from('phrases').insert({
        video_id: videoId,
        offset_ms: offsetMs,
        text,
        ipa,
      });
    }

    return NextResponse.json({ ipa, cached: false });
  } catch (e) {
    console.error('Gemini error:', e);
    return NextResponse.json({ error: 'Gemini API failed' }, { status: 500 });
  }
}