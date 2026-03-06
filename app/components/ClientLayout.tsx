'use client';
import React, { useState } from 'react';
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
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  { name: 'Dashboard',   href: '/',            icon: LayoutDashboard },
  { name: 'Properties',  href: '/properties',  icon: Building2 },
  { name: 'Users',       href: '/users',       icon: Users },
  { name: 'Admin Users', href: '/admins',      icon: ShieldCheck },
  { name: 'Admin Roles', href: '/roles',       icon: KeyRound },
  { name: 'Admin Logs',  href: '/logs',        icon: ClipboardList },
  { name: 'Logout',      href: '/logout',      icon: LogOut },
];

function NavItems({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 p-4">
      {navigation.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Button
            key={item.name}
            variant={isActive ? 'secondary' : 'ghost'}
            className={`w-full justify-start text-base ${isActive ? 'bg-primary/10 text-primary font-medium' : ''}`}
            asChild
          >
            <Link href={item.href} onClick={onNavigate}>
              <Icon className="mr-3 h-4 w-4 shrink-0" />
              {item.name}
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
            <NavItems pathname={pathname} onNavigate={() => setOpen(false)} />
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
          <NavItems pathname={pathname} />
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
