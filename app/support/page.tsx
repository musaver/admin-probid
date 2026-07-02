'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';

interface Thread { userId: string; name: string | null; email: string | null; type: string | null; lastAt: string; unread: number; lastBody: string | null; }
interface Msg { id: number; senderRole: 'user' | 'admin'; body: string; createdAt: string; }
interface ThreadUser { id: string; name: string | null; email: string | null; type: string | null; }

// Deterministic initial + color for a user (so each person keeps the same avatar color).
const AVATAR_COLORS = ['#4d7400', '#2563eb', '#9333ea', '#dc2626', '#ea580c', '#0891b2', '#65a30d', '#db2777'];
function initialOf(s: string | null | undefined) { return (s?.trim()?.[0] || '?').toUpperCase(); }
function colorOf(s: string | null | undefined) {
  const str = s || '';
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
// Smart timestamp: time if today, "Yesterday", else short date.
function formatChatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}
function Avatar({ seed, label, size = 36 }: { seed: string | null | undefined; label: string | null | undefined; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0"
      style={{ background: colorOf(seed), width: size, height: size, fontSize: size * 0.4 }}
    >
      {initialOf(label)}
    </span>
  );
}

export default function AdminSupportPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadUser, setThreadUser] = useState<ThreadUser | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try { const r = await fetch('/api/support'); const d = await r.json(); setThreads(d.threads || []); }
    catch { /* ignore */ } finally { setLoadingThreads(false); }
  }, []);

  const loadThread = useCallback(async (userId: string) => {
    try { const r = await fetch(`/api/support?userId=${userId}`); const d = await r.json(); setMessages(d.messages || []); setThreadUser(d.user || null); }
    catch { /* ignore */ }
  }, []);

  useEffect(() => { loadThreads(); const t = setInterval(loadThreads, 8000); return () => clearInterval(t); }, [loadThreads]);

  useEffect(() => {
    if (!activeUser) return;
    loadThread(activeUser);
    const t = setInterval(() => loadThread(activeUser), 5000);
    return () => clearInterval(t);
  }, [activeUser, loadThread]);

  // Scroll only the messages box, not the whole page.
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [messages]);

  const send = async () => {
    const b = reply.trim();
    if (!b || !activeUser) return;
    setSending(true);
    try {
      const r = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: activeUser, body: b }) });
      if (r.ok) { setReply(''); await loadThread(activeUser); await loadThreads(); }
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">Direct support threads with bidders and counties. Click a conversation to read and reply.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Thread list */}
        <Card className="md:col-span-1">
          <CardContent className="p-0 divide-y max-h-[70vh] overflow-y-auto">
            {loadingThreads ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : threads.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No messages yet.</div>
            ) : (
              threads.map((t) => (
                <button key={t.userId} onClick={() => setActiveUser(t.userId)} className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${activeUser === t.userId ? 'bg-muted' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Avatar seed={t.userId} label={t.name || t.email} size={44} />
                    <div className="flex-1 min-w-0">
                      {/* Top row: name + role chip (left), time (right) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm truncate">{t.name || t.email || 'Unknown'}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize shrink-0 ${t.type === 'county' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {t.type || 'user'}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatChatTime(t.lastAt)}</span>
                      </div>
                      {/* Bottom row: preview (left), unread badge (right) */}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">{t.lastBody}</span>
                        {Number(t.unread) > 0 && (
                          <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold h-5 min-w-[20px] px-1.5 shrink-0">
                            {Number(t.unread) > 99 ? '99+' : t.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Thread view */}
        <Card className="md:col-span-2">
          <CardContent className="p-4 flex flex-col h-[70vh]">
            {!activeUser ? (
              <div className="m-auto text-sm text-muted-foreground">Select a conversation to view.</div>
            ) : (
              <>
                <div className="border-b pb-2 mb-2 flex items-center gap-3">
                  <Avatar seed={threadUser?.id} label={threadUser?.name || threadUser?.email} size={40} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{threadUser?.name || threadUser?.email || 'User'}</div>
                    <div className="text-xs text-muted-foreground capitalize truncate">{threadUser?.email} · {threadUser?.type}</div>
                  </div>
                </div>
                <div ref={boxRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {messages.map((m) => {
                    const admin = m.senderRole === 'admin';
                    return (
                      <div key={m.id} className={`flex ${admin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${admin ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <div className="whitespace-pre-wrap break-words">{m.body}</div>
                          <div className={`text-[10px] mt-1 ${admin ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {admin ? 'You' : (threadUser?.name || 'Them')} · {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3">
                  <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                  <Button disabled={sending || !reply.trim()} onClick={send} className="self-end">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
