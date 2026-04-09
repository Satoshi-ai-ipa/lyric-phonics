import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en',
    });
    return NextResponse.json({ transcript });
  } catch (e) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      return NextResponse.json({ transcript });
    } catch (e2) {
      return NextResponse.json({ error: 'transcript not found' }, { status: 404 });
    }
  }
}