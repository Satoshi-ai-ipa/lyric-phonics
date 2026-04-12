import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'missing videoId' }, { status: 400 });
  }

  const { data } = await supabase
    .from('phrases')
    .select('id')
    .eq('video_id', videoId)
    .limit(1);

  const isAnalyzed = data && data.length > 0;

  return NextResponse.json({ isAnalyzed });
}