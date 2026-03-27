'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import CryptoJS from 'crypto-js';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Building2, User, RefreshCw } from 'lucide-react';

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
  sharedKey: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  participant1: Participant | null;
  participant2: Participant | null;
  property: PropertyInfo | null;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: number;
  sender: { id: string; name: string | null; email: string } | null;
  text?: string;
}

function userName(p: Participant | null) {
  if (!p) return 'Unknown';
  return p.name || p.email;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConversationDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchConversation();
  }, [id]);

  const fetchConversation = async () => {
    setLoadingConv(true);
    try {
      const res = await fetch(`/api/messaging/conversations/${id}`);
      if (!res.ok) {
        setError('Conversation not found.');
        return;
      }
      const data: Conversation = await res.json();
      setConversation(data);
    } catch (err) {
      setError('Failed to load conversation.');
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    if (!conversation) return;
    fetchMessages();
  }, [conversation]);

  const fetchMessages = async () => {
    if (!conversation) return;
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/messaging/messages?conversationId=${conversation.id}`);
      if (!res.ok) return;
      const data: Message[] = await res.json();

      const decrypted = data.map((msg) => {
        try {
          if (conversation.sharedKey) {
            const bytes = CryptoJS.AES.decrypt(msg.content, conversation.sharedKey!);
            const text = bytes.toString(CryptoJS.enc.Utf8);
            return { ...msg, text: text || '[Unable to decrypt]' };
          }
          return { ...msg, text: msg.content };
        } catch {
          return { ...msg, text: '[Encrypted message]' };
        }
      });

      setMessages(decrypted);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMsgs(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (loadingConv) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-16 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className={`h-12 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2 ml-auto'}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/messaging">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Messaging
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {error || 'Conversation not found.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const p1 = conversation.participant1;
  const p2 = conversation.participant2;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/messaging">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">
            {userName(p1)}
            <span className="text-muted-foreground font-normal mx-2">↔</span>
            {userName(p2)}
          </h1>
          {conversation.property && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {conversation.property.title || conversation.property.address || `Sale #${conversation.property.saleId}`}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>Sale #{conversation.property.saleId}</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchMessages} disabled={loadingMsgs}>
          <RefreshCw className={`h-4 w-4 ${loadingMsgs ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Participants info */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap gap-4">
          {[p1, p2].map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium">{p?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{p?.email}</p>
              </div>
              <Badge variant={i === 0 ? 'default' : 'secondary'} className="text-xs">
                {i === 0 ? 'Participant 1' : 'Participant 2'}
              </Badge>
            </div>
          ))}
          <div className="ml-auto text-xs text-muted-foreground self-center">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardContent className="p-0">
          <div className="h-[60vh] overflow-y-auto p-4 space-y-3">
            {loadingMsgs && messages.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className={`h-12 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2 ml-auto'}`} />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No messages in this conversation.
              </div>
            ) : (
              messages.map((msg) => {
                const isP1 = msg.senderId === conversation.participant1Id;
                const senderName = msg.sender?.name || msg.sender?.email || (isP1 ? userName(p1) : userName(p2));
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-1 ${isP1 ? 'items-start' : 'items-end'}`}
                  >
                    <span className="text-[10px] text-muted-foreground px-1">{senderName}</span>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isP1
                          ? 'bg-muted text-foreground rounded-tl-sm'
                          : 'bg-primary text-primary-foreground rounded-tr-sm'
                      }`}
                    >
                      <p className="leading-snug">{msg.text || msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isP1 ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Read-only notice */}
          <div className="border-t px-4 py-3 bg-muted/30 text-center text-xs text-muted-foreground">
            Read-only view — Admin cannot send messages
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
