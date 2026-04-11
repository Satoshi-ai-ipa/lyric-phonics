import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'missing videoId' }, { status: 400 });
  }

  const { data: chunks } = await supabase
    .from('chunks')
    .select('id, phrase_offset_ms, english, japanese, start_ms, end_ms, position')
    .eq('video_id', videoId)
    .order('phrase_offset_ms')
    .order('position')
    .limit(2000);

  if (!chunks) {
    return NextResponse.json({ chunksMap: {} });
  }

  // phrase_offset_msごとにグループ化
  const chunksMap: Record<number, any[]> = {};
  for (const chunk of chunks) {
    const key = Number(chunk.phrase_offset_ms);
    if (!chunksMap[key]) chunksMap[key] = [];
    chunksMap[key].push(chunk);
  }

  return NextResponse.json({ chunksMap });
}