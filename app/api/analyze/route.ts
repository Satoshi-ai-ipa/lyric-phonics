import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function parseMeaningsToChunks(
  meanings: string,
  videoId: string,
  offsetMs: number
): { video_id: string; phrase_offset_ms: number; english: string; japanese: string; position: number }[] {
  if (!meanings) return [];
  return meanings.split('/').map((s, i) => {
    const [english, japanese] = s.split('=').map(x => x?.trim() ?? '');
    return {
      video_id: videoId,
      phrase_offset_ms: offsetMs,
      english,
      japanese,
      position: i,
    };
  }).filter(c => c.english && c.japanese);
}

async function analyzeChunk(
  chunk: any[],
  apiKey: string,
  mode: string
): Promise<{ offset: number; ipa?: string; explanation?: string; meanings?: string }[]> {
  const lyricsText = chunk
    .map((l: any, i: number) => `${i + 1}. [${l.offset}ms] ${l.text}`)
    .join('\n');

  let prompt = '';

  if (mode === 'ipa') {
    prompt = `You are a world-class Linguist and Phonetician specializing in General American (GA) pronunciation.
Analyze each phrase and provide ONLY the IPA transcription at Casual (everyday native conversation) level.

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

Phrases:
${lyricsText}

Return ONLY a valid JSON array:
[{"offset": <number>, "ipa": "<casual IPA, no brackets>"}]`;

  } else if (mode === 'meanings') {
    prompt = `You are a linguist helping Japanese learners understand English lyrics.
Analyze each phrase and provide ONLY the meaning chunks.

### MEANINGS FORMAT:
Split into small English chunks of 1-3 words based on grammatical units.

CHUNKING RULES WITH EXAMPLES:

Rule 1: Function words (the, a, an) attach to their noun.
GOOD: "the bar" = 1 chunk / "a lover" = 1 chunk
BAD:  "the" + "bar" = 2 chunks

Rule 2: Prepositions attach to their noun.
GOOD: "at the table" = 1 chunk / "in the club" = 1 chunk
BAD:  "at" + "the table" = 2 chunks

Rule 3: Relative/subordinate clauses stay together.
GOOD: "where I go" = 1 chunk / "what I feel" = 1 chunk / "who she is" = 1 chunk / "that I love" = 1 chunk / "how it ends" = 1 chunk
BAD:  "where" + "I go" = 2 chunks

Rule 4: Verb and object are separate chunks.
GOOD: "find" / "a lover" = 2 chunks
BAD:  "find a lover" = 1 chunk

Rule 5: Conjunctions are their own chunk.
GOOD: "and then" = 1 chunk / "so" = 1 chunk / "but still" = 1 chunk / "'cause" = 1 chunk / "even though" = 1 chunk
BAD:  "and then we" = 1 chunk

Rule 6: Subject pronouns are their own chunk.
GOOD: "I" / "we" / "you" = 1 chunk each
BAD:  "I go" = 1 chunk

Rule 7: Phrasal verbs stay together.
GOOD: "give up" = 1 chunk / "hold on" = 1 chunk / "let go" = 1 chunk / "break down" = 1 chunk / "come over" = 1 chunk
BAD:  "give" + "up" = 2 chunks

Rule 8: Contracted/informal forms are 1 chunk.
GOOD: "gonna" = 1 chunk / "wanna" = 1 chunk / "ain't" = 1 chunk / "gotta" = 1 chunk
BAD:  "going" + "to" = 2 chunks

Rule 9: Adverbial phrases are 1 chunk.
GOOD: "every day" = 1 chunk / "all my life" = 1 chunk / "one more time" = 1 chunk / "right here" = 1 chunk / "far away" = 1 chunk / "all night" = 1 chunk / "back then" = 1 chunk / "some day" = 1 chunk / "over and over" = 1 chunk
BAD:  "all" + "my life" = 2 chunks

Rule 10: Exclamations/filler words are 1 chunk.
GOOD: "yeah" = 1 chunk / "oh" = 1 chunk / "hey" = 1 chunk
BAD:  splitting exclamations

FULL EXAMPLES FROM SHAPE OF YOU:

"The club isn't the best place to find a lover"
→ "the club"=そのクラブは / "isn't"=ではない / "the best place"=最高の場所 / "to find"=見つけるために / "a lover"=恋人を

"So the bar is where I go"
→ "so"=だから / "the bar"=そのバーは / "is"=である / "where I go"=私が行く場所

"Me and my friends at the table doing shots"
→ "me and my friends"=私と友達が / "at the table"=テーブルで / "doing shots"=ショットを飲んでいる

"Drinking fast and then we talk slow"
→ "drinking fast"=速く飲んで / "and then"=そして / "we"=私たちは / "talk slow"=ゆっくり話す

"Come over and start up a conversation with just me"
→ "come over"=やってきて / "and"=そして / "start up"=始める / "a conversation"=会話を / "with just me"=私だけと

GENERAL LYRIC EXAMPLES:

"I don't know what I feel"
→ "I"=私は / "don't know"=わからない / "what I feel"=自分が何を感じているか

"I can't help but miss you"
→ "I"=私は / "can't help"=我慢できない / "but"=けれど / "miss you"=あなたが恋しい

"every day without you"
→ "every day"=毎日 / "without you"=あなたなしで

"I need you back in my life"
→ "I"=私は / "need you"=あなたが必要 / "back"=戻ってきて / "in my life"=私の人生に

"even though it's over"
→ "even though"=たとえ〜でも / "it's over"=終わっていても

"gonna give up on you"
→ "gonna"=するつもり / "give up"=諦める / "on you"=あなたのことを

"one more time, hold on"
→ "one more time"=もう一度 / "hold on"=待って

"back then I used to love you"
→ "back then"=あの頃 / "I"=私は / "used to"=していた / "love you"=あなたを愛して

Format: "english chunk=日本語訳 / english chunk=日本語訳"

BE-VERB TRANSLATION RULES:
- Existential be (location/existence) → 「いる」or「ある」
  Example: "I am here" → 「いる」
- Linking be (SVC: describing what something IS) → 「である」
  Example: "is where I go" → 「である」
  Example: "is the best place" → 「である」
  Example: "are the ones" → 「である」
- Negative linking be → 「ではない」
  Example: "isn't the best place" → 「ではない」

Japanese translation must flow naturally when chunks are read left to right.

Phrases:
${lyricsText}

Return ONLY a valid JSON array:
[{"offset": <number>, "meanings": "<chunk>=<日本語> / ..."}]`;

  } else if (mode === 'explanation') {
    prompt = `You are a world-class Linguist and Phonetician specializing in General American (GA) pronunciation.
Analyze each phrase and provide ONLY Japanese explanations of phonetic changes compared to dictionary pronunciation.

### EXPLANATION FORMAT (Japanese, numbered):
Compare to dictionary pronunciation. Use this exact format:
① spelling [dictionary IPA] → [casual IPA] (日本語での解説)

Example for "and my friends":
① and [ænd] → [ən] (機能語のandは弱形になり、母音がシュワーに弱化、語末のdが脱落しています)
② my [maɪ] → [mɪ] (非強調位置のため母音が弱化しています)

Example for "get up":
① get up [ɡɛt ʌp] → [ɡɛɾʌp] (tが母音に挟まれるためフラップ化し、単語境界が消えています)

Example for "did you":
① did you [dɪd juː] → [dɪdʒu] (dとjが隣接するため合流が起き、破擦音dʒになります)

Example for "want to":
① want to [wɒnt tuː] → [wɑːnə] (toが弱形に弱化し、語末のtも脱落してwanna化します)

Example for "going to":
① going to [ɡoʊɪŋ tuː] → [ɡənə] (gonna化により大幅に短縮されます)

Example for "the club":
① the [ðiː] → [ðə] (機能語のtheは常に弱形で、母音はシュワーになります)

Example for "to find":
① to [tuː] → [tə] (機能語のtoは弱形になり、母音がシュワーに弱化します)

Example for "kind of":
① of [ɒv] → [ə] (機能語のofは最大限弱化し、子音vも脱落します)

Example for "I can go":
① can [kæn] → [kən] (助動詞のcanは非強調位置で弱形になり母音がシュワーに弱化します)

If no changes occur, return "なし".

Phrases:
${lyricsText}

Return ONLY a valid JSON array:
[{"offset": <number>, "explanation": "<Japanese numbered explanation>"}]`;

  } else {
    prompt = `You are a world-class Linguist and Phonetician specializing in General American (GA) pronunciation.
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

Example for "and my friends":
① and [ænd] → [ən] (機能語のandは弱形になり、母音がシュワーに弱化、語末のdが脱落しています)
② my [maɪ] → [mɪ] (非強調位置のため母音が弱化しています)

Example for "get up":
① get up [ɡɛt ʌp] → [ɡɛɾʌp] (tが母音に挟まれるためフラップ化し、単語境界が消えています)

Example for "did you":
① did you [dɪd juː] → [dɪdʒu] (dとjが隣接するため合流が起き、破擦音dʒになります)

Example for "want to":
① want to [wɒnt tuː] → [wɑːnə] (toが弱形に弱化し、語末のtも脱落してwanna化します)

Example for "going to":
① going to [ɡoʊɪŋ tuː] → [ɡənə] (gonna化により大幅に短縮されます)

Example for "the club":
① the [ðiː] → [ðə] (機能語のtheは常に弱形で、母音はシュワーになります)

Example for "to find":
① to [tuː] → [tə] (機能語のtoは弱形になり、母音がシュワーに弱化します)

Example for "kind of":
① of [ɒv] → [ə] (機能語のofは最大限弱化し、子音vも脱落します)

Example for "I can go":
① can [kæn] → [kən] (助動詞のcanは非強調位置で弱形になり母音がシュワーに弱化します)

If no changes occur, return "なし".

### MEANINGS FORMAT:
Split into small English chunks of 1-3 words based on grammatical units.

CHUNKING RULES WITH EXAMPLES:

Rule 1: Function words (the, a, an) attach to their noun.
GOOD: "the bar" = 1 chunk / "a lover" = 1 chunk
BAD:  "the" + "bar" = 2 chunks

Rule 2: Prepositions attach to their noun.
GOOD: "at the table" = 1 chunk / "in the club" = 1 chunk
BAD:  "at" + "the table" = 2 chunks

Rule 3: Relative/subordinate clauses stay together.
GOOD: "where I go" = 1 chunk / "what I feel" = 1 chunk / "who she is" = 1 chunk / "that I love" = 1 chunk / "how it ends" = 1 chunk
BAD:  "where" + "I go" = 2 chunks

Rule 4: Verb and object are separate chunks.
GOOD: "find" / "a lover" = 2 chunks
BAD:  "find a lover" = 1 chunk

Rule 5: Conjunctions are their own chunk.
GOOD: "and then" = 1 chunk / "so" = 1 chunk / "but still" = 1 chunk / "'cause" = 1 chunk / "even though" = 1 chunk
BAD:  "and then we" = 1 chunk

Rule 6: Subject pronouns are their own chunk.
GOOD: "I" / "we" / "you" = 1 chunk each
BAD:  "I go" = 1 chunk

Rule 7: Phrasal verbs stay together.
GOOD: "give up" = 1 chunk / "hold on" = 1 chunk / "let go" = 1 chunk / "break down" = 1 chunk / "come over" = 1 chunk
BAD:  "give" + "up" = 2 chunks

Rule 8: Contracted/informal forms are 1 chunk.
GOOD: "gonna" = 1 chunk / "wanna" = 1 chunk / "ain't" = 1 chunk / "gotta" = 1 chunk
BAD:  "going" + "to" = 2 chunks

Rule 9: Adverbial phrases are 1 chunk.
GOOD: "every day" = 1 chunk / "all my life" = 1 chunk / "one more time" = 1 chunk / "right here" = 1 chunk / "far away" = 1 chunk / "all night" = 1 chunk / "back then" = 1 chunk / "some day" = 1 chunk / "over and over" = 1 chunk
BAD:  "all" + "my life" = 2 chunks

Rule 10: Exclamations/filler words are 1 chunk.
GOOD: "yeah" = 1 chunk / "oh" = 1 chunk / "hey" = 1 chunk
BAD:  splitting exclamations

FULL EXAMPLES FROM SHAPE OF YOU:

"The club isn't the best place to find a lover"
→ "the club"=そのクラブは / "isn't"=ではない / "the best place"=最高の場所 / "to find"=見つけるために / "a lover"=恋人を

"So the bar is where I go"
→ "so"=だから / "the bar"=そのバーは / "is"=である / "where I go"=私が行く場所

"Me and my friends at the table doing shots"
→ "me and my friends"=私と友達が / "at the table"=テーブルで / "doing shots"=ショットを飲んでいる

"Drinking fast and then we talk slow"
→ "drinking fast"=速く飲んで / "and then"=そして / "we"=私たちは / "talk slow"=ゆっくり話す

"Come over and start up a conversation with just me"
→ "come over"=やってきて / "and"=そして / "start up"=始める / "a conversation"=会話を / "with just me"=私だけと

GENERAL LYRIC EXAMPLES:

"I don't know what I feel"
→ "I"=私は / "don't know"=わからない / "what I feel"=自分が何を感じているか

"I can't help but miss you"
→ "I"=私は / "can't help"=我慢できない / "but"=けれど / "miss you"=あなたが恋しい

"every day without you"
→ "every day"=毎日 / "without you"=あなたなしで

"I need you back in my life"
→ "I"=私は / "need you"=あなたが必要 / "back"=戻ってきて / "in my life"=私の人生に

"even though it's over"
→ "even though"=たとえ〜でも / "it's over"=終わっていても

"gonna give up on you"
→ "gonna"=するつもり / "give up"=諦める / "on you"=あなたのことを

"one more time, hold on"
→ "one more time"=もう一度 / "hold on"=待って

"back then I used to love you"
→ "back then"=あの頃 / "I"=私は / "used to"=していた / "love you"=あなたを愛して

Format: "english chunk=日本語訳 / english chunk=日本語訳"

BE-VERB TRANSLATION RULES:
- Existential be (location/existence) → 「いる」or「ある」
  Example: "I am here" → 「いる」
- Linking be (SVC: describing what something IS) → 「である」
  Example: "is where I go" → 「である」
  Example: "is the best place" → 「である」
  Example: "are the ones" → 「である」
- Negative linking be → 「ではない」
  Example: "isn't the best place" → 「ではない」

Japanese translation must flow naturally when chunks are read left to right.

Phrases to analyze:
${lyricsText}

Return ONLY a valid JSON array:
[{"offset": <number>, "ipa": "<casual IPA, no brackets>", "explanation": "<Japanese numbered explanation>", "meanings": "<chunk>=<日本語> / ..."}]`;
  }

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
  const { videoId, lyrics, mode = 'all' } = await request.json();

  if (!videoId || !lyrics?.length) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // videosテーブルに登録（未登録の場合のみ）
  const { data: existingVideo } = await supabase
    .from('videos')
    .select('id')
    .eq('video_id', videoId)
    .single();

  if (!existingVideo) {
    // YouTube APIからタイトルを取得
    const youtubeApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeApiKey}`
    );
    const ytData = await ytRes.json();
    const snippet = ytData.items?.[0]?.snippet;

    await supabase.from('videos').insert({
      video_id: videoId,
      title: snippet?.title ?? '',
      artist_name: snippet?.channelTitle ?? '',
      accent: 'GA',
    });
  }

  const { data: existing } = await supabase
    .from('phrases')
    .select('offset_ms, ipa, meanings, explanation')
    .eq('video_id', videoId)
    .limit(1000);

  const existingMap = new Map(
    existing?.map((r: any) => [Number(r.offset_ms), {
      ipa: r.ipa,
      meanings: r.meanings,
      explanation: r.explanation
    }]) ?? []
  );

  const targetLyrics = lyrics;

  const missing = targetLyrics.filter((l: any) => {
    const rec = existingMap.get(Number(l.offset));
    if (mode === 'ipa') return true;
    if (mode === 'meanings') return true;
    if (mode === 'explanation') return true;
    return !rec?.ipa || !rec?.meanings || !rec?.explanation;
  });

  console.log(`モード: ${mode} / DB件数: ${existingMap.size} / 対象: ${targetLyrics.length} / 未解析: ${missing.length}`);

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

  const allResults: { offset: number; ipa?: string; explanation?: string; meanings?: string }[] = [];

  for (const chunk of chunks) {
    try {
      const results = await analyzeChunk(chunk, apiKey!, mode);
      allResults.push(...results);

      for (const r of results) {
        const exists = existingMap.has(Number(r.offset));
        const updateData: any = {};
        if (r.ipa !== undefined) updateData.ipa = r.ipa;
        if (r.meanings !== undefined) updateData.meanings = r.meanings;
        if (r.explanation !== undefined) updateData.explanation = r.explanation;

        if (exists) {
          await supabase.from('phrases').update(updateData)
            .eq('video_id', videoId)
            .eq('offset_ms', r.offset);
        } else {
          await supabase.from('phrases').upsert({
            video_id: videoId,
            offset_ms: r.offset,
            ...updateData,
          }, { onConflict: 'video_id,offset_ms' });
        }

        if (r.meanings !== undefined) {
          const chunkRows = parseMeaningsToChunks(r.meanings, videoId, Number(r.offset));
          await supabase.from('chunks').delete()
            .eq('video_id', videoId)
            .eq('phrase_offset_ms', Number(r.offset));
          if (chunkRows.length > 0) {
            await supabase.from('chunks').insert(chunkRows);
          }
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
    if (r.ipa) ipaMap[r.offset] = r.ipa;
    if (r.meanings) meaningsMap[r.offset] = r.meanings;
    if (r.explanation) explanationMap[r.offset] = r.explanation;
  });

  return NextResponse.json({ ipaMap, meaningsMap, explanationMap, cached: false });
}