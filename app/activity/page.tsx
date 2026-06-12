'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityRow {
  activity: { id: string; userId: string; eventType: string; ipAddress: string | null; createdAt: string };
  actor: { id: string; name: string | null; email: string | null; type: string | null } | null;
}

const eventColor: Record<string, string> = {
  login: 'bg-green-100 text-green-800',
  logout: 'bg-gray-100 text-gray-700',
};

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventType !== 'all') params.set('eventType', eventType);
      const res = await fetch(`/api/activity?${params.toString()}`);
      const data = await res.json();
      setRows(data.activity || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [eventType]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Bidder & county activity (logins, etc.) — retained on BidBridge.</p>
      </div>

      <div className="flex gap-4">
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="bid_submitted">Bid submitted</SelectItem>
            <SelectItem value="suggestion_submitted">Suggestion submitted</SelectItem>
            <SelectItem value="property_edited">Property edited (county)</SelectItem>
            <SelectItem value="profile_updated">Profile updated</SelectItem>
            <SelectItem value="property_viewed">Property viewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No activity recorded yet.</div>
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3">User</TableHead>
                  <TableHead className="py-2 px-3">Role</TableHead>
                  <TableHead className="py-2 px-3">Event</TableHead>
                  <TableHead className="py-2 px-3">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ activity: a, actor }) => (
                  <TableRow key={a.id}>
                    <TableCell className="py-2 px-3">{actor?.name || actor?.email || a.userId}</TableCell>
                    <TableCell className="py-2 px-3 capitalize">{actor?.type || '—'}</TableCell>
                    <TableCell className="py-2 px-3">
                      <Badge className={eventColor[a.eventType] || 'bg-blue-100 text-blue-800'}>{a.eventType.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    <TableCell className="py-2 px-3 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</TableCell>
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
