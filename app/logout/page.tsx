'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const logout = async () => {
      await signOut({ redirect: false });
      router.push('/login');
    };
    logout();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <Skeleton className="h-4 w-32" />
      <p className="text-muted-foreground">Logging out...</p>
    </div>
  );
}
