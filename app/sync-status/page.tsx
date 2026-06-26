'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, RotateCcw, Loader2 } from 'lucide-react';

interface Row {
  id: string; operation: string; status: 'pending' | 'in_flight' | 'delivered' | 'dead';
  attempts: number; lastError: string | null; createdAt: string; deliveredAt: string | null;
  propertyTitle: string | null; parcelId: string | null;
}

const statusColor: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  in_flight: 'bg-blue-100 text-blue-800',
  dead: 'bg-red-100 text-red-800',
};

export default function SyncStatusPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await fetch('/api/sync/outbox').then((r) => r.json()); setRows(d.rows || []); setCounts(d.counts || {}); }
    catch { setRows([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const retry = async (id?: string) => {
    setRetrying(id || 'all');
    try {
      const res = await fetch('/api/sync/outbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || 'Retry failed');
      await load();
    } finally { setRetrying(null); }
  };

  const deadCount = counts.dead ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sync Status</h1>
          <p className="text-sm text-muted-foreground">Outbound changes pushed to OwnMidwest. Retry anything that failed.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          <Button size="sm" disabled={retrying !== null || deadCount === 0} onClick={() => retry()}>
            {retrying === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4 mr-1" /> Retry failed ({deadCount})</>}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        {(['delivered', 'pending', 'in_flight', 'dead'] as const).map((s) => (
          <Badge key={s} className={statusColor[s]}>{s}: {counts[s] ?? 0}</Badge>
        ))}
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
        <p className="font-semibold">What this page shows</p>
        <p className="text-muted-foreground">
          Every change you make to a synced property (owner, tax-sale, or address) is pushed to OwnMidwest and listed here.
        </p>
        <ul className="space-y-1.5 text-muted-foreground">
          <li><strong className="text-foreground">delivered</strong> — sent to OwnMidwest successfully. Nothing to do.</li>
          <li><strong className="text-foreground">pending</strong> — queued, waiting to send. Usually clears on its own; click <strong className="text-foreground">Retry</strong> to send it now.</li>
          <li><strong className="text-foreground">in&nbsp;flight</strong> — being sent right now.</li>
          <li><strong className="text-foreground">dead</strong> — OwnMidwest rejected it (see the Error column). Fix the cause, then click <strong className="text-foreground">Retry</strong>. Common reasons: the property has no <strong className="text-foreground">Winning Bidder #</strong>, or it isn&apos;t set up in OwnMidwest (no county mapping).</li>
        </ul>
        <p className="text-muted-foreground">Properties that only exist in BidBridge (not in OwnMidwest) can&apos;t be pushed — that&apos;s expected, not a real error.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No outbound activity yet.</div>
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3">Operation</TableHead>
                  <TableHead className="py-2 px-3">Property</TableHead>
                  <TableHead className="py-2 px-3">Status</TableHead>
                  <TableHead className="py-2 px-3">Attempts</TableHead>
                  <TableHead className="py-2 px-3">Error</TableHead>
                  <TableHead className="py-2 px-3">When</TableHead>
                  <TableHead className="py-2 px-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="py-2 px-3 whitespace-nowrap">{r.operation}</TableCell>
                    <TableCell className="py-2 px-3 max-w-[180px] truncate">
                      {r.propertyTitle || r.parcelId || '—'}
                      {r.parcelId && <div className="text-xs text-muted-foreground">{r.parcelId}</div>}
                    </TableCell>
                    <TableCell className="py-2 px-3"><Badge className={statusColor[r.status]}>{r.status}</Badge></TableCell>
                    <TableCell className="py-2 px-3">{r.attempts}</TableCell>
                    <TableCell className="py-2 px-3 max-w-[420px] whitespace-normal break-words text-xs text-red-700">{r.lastError || '—'}</TableCell>
                    <TableCell className="py-2 px-3 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.deliveredAt || r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-right">
                      {(r.status === 'dead' || r.status === 'pending') && (
                        <Button size="sm" variant="outline" className="h-7 px-2" disabled={retrying !== null} onClick={() => retry(r.id)}>
                          {retrying === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Retry'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
