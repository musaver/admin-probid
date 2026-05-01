'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Plus, Pencil, Trash2, UserCog, Building2, Loader2, Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface User {
  id: string;
  name: string | null;
  email: string;
  type: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  bidderNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserProperty {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  status: string;
  minBid: string | null;
  saleId: string;
  createdAt: string;
}

interface BidderProperty {
  property: UserProperty;
  linkStatus: string | null;
  linkedAt: string;
}

interface CountyUser {
  id: string;
  name: string | null;
  email: string;
}

function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default', sold: 'secondary', withdrawn: 'destructive', on_list: 'outline',
  sold_at_tax_sale: 'secondary', redeemed: 'outline', voided: 'destructive',
  cancelled: 'destructive', deed_in_progress: 'outline', deed_issued: 'secondary',
  redeemed_check_issued: 'outline',
};

const linkStatusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  invited: 'outline', interested: 'secondary', bidding: 'default', won: 'default',
};

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function UsersList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL or defaults
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [countyFilter, setCountyFilter] = useState(searchParams.get('countyId') || 'all');
  const [countyUsers, setCountyUsers] = useState<CountyUser[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'asc' | 'desc' }>({
    key: (searchParams.get('sort') as keyof User) || 'createdAt',
    direction: (searchParams.get('direction') as 'asc' | 'desc') || 'desc',
  });
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(searchParams.get('pageSize') || '100');

  // Fetch county users for filter dropdown
  useEffect(() => {
    fetch('/api/users?type=county&pageSize=all')
      .then(r => r.json())
      .then(data => setCountyUsers(data.users || []))
      .catch(() => {});
  }, []);

  // Update URL whenever filter/sort/page changes
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set('search', search); else params.delete('search');
    if (typeFilter !== 'all') params.set('type', typeFilter); else params.delete('type');
    if (countyFilter !== 'all') params.set('countyId', countyFilter); else params.delete('countyId');
    params.set('sort', sortConfig.key);
    params.set('direction', sortConfig.direction);
    params.set('page', currentPage.toString());
    params.set('pageSize', pageSize);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [search, typeFilter, countyFilter, sortConfig, currentPage, pageSize, pathname, router, searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrl();
    }, 300);
    return () => clearTimeout(timer);
  }, [updateUrl]);

  // Properties dialog state
  const [showPropsDialog, setShowPropsDialog] = useState(false);
  const [propsUser, setPropsUser] = useState<User | null>(null);
  const [propsLoading, setPropsLoading] = useState(false);
  const [propsUserType, setPropsUserType] = useState<string>('');
  const [countyProperties, setCountyProperties] = useState<UserProperty[]>([]);
  const [bidderProperties, setBidderProperties] = useState<BidderProperty[]>([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        type: typeFilter,
        sort: sortConfig.key,
        direction: sortConfig.direction,
        page: currentPage.toString(),
        pageSize: pageSize,
      });
      if (countyFilter !== 'all') params.set('countyId', countyFilter);
      const res = await fetch(`/api/users?${params.toString()}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotalUsers(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, countyFilter, sortConfig, currentPage, pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, countyFilter, pageSize]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalUsers / parseInt(pageSize));

  const requestSort = (key: keyof User) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof User) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />;
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      setUsers(users.filter((user) => user.id !== id));
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const openChangeTypeModal = (user: User) => {
    setSelectedUser(user);
    setShowTypeModal(true);
  };

  const handleChangeType = async (newType: string) => {
    if (!selectedUser) return;
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType }),
      });
      if (response.ok) {
        setUsers(users.map((user) =>
          user.id === selectedUser.id ? { ...user, type: newType } : user
        ));
        setShowTypeModal(false);
        setSelectedUser(null);
      } else {
        alert('Failed to update user type');
      }
    } catch (error) {
      console.error('Error updating user type:', error);
      alert('Error updating user type');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openPropertiesDialog = async (u: User) => {
    setPropsUser(u);
    setShowPropsDialog(true);
    setPropsLoading(true);
    setCountyProperties([]);
    setBidderProperties([]);
    setPropsUserType('');

    try {
      const res = await fetch(`/api/users/${u.id}/properties`);
      const data = await res.json();
      setPropsUserType(data.userType);
      if (data.userType === 'county') {
        setCountyProperties(data.properties);
      } else {
        setBidderProperties(data.properties);
      }
    } catch (err) {
      console.error('Error fetching user properties:', err);
    } finally {
      setPropsLoading(false);
    }
  };

  const closePropsDialog = () => {
    setShowPropsDialog(false);
    setPropsUser(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/users/add">
              <Plus className="mr-2 h-4 w-4" />
              Add New User
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or phone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="User Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="bidder">Bidder</SelectItem>
            <SelectItem value="county">County</SelectItem>
          </SelectContent>
        </Select>
        <Select value={countyFilter} onValueChange={setCountyFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="All Counties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Counties</SelectItem>
            {countyUsers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name || c.email}</SelectItem>
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
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('type')}>
                    <div className="flex items-center">Type {getSortIcon('type')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('bidderNumber')}>
                    <div className="flex items-center">Bidder # {getSortIcon('bidderNumber')}</div>
                  </TableHead>
                  <TableHead className="py-2 px-3">Phone</TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('createdAt')}>
                    <div className="flex items-center">Created {getSortIcon('createdAt')}</div>
                  </TableHead>
                  <TableHead className="text-right py-2 px-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium py-1.5 px-3">{user.name || '—'}</TableCell>
                      <TableCell className="py-1.5 px-3">{user.email}</TableCell>
                      <TableCell className="py-1.5 px-3">
                        <Badge variant={user.type === 'county' ? 'default' : 'secondary'} className="text-xs">
                          {user.type || 'bidder'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 px-3 font-mono text-xs">{user.bidderNumber || '—'}</TableCell>
                      <TableCell className="py-1.5 px-3">{formatPhone(user.phone)}</TableCell>
                      <TableCell className="whitespace-nowrap py-1.5 px-3">{new Date(user.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right py-1.5 px-3">
                        <TooltipProvider delayDuration={200}>
                        <div className="flex gap-1 justify-end whitespace-nowrap">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openPropertiesDialog(user)}>
                                <Building2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Properties</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                                <Link href={`/users/edit/${user.id}`}>
                                  <Pencil className="h-3 w-3" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit User</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openChangeTypeModal(user)}>
                                <UserCog className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Change Type</TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" className="h-7 px-2 text-xs">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Delete User</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent className="sm:max-w-md">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this user? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(user.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No users found
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
            Showing {Math.min((currentPage - 1) * parseInt(pageSize) + 1, totalUsers)} to {Math.min(currentPage * parseInt(pageSize), totalUsers)} of {totalUsers} users
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
                // Show first, last, and pages around current
                if (totalPages <= 7) return true;
                return i === 0 || i === totalPages - 1 || Math.abs(i + 1 - currentPage) <= 1;
              }).map((item, i, arr) => {
                // Add ellipses
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

      {/* Change Type Dialog */}
      <Dialog open={showTypeModal} onOpenChange={(open) => { if (!open) { setShowTypeModal(false); setSelectedUser(null); } }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Change User Type</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">User:</strong> {selectedUser.name} ({selectedUser.email})
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Current Type:</strong>{' '}
                  <Badge variant={selectedUser.type === 'county' ? 'default' : 'secondary'}>
                    {selectedUser.type || 'bidder'}
                  </Badge>
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Select New Type:</p>
                <Button
                  variant={selectedUser.type === 'bidder' || !selectedUser.type ? 'secondary' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleChangeType('bidder')}
                  disabled={updatingStatus || selectedUser.type === 'bidder' || !selectedUser.type}
                >
                  Bidder {(selectedUser.type === 'bidder' || !selectedUser.type) && '(Current)'}
                </Button>
                <Button
                  variant={selectedUser.type === 'county' ? 'secondary' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleChangeType('county')}
                  disabled={updatingStatus || selectedUser.type === 'county'}
                >
                  County {selectedUser.type === 'county' && '(Current)'}
                </Button>
              </div>
              {updatingStatus && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating user type...
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTypeModal(false); setSelectedUser(null); }} disabled={updatingStatus}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Properties Dialog */}
      <Dialog open={showPropsDialog} onOpenChange={(open) => { if (!open) closePropsDialog(); }}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Properties — {propsUser?.name || propsUser?.email}
              {propsUserType && (
                <Badge variant={propsUserType === 'county' ? 'default' : 'secondary'} className="ml-2 align-middle">
                  {propsUserType}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {propsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading properties...</span>
            </div>
          ) : propsUserType === 'county' ? (
            countyProperties.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Min Bid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countyProperties.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{p.address || '—'}</TableCell>
                      <TableCell>{p.city || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[p.status] || 'secondary'}>
                          {formatStatus(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.minBid ? `$${Number(p.minBid).toLocaleString()}` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No properties created by this county user.</p>
            )
          ) : (
            bidderProperties.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Property Status</TableHead>
                    <TableHead>Link Status</TableHead>
                    <TableHead>Min Bid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bidderProperties.map((row, idx) => (
                    <TableRow key={row.property.id + '-' + idx}>
                      <TableCell className="font-medium">{row.property.title}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.property.address || '—'}</TableCell>
                      <TableCell>{row.property.city || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[row.property.status] || 'secondary'}>
                          {formatStatus(row.property.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={linkStatusVariant[row.linkStatus || ''] || 'outline'}>
                          {formatStatus(row.linkStatus || 'unknown')}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.property.minBid ? `$${Number(row.property.minBid).toLocaleString()}` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No linked properties for this bidder.</p>
            )
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closePropsDialog}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
