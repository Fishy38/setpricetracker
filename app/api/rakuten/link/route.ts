// app/api/rakuten/link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDeepLink } from '@/lib/rakuten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { merchantId, destinationUrl } = await req.json();
  if (!merchantId || !destinationUrl)
    return NextResponse.json({ error: 'Missing merchantId or destinationUrl' }, { status: 400 });

  try {
    const link = await getDeepLink(merchantId, destinationUrl);
    return NextResponse.json({ affiliateLink: link });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
  }
}