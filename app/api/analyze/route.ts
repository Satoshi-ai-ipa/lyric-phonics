import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function analyzeChunk(
  chunk: any[],
  apiKey: string
): Promise<{ offset: number; ipa: string; explanation: string; meanings: string }[]> {
  const lyricsText = chunk
    .map((l: any, i: number) => `${i + 1}. [${l.offset}ms] ${l.text}`)
    .join('\n');

  const prompt = `You are a world-class Linguist and Phonetician specializing in General American (GA) pronunciation.
Analyze each phrase and provide:
1. IPA transcription at Casual (everyday native conversation) level
2. Japanese explanation of phonetic changes compared to dictionary pronunciation
3. Japanese meaning chunks

### CASUAL LEVEL RULES (Standard Native Speed):
Apply ALL of the following where relevant:

DARK L: Use [ɫ] for all coda/post-vocalic positions (e.g., "self" → /sɛɫf/).
LIGHT L: Use [l] only for onset positions (e.g., "light" → /laɪt̚/).

STRESS: Use [ˈ] only on the informational peak. Function words (the, a, is, to, and, etc.) are NEVER stressed.
CORRECT: aɪ kən ˈɡoʊ / WRONG: ˈaɪ ˈkæn ˈɡoʊ

UNRELEASED STOPS: Final stops before consonants MUST be unreleased [̚] (e.g., "good" → /ɡʊd̚/).

FLAPPING [ɾ]: /t/ and /d/ between vowels (following vowel unstressed) → [ɾ]
(e.g., "water" → /ˈwɔːɾɚ/, "better" → /ˈbɛɾɚ/, "get up" → /ˈɡɛɾʌp/)

GLOTTAL STOP [ʔ]: /t/ before a consonant or at syllable end → [ʔ]
(e.g., "right now" → /ˈraɪʔ naʊ/, "button" → /ˈbʌʔn̩/)
NEVER use [ʔ] before a vowel — use flapping instead.
NEVER use [ʔ] for /p, b, d, k, ɡ/.

COALESCENCE: Alveolar + [j] merges:
- d+j → dʒ (e.g., "did you" → /dɪdʒu/)
- t+j → tʃ (e.g., "what you" → /wʌtʃu/)
- z+j → ʒ (e.g., "is your" → /ɪʒɚ/)
- s+j → ʃ (e.g., "this year" → /ðɪʃɪr/)

DEVOICING: Voiced consonants before voiceless consonants lose voicing.
- v → f (e.g., "have to" → /hæf tu/)
- z → s (e.g., "is free" → /ɪs friː/)
- d → t (e.g., "looked at" → /lʊkt æt̚/)
- z+ʃ → s+ʃ (e.g., "does she" → /dʌs ʃi/)
VOWEL BARRIER: NEVER devoice before a vowel (e.g., "football" keep [b] → /ˈfʊt̚bɔːɫ/).

ASSIMILATION: [n] before bilabial → [m], before velar → [ŋ]
(e.g., "can be" → /kæm biː/, "in case" → /ɪŋ keɪs/)

WEAK FORMS: Function words reduce vowels to [ə/ɚ/ɪ] and consonants may elide.
- and → /ən/ or /n/
- to → /tə/
- the → /ðə/
- of → /əv/ or /ə/
- for → /fɚ/
- you → /jə/
- your → /jɚ/
- him → /ɪm/
- her → /ɚ/
- them → /ðəm/
- can → /kən/
- have → /həv/ or /v/
- had → /həd/ or /d/
- will → /əl/
- would → /wəd/

V+V LINKING: Insert glide between consecutive vowels.
- [w] after rounded vowels (e.g., "go out" → /ɡoʊwaʊt/)
- [j] after front vowels (e.g., "see it" → /siːjɪt/)

### EXPLANATION FORMAT (Japanese, numbered):
Compare to dictionary pronunciation. Use this exact format:
① spelling [dictionary IPA] → [casual IPA] (日本語での解説)

Example for "and my":
① and [ænd] → [ən] (機能語のandは弱形になり、母音がシュワーに弱化、語末のdが脱落しています)
② my [maɪ] → [mɪ] (非強調位置のため母音が弱化しています)

If no changes occur, return "なし".

### MEANINGS FORMAT:
Group words into natural phrases (2-4 words each).
Format: "english chunk=日本語訳 / english chunk=日本語訳"
Each Japanese chunk MUST end with a particle (は、を、に、で、が、の、と、から、ために、ではない etc.)
Keep function words attached to their content word.

Phrases to analyze:
${lyricsText}

Return ONLY a valid JSON array:
[{"offset": <number>, "ipa": "<casual IPA, no brackets>", "explanation": "<Japanese numbered explanation>", "meanings": "<chunk>=<日本語> / ..."}]`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '[]';

  const parsed = JSON.parse(raw);
  return parsed.map((r: any) => ({
    ...r,
    ipa: r.ipa?.replace(/^\[|\]$/g, '').trim() ?? r.ipa,
  }));
}

export async function POST(request: NextRequest) {
  const { videoId, lyrics, devMode } = await request.json();

  if (!videoId || !lyrics?.length) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  const { data: existing } = await supabase
    .from('phrases')
    .select('offset_ms, ipa, meanings, explanation')
    .eq('video_id', videoId);

  const existingMap = new Map(
    existing?.map((r: any) => [Number(r.offset_ms), {
      ipa: r.ipa,
      meanings: r.meanings,
      explanation: r.explanation
    }]) ?? []
  );

  const DEV_LINE_COUNT = 5;
  const targetLyrics = devMode ? lyrics.slice(0, DEV_LINE_COUNT) : lyrics;

  const missing = targetLyrics.filter((l: any) => {
    const rec = existingMap.get(Number(l.offset));
    return !rec?.ipa || !rec?.meanings || !rec?.explanation;
  });

  console.log(`DB件数: ${existingMap.size} / 対象: ${targetLyrics.length} / 未解析: ${missing.length}`);

  if (missing.length === 0) {
    const ipaMap: Record<number, string> = {};
    const meaningsMap: Record<number, string> = {};
    const explanationMap: Record<number, string> = {};
    existingMap.forEach((val, offset) => {
      ipaMap[offset] = val.ipa;
      meaningsMap[offset] = val.meanings;
      explanationMap[offset] = val.explanation;
    });
    return NextResponse.json({ ipaMap, meaningsMap, explanationMap, cached: true });
  }

  const CHUNK_SIZE = 20;
  const chunks = [];
  for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
    chunks.push(missing.slice(i, i + CHUNK_SIZE));
  }

  const allResults: { offset: number; ipa: string; explanation: string; meanings: string }[] = [];

  for (const chunk of chunks) {
    try {
      const results = await analyzeChunk(chunk, apiKey!);
      allResults.push(...results);

      for (const r of results) {
        const exists = existingMap.has(Number(r.offset));
        if (exists) {
          await supabase
            .from('phrases')
            .update({ ipa: r.ipa, meanings: r.meanings, explanation: r.explanation })
            .eq('video_id', videoId)
            .eq('offset_ms', r.offset);
        } else {
          const line = chunk.find((l: any) => Number(l.offset) === Number(r.offset));
          await supabase.from('phrases').insert({
            video_id: videoId,
            offset_ms: r.offset,
            text: line?.text ?? '',
            ipa: r.ipa,
            meanings: r.meanings,
            explanation: r.explanation,
          });
        }
      }
    } catch (e) {
      console.error('チャンクエラー:', e);
    }
  }

  const ipaMap: Record<number, string> = {};
  const meaningsMap: Record<number, string> = {};
  const explanationMap: Record<number, string> = {};
  existingMap.forEach((val, offset) => {
    ipaMap[offset] = val.ipa;
    meaningsMap[offset] = val.meanings;
    explanationMap[offset] = val.explanation;
  });
  allResults.forEach(r => {
    ipaMap[r.offset] = r.ipa;
    meaningsMap[r.offset] = r.meanings;
    explanationMap[r.offset] = r.explanation;
  });

  return NextResponse.json({ ipaMap, meaningsMap, explanationMap, cached: false });
}