'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Trash2, Pin, Loader2 } from 'lucide-react';

interface Post {
  id: string; title: string; body: string; audience: 'all' | 'bidder' | 'county';
  pinned: number; published: number; createdAt: string;
}
const audienceLabel: Record<string, string> = { all: 'Everyone', bidder: 'Bidders', county: 'Counties' };

export default function BulletinPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'bidder' | 'county'>('all');
  const [pinned, setPinned] = useState(false);
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await fetch('/api/bulletin').then((r) => r.json()); setPosts(d.posts || []); }
    catch { setPosts([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setEditing(null); setTitle(''); setBody(''); setAudience('all'); setPinned(false); setPublished(true); };
  const startEdit = (p: Post) => {
    setEditing(p); setTitle(p.title); setBody(p.body); setAudience(p.audience);
    setPinned(p.pinned === 1); setPublished(p.published === 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { alert('Title and message are required.'); return; }
    setSaving(true);
    try {
      const payload = { title, body, audience, pinned, published };
      const res = editing
        ? await fetch(`/api/bulletin/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/bulletin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { alert('Failed to save.'); return; }
      reset(); await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/bulletin/${id}`, { method: 'DELETE' });
    if (editing?.id === id) reset();
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulletin Board</h1>
        <p className="text-sm text-muted-foreground">Post news & updates for bidders and county users.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold">{editing ? 'Edit post' : 'New post'}</h2>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Greenville & Spartanburg are now live" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your update…" />
            </div>
            <div className="flex flex-wrap items-end gap-6">
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as 'all' | 'bidder' | 'county')}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="bidder">Bidders only</SelectItem>
                    <SelectItem value="county">Counties only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2"><Checkbox checked={pinned} onCheckedChange={(v) => setPinned(!!v)} /> Pin to top</label>
              <label className="flex items-center gap-2"><Checkbox checked={published} onCheckedChange={(v) => setPublished(!!v)} /> Published</label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? 'Save changes' : 'Post')}</Button>
              {editing && <Button type="button" variant="outline" onClick={reset}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <h2 className="font-semibold">All posts</h2>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : posts.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No posts yet.</CardContent></Card>
      ) : (
        posts.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {p.pinned === 1 && <Pin className="h-3.5 w-3.5 text-amber-600" />}
                    <span className="font-semibold">{p.title}</span>
                    <Badge variant="secondary" className="text-xs">{audienceLabel[p.audience]}</Badge>
                    {p.published === 0 && <Badge className="bg-gray-200 text-gray-700 text-xs">Draft</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{p.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(p.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="destructive" className="h-8 px-2" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
