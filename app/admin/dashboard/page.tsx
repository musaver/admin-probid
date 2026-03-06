'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const router = useRouter();

  const cards = [
    { title: 'Users', count: '2', link: '/admin/users' },
    { title: 'Courses', count: '2', link: '/admin/courses' },
    { title: 'Orders', count: '1', link: '/admin/orders' },
    { title: 'Admin Users', count: '1', link: '/admin/admins' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(card.link)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{card.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
