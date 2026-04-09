'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Plus, Pencil, Trash2, Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

interface AdminRow {
  admin: {
    id: string;
    email: string;
    name: string | null;
    roleId: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
  role: {
    id: string;
    name: string;
    permissions: string;
  } | null;
}

interface Role {
  id: string;
  name: string;
}

export default function AdminsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('roleId') || 'all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: searchParams.get('sort') || 'createdAt',
    direction: (searchParams.get('direction') as 'asc' | 'desc') || 'desc',
  });
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') || '100');

  // Fetch roles for filter dropdown
  useEffect(() => {
    fetch('/api/roles')
      .then(r => r.json())
      .then(data => setRoles(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const updateUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set('search', search); else params.delete('search');
    if (roleFilter !== 'all') params.set('roleId', roleFilter); else params.delete('roleId');
    params.set('sort', sortConfig.key);
    params.set('direction', sortConfig.direction);
    params.set('page', currentPage.toString());
    params.set('pageSize', pageSize);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [search, roleFilter, sortConfig, currentPage, pageSize, pathname, router, searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => { updateUrl(); }, 300);
    return () => clearTimeout(timer);
  }, [updateUrl]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, pageSize]);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        sort: sortConfig.key,
        direction: sortConfig.direction,
        page: currentPage.toString(),
        pageSize,
      });
      if (roleFilter !== 'all') params.set('roleId', roleFilter);
      const res = await fetch(`/api/admins?${params.toString()}`);
      const data = await res.json();
      setAdmins(data.admins || []);
      setTotalAdmins(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, sortConfig, currentPage, pageSize]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalAdmins / parseInt(pageSize));

  const requestSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />;
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/admins/${id}`, { method: 'DELETE' });
      setAdmins(prev => prev.filter((a) => a.admin.id !== id));
      setTotalAdmins(prev => prev - 1);
    } catch (error) {
      console.error('Error deleting admin user:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Admin Users</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAdmins} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/admins/add">
              <Plus className="mr-2 h-4 w-4" />
              Add New Admin
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Show:</span>
          <Select value={pageSize} onValueChange={setPageSize}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="500">500</SelectItem>
              <SelectItem value="all">View All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('name')}>
                    <div className="flex items-center">Name {getSortIcon('name')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('email')}>
                    <div className="flex items-center">Email {getSortIcon('email')}</div>
                  </TableHead>
                  <TableHead className="py-2 px-3">Role</TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('createdAt')}>
                    <div className="flex items-center">Created {getSortIcon('createdAt')}</div>
                  </TableHead>
                  <TableHead className="text-right py-2 px-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length > 0 ? (
                  admins.map((row) => (
                    <TableRow key={row.admin.id}>
                      <TableCell className="font-medium py-1.5 px-3">{row.admin.name || '—'}</TableCell>
                      <TableCell className="py-1.5 px-3">{row.admin.email}</TableCell>
                      <TableCell className="py-1.5 px-3">{row.role?.name || row.admin.role || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap py-1.5 px-3">{new Date(row.admin.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right py-1.5 px-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                            <Link href={`/admins/edit/${row.admin.id}`}>
                              <Pencil className="h-3 w-3" />
                            </Link>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className="h-7 px-2 text-xs">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="sm:max-w-md">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Admin User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this admin user? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(row.admin.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No admin users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * parseInt(pageSize) + 1, totalAdmins)} to {Math.min(currentPage * parseInt(pageSize), totalAdmins)} of {totalAdmins} admins
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  className="w-9"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              )).filter((_, i) => {
                if (totalPages <= 7) return true;
                return i === 0 || i === totalPages - 1 || Math.abs(i + 1 - currentPage) <= 1;
              }).map((item, i, arr) => {
                const prev = arr[i - 1];
                if (prev && (item as any).key - (prev as any).key > 1) {
                  return <React.Fragment key={`ellipsis-${i}`}><span className="px-1 text-muted-foreground">...</span>{item}</React.Fragment>;
                }
                return item;
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
