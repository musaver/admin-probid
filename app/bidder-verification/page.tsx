'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, Loader2, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';

interface Item {
  id: string; enteredValue: string; match: 'matched' | 'mismatch' | 'not_found';
  recordedNumber: string | null; title: string | null; propertyId: string | null;
}
interface Claim {
  id: string; omCountyId: number; countyName: string; bidderNumber: string;
  status: 'pending' | 'verified' | 'rejected'; note: string | null; createdAt: string;
  receiptUrl: string | null;
  bidder: { id: string; name: string | null; email: string | null } | null;
  items: Item[];
}

const statusColor: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', verified: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800',
};

function MatchIcon({ m }: { m: string }) {
  if (m === 'matched') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (m === 'mismatch') return <XCircle className="h-4 w-4 text-red-600" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
}
const matchText: Record<string, string> = { matched: 'Matches', mismatch: 'Mismatch', not_found: 'Awaiting results' };

export default function BidderVerificationPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Claim | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  // Which claim items the admin has ticked to link (itemId -> checked).
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bidder-claims?status=${statusFilter}`);
      const data = await res.json();
      const list: Claim[] = data.claims || [];
      setClaims(list);
      // Default: pre-tick only true matches (number + county agree). Mismatches and
      // "awaiting results" are left unticked — the admin can still tick them manually
      // (e.g. after checking the receipt). "Not found" can't be ticked at all.
      const init: Record<string, boolean> = {};
      list.forEach((c) => c.items.forEach((it) => { init[it.id] = it.match === 'matched'; }));
      setSelected(init);
    } catch { setClaims([]); } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const verify = async (claim: Claim) => {
    setBusyId(claim.id);
    try {
      const itemIds = claim.items.filter((it) => selected[it.id]).map((it) => it.id);
      const res = await fetch(`/api/bidder-claims/${claim.id}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) { alert(r.error || 'Failed to verify'); }
      else if (r.success) { alert(`Verified — ${r.linked} of ${r.total} propert${r.total === 1 ? 'y' : 'ies'} linked to the bidder.`); await load(); }
      else { alert(r.message || 'Nothing was linked.'); await load(); }
    } finally { setBusyId(null); }
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectNote.trim()) return;
    setBusyId(rejectTarget.id);
    try {
      const res = await fetch(`/api/bidder-claims/${rejectTarget.id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: rejectNote.trim() }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to reject'); }
      else { setRejectTarget(null); setRejectNote(''); await load(); }
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bidder Verification</h1>
        <p className="text-sm text-muted-foreground">Confirm bidder signups — their county bidder number vs. the winning bidder on each claimed property.</p>
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="verified">Verified</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : claims.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No {statusFilter === 'all' ? '' : statusFilter} claims.</CardContent></Card>
      ) : (
        claims.map((c) => {
          const matchedCount = c.items.filter((i) => i.match === 'matched').length;
          const selectedCount = c.items.filter((i) => selected[i.id]).length;
          return (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold">{c.bidder?.name || c.bidder?.email || 'Unknown bidder'}</div>
                    <div className="text-xs text-muted-foreground">{c.bidder?.email}</div>
                    <div className="text-sm mt-1">{c.countyName} · <strong>Bidder #{c.bidderNumber}</strong></div>
                    {c.receiptUrl && (
                      <a href={c.receiptUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                        <FileText className="h-3 w-3" /> View attached receipt
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge className={statusColor[c.status]}>{c.status}</Badge>
                    <div className="text-xs text-muted-foreground mt-1">{matchedCount}/{c.items.length} auto-match</div>
                  </div>
                </div>

                <div className="border rounded-md divide-y text-sm">
                  {c.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 px-3 py-2">
                      {c.status === 'pending' && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary disabled:opacity-40"
                          checked={!!selected[it.id]}
                          disabled={!it.propertyId}
                          title={it.propertyId ? 'Link this property to the bidder' : 'No matching property found — cannot link'}
                          onChange={(e) => setSelected((s) => ({ ...s, [it.id]: e.target.checked }))}
                        />
                      )}
                      <MatchIcon m={it.match} />
                      <span className="font-mono">{it.enteredValue}</span>
                      {it.title && <span className="text-muted-foreground truncate max-w-[180px]">— {it.title}</span>}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {matchText[it.match]}{it.recordedNumber ? ` (property #${it.recordedNumber})` : ''}{!it.propertyId ? ' — not found' : ''}
                      </span>
                    </div>
                  ))}
                </div>

                {c.status === 'pending' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Tick the properties to link to this bidder, then Verify. Matched ones are pre-ticked; you can
                    also link unmatched ones (e.g. after checking the receipt). &quot;Not found&quot; can&apos;t be linked.
                  </p>
                )}

                {c.status === 'rejected' && c.note && <div className="text-xs text-red-700 mt-2">Reason: {c.note}</div>}

                {c.status === 'pending' && (
                  <div className="flex gap-2 justify-end mt-3">
                    <Button size="sm" disabled={busyId === c.id || selectedCount === 0} onClick={() => verify(c)}>
                      {busyId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" /> Verify &amp; Link ({selectedCount})</>}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === c.id}
                      onClick={() => { setRejectTarget(c); setRejectNote(''); }}>
                      <X className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject claim</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{rejectTarget?.bidder?.email} · {rejectTarget?.countyName} · #{rejectTarget?.bidderNumber}</p>
          <Textarea placeholder="Reason (the bidder will see this)" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectNote.trim() || busyId === rejectTarget?.id} onClick={submitReject}>
              {busyId === rejectTarget?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
