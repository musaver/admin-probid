'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, Loader2 } from 'lucide-react';

interface CR {
  request: {
    id: string; fieldName: string; oldValue: string | null; newValue: string;
    reason: string | null; status: 'pending' | 'approved' | 'rejected';
    requestedByRole: 'bidder' | 'county'; reviewNote: string | null; createdAt: string;
  };
  property: { id: string; title: string | null; saleId: string | null; address: string | null } | null;
  requester: { id: string; name: string | null; email: string | null; bidderNumber: string | null } | null;
  label: string;
}

const statusColor: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function ReviewPage() {
  const [rows, setRows] = useState<CR[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [roleFilter, setRoleFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CR | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (roleFilter !== 'all') params.set('role', roleFilter);
      const res = await fetch(`/api/change-requests?${params.toString()}`);
      const data = await res.json();
      setRows(data.requests || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/change-requests/${id}/approve`, { method: 'POST' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to approve'); }
      else await load();
    } finally { setBusyId(null); }
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectNote.trim()) return;
    setBusyId(rejectTarget.request.id);
    try {
      const res = await fetch(`/api/change-requests/${rejectTarget.request.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNote: rejectNote.trim() }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to reject'); }
      else { setRejectTarget(null); setRejectNote(''); await load(); }
    } finally { setBusyId(null); }
  };

  const pendingCount = rows.filter((r) => r.request.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Center</h1>
          <p className="text-sm text-muted-foreground">Bidder & county change requests for the tax-sale data fields.</p>
        </div>
        {statusFilter === 'pending' && <Badge variant="secondary">Pending: {pendingCount}</Badge>}
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="bidder">Bidder</SelectItem>
            <SelectItem value="county">County</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No {statusFilter === 'all' ? '' : statusFilter} requests.</div>
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3">Requester</TableHead>
                  <TableHead className="py-2 px-3">Property</TableHead>
                  <TableHead className="py-2 px-3">Field</TableHead>
                  <TableHead className="py-2 px-3">Change</TableHead>
                  <TableHead className="py-2 px-3">Reason</TableHead>
                  <TableHead className="py-2 px-3">Status</TableHead>
                  <TableHead className="py-2 px-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ request: r, property: p, requester: u, label }) => (
                  <TableRow key={r.id}>
                    <TableCell className="py-2 px-3">
                      <div className="font-medium">{u?.name || u?.email || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {r.requestedByRole}{u?.bidderNumber ? ` · #${u.bidderNumber}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-3 max-w-[160px] truncate">
                      {p?.title || p?.address || '—'}<div className="text-xs text-muted-foreground">{p?.saleId}</div>
                    </TableCell>
                    <TableCell className="py-2 px-3 whitespace-nowrap">{label}</TableCell>
                    <TableCell className="py-2 px-3">
                      <span className="text-muted-foreground line-through">{r.oldValue || '—'}</span>
                      {' → '}
                      <span className="font-medium">{r.newValue}</span>
                    </TableCell>
                    <TableCell className="py-2 px-3 max-w-[180px] truncate text-muted-foreground">{r.reason || '—'}</TableCell>
                    <TableCell className="py-2 px-3">
                      <Badge className={statusColor[r.status]}>{r.status}</Badge>
                      {r.status === 'rejected' && r.reviewNote && (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[160px] truncate" title={r.reviewNote}>{r.reviewNote}</div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-right">
                      {r.status === 'pending' ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" className="h-7 px-2" disabled={busyId === r.id} onClick={() => approve(r.id)}>
                            {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 px-2" disabled={busyId === r.id}
                            onClick={() => { setRejectTarget({ request: r, property: p, requester: u, label }); setRejectNote(''); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject change request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {rejectTarget?.label}: <span className="line-through">{rejectTarget?.request.oldValue || '—'}</span> → {rejectTarget?.request.newValue}
          </p>
          <Textarea placeholder="Reason for rejection (required) — the requester will see this." value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectNote.trim() || busyId === rejectTarget?.request.id} onClick={submitReject}>
              {busyId === rejectTarget?.request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
