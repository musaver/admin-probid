'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  Menu,
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  KeyRound,
  ClipboardList,
  ClipboardCheck,
  UserCheck,
  Megaphone,
  RefreshCw,
  Activity,
  LogOut,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  // Daily work
  { name: 'Dashboard',   href: '/',            icon: LayoutDashboard },
  { name: 'Properties',  href: '/properties',  icon: Building2 },
  { name: 'Review',      href: '/review',      icon: ClipboardCheck },
  { name: 'Bidder Verify', href: '/bidder-verification', icon: UserCheck },
  // Communication
  { name: 'Bulletin',    href: '/bulletin',    icon: Megaphone },
  { name: 'Messaging',   href: '/messaging',   icon: MessageSquare },
  // People
  { name: 'Users',       href: '/users',       icon: Users },
  { name: 'Admin Users', href: '/admins',      icon: ShieldCheck },
  { name: 'Admin Roles', href: '/roles',       icon: KeyRound },
  // System & audit
  { name: 'Sync Status', href: '/sync-status', icon: RefreshCw },
  { name: 'Activity',    href: '/activity',    icon: Activity },
  { name: 'Admin Logs',  href: '/logs',        icon: ClipboardList },
  { name: 'Logout',      href: '/logout',      icon: LogOut },
];

function NavItems({ pathname, onNavigate, badges }: { pathname: string; onNavigate?: () => void; badges?: Record<string, number> }) {
  return (
    <nav className="flex-1 space-y-1 p-4">
      {navigation.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        const count = badges?.[item.href] ?? 0;
        return (
          <Button
            key={item.name}
            variant={isActive ? 'secondary' : 'ghost'}
            className={`w-full justify-start text-base ${isActive ? 'bg-primary/10 text-primary font-medium' : ''}`}
            asChild
          >
            <Link href={item.href} onClick={onNavigate} className="flex items-center w-full">
              <Icon className="mr-3 h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.name}</span>
              {count > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-semibold h-5 min-w-[20px] px-1.5">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAuthPage = pathname === '/login' || pathname === '/logout';

  const [reviewCount, setReviewCount] = useState(0);
  useEffect(() => {
    if (!session || isAuthPage) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/change-requests?status=pending');
        if (!res.ok) return;
        const data = await res.json();
        if (active) setReviewCount(Array.isArray(data.requests) ? data.requests.length : 0);
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 60000); // refresh the badge every minute
    return () => { active = false; clearInterval(t); };
  }, [session, isAuthPage, pathname]);

  const navBadges = { '/review': reviewCount };

  if (status === 'loading') return null;
  if (!session || isAuthPage) return <div>{children}</div>;

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Mobile header + sheet */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center p-4 bg-background border-b">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open sidebar</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="p-4">
              <h2 className="text-xl font-semibold">Admin Panel</h2>
            </div>
            <Separator />
            <NavItems pathname={pathname} onNavigate={() => setOpen(false)} badges={navBadges} />
          </SheetContent>
        </Sheet>
        <h1 className="ml-4 text-lg font-medium">Admin Panel</h1>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex-1 flex flex-col min-h-0 bg-background border-r">
          <div className="p-4 flex items-center">
            <h2 className="text-xl font-semibold">Admin Panel</h2>
          </div>
          <Separator />
          <NavItems pathname={pathname} badges={navBadges} />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        <main className="flex-1 pt-16 lg:pt-0">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
