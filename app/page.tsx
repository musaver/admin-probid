'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  Users,
  UserCog,
  KeyRound,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';

interface DashboardCard {
  title: string;
  description: string;
  link: string;
  icon: LucideIcon;
}

const cards: DashboardCard[] = [
  { title: 'Properties',  description: 'Manage auction properties',    link: '/properties', icon: Building2 },
  { title: 'Users',       description: 'Manage bidders and counties',  link: '/users',      icon: Users },
  { title: 'Admins',      description: 'Manage admin users',           link: '/admins',     icon: UserCog },
  { title: 'Roles',       description: 'Manage admin roles',           link: '/roles',      icon: KeyRound },
  { title: 'Logs',        description: 'View admin activity logs',     link: '/logs',       icon: ClipboardList },
];

export default function Dashboard() {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Probid Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              onClick={() => router.push(card.link)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome to Probid Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Manage the Probid property bidding platform from this dashboard. You can manage
            auction properties, oversee bidder and county accounts, and administer system settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
