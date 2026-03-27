'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, MessageSquare, ChevronDown, ChevronUp, RefreshCw, Search, User } from 'lucide-react';

interface Participant {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface PropertyInfo {
  id: string;
  title: string | null;
  address: string | null;
  saleId: string;
}

interface Conversation {
  id: string;
  participant1Id: string;
  participant2Id: string;
  propertyId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  participant1: Participant | null;
  participant2: Participant | null;
  messageCount: number;
  property: PropertyInfo | null;
}

interface PropertyGroup {
  property: PropertyInfo | null;
  conversations: Conversation[];
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function userName(p: Participant | null) {
  if (!p) return 'Unknown';
  return p.name || p.email;
}

export default function MessagingPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messaging/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const p1 = userName(c.participant1).toLowerCase();
      const p2 = userName(c.participant2).toLowerCase();
      const prop = (c.property?.title || c.property?.address || c.property?.saleId || '').toLowerCase();
      return p1.includes(q) || p2.includes(q) || prop.includes(q);
    });
  }, [conversations, search]);

  const grouped = useMemo<PropertyGroup[]>(() => {
    const groups: Record<string, PropertyGroup> = {};
    for (const conv of filtered) {
      const propId = conv.property?.id || 'unknown';
      if (!groups[propId]) {
        groups[propId] = { property: conv.property, conversations: [] };
      }
      groups[propId].conversations.push(conv);
    }
    return Object.values(groups);
  }, [filtered]);

  const toggleGroup = (propId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [propId]: !prev[propId] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Messaging</h1>
        <Button variant="outline" onClick={fetchConversations} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by participant name, email or property..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">No conversations found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {grouped.map((group) => {
              const propId = group.property?.id || 'unknown';
              const isCollapsed = collapsedGroups[propId];
              return (
                <div key={propId} className="border-b last:border-b-0">
                  {/* Property group header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
                    onClick={() => toggleGroup(propId)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {group.property?.title || group.property?.address || 'Unknown Property'}
                        </p>
                        {group.property?.saleId && (
                          <p className="text-xs text-muted-foreground">Sale #{group.property.saleId}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="secondary" className="text-xs">
                        {group.conversations.length} chat{group.conversations.length !== 1 ? 's' : ''}
                      </Badge>
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Conversation rows */}
                  {!isCollapsed && group.conversations.map((conv) => (
                    <Link
                      key={conv.id}
                      href={`/messaging/${conv.id}`}
                      className="flex items-center gap-3 px-4 py-3 pl-10 border-t hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {userName(conv.participant1)}
                          <span className="text-muted-foreground font-normal mx-1">↔</span>
                          {userName(conv.participant2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                          {conv.lastMessageAt && (
                            <span className="ml-2">· {formatTime(conv.lastMessageAt)}</span>
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
