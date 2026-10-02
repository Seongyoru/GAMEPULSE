import { NextResponse } from 'next/server';
import { getReadStore } from '@/server/store';
import { dataSourceKind } from '@/server/env';

/** Liveness + data freshness for uptime monitors. Never cached; exposes no secrets. */
export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    const store = await getReadStore();
    const lastUpdatedAt = await store.getLastUpdatedAt();
    return NextResponse.json(
      { status: 'ok', dataSource: dataSourceKind(), lastUpdatedAt, checkedAt },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'unavailable', checkedAt },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
