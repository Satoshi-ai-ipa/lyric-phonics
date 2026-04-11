import whisper
import os
from supabase import create_client

# Supabaseの設定
SUPABASE_URL = "https://zvhlrxctyneoeohkxyvn.supabase.co"
SUPABASE_KEY = "sb_publishable_2Vv5Dsu9_C1sti2fQH4NKw_gQOFAUEk"
VIDEO_ID = "JGwWNGJdvx8"
AUDIO_FILE = "audio.mp3"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Whisperで解析
print("Whisperで解析中...")
model = whisper.load_model("base")
result = model.transcribe(AUDIO_FILE, word_timestamps=True)
print("解析完了！")

# 全単語のタイムスタンプを取得
all_words = []
for segment in result["segments"]:
    for word in segment.get("words", []):
        all_words.append({
            "word": word["word"].strip(),
            "start_ms": int(word["start"] * 1000),
            "end_ms": int(word["end"] * 1000),
        })

print(f"取得した単語数: {len(all_words)}")

# Supabaseからphrasesを取得（行の区切りとして使う）
phrases = supabase.table("phrases")\
    .select("offset_ms")\
    .eq("video_id", VIDEO_ID)\
    .order("offset_ms")\
    .execute()

phrase_offsets = [p["offset_ms"] for p in phrases.data]
print(f"phrase数: {len(phrase_offsets)}")

# Supabaseからchunksを取得
chunks = supabase.table("chunks")\
    .select("id, phrase_offset_ms, english, position")\
    .eq("video_id", VIDEO_ID)\
    .order("phrase_offset_ms")\
    .order("position")\
    .execute()

print(f"chunk数: {len(chunks.data)}")

# phrase_offset_msごとにchunksをグループ化
from collections import defaultdict
chunks_by_phrase = defaultdict(list)
for chunk in chunks.data:
    chunks_by_phrase[chunk["phrase_offset_ms"]].append(chunk)

# 各phraseの時間範囲内にあるWhisperの単語を取得
def get_words_in_range(start_ms, end_ms):
    return [w for w in all_words if start_ms <= w["start_ms"] < end_ms]

# chunksにタイムスタンプを割り当てる
print("タイムスタンプを割り当て中...")
updated = 0
not_found = 0

for idx, phrase_offset_ms in enumerate(phrase_offsets):
    # 次のphraseの開始時間を終了時間とする
    if idx + 1 < len(phrase_offsets):
        phrase_end_ms = phrase_offsets[idx + 1]
    else:
        phrase_end_ms = phrase_offset_ms + 10000

    # この行の範囲内にあるWhisperの単語を取得
    words_in_range = get_words_in_range(phrase_offset_ms, phrase_end_ms)
    
    if not words_in_range:
        # 少し前後に余裕を持たせて再検索（500ms）
        words_in_range = get_words_in_range(
            phrase_offset_ms - 500, 
            phrase_end_ms + 500
        )

    # この行のchunksを取得
    phrase_chunks = chunks_by_phrase.get(phrase_offset_ms, [])
    
    if not words_in_range or not phrase_chunks:
        not_found += len(phrase_chunks)
        continue

    # chunksをpositionで並び替え
    phrase_chunks.sort(key=lambda x: x["position"])
    
    # 単語をchunksに均等に割り当てる
    total_words = len(words_in_range)
    total_chunks = len(phrase_chunks)
    
    for chunk_idx, chunk in enumerate(phrase_chunks):
        # このchunkに割り当てる単語の範囲を計算
        word_start_idx = int(chunk_idx * total_words / total_chunks)
        word_end_idx = int((chunk_idx + 1) * total_words / total_chunks)
        
        if word_start_idx >= total_words:
            not_found += 1
            continue
            
        word_end_idx = min(word_end_idx, total_words)
        chunk_words = words_in_range[word_start_idx:word_end_idx]
        
        if not chunk_words:
            not_found += 1
            continue
        
        start_ms = chunk_words[0]["start_ms"]
        end_ms = chunk_words[-1]["end_ms"]
        
        supabase.table("chunks").update({
            "start_ms": start_ms,
            "end_ms": end_ms,
            "duration_ms": end_ms - start_ms
        }).eq("id", chunk["id"]).execute()
        
        updated += 1

print(f"更新完了: {updated}件 / 未発見: {not_found}件")

# 音声ファイルを削除
os.remove(AUDIO_FILE)
print(f"{AUDIO_FILE}を削除しました")