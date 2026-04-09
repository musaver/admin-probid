'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Plus, Pencil, Trash2, ArrowUpDown, Users, Mail, Loader2, CheckCircle2, Search, ChevronUp, ChevronDown, FileSpreadsheet } from 'lucide-react';
import BulkUploadModal from '@/app/components/BulkUploadModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PropertyRow {
  property: {
    id: string;
    title: string;
    address: string | null;
    city: string | null;
    saleId: string;
    status: string;
    minBid: string | null;
    createdAt: string;
  };
  creator: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  linkedBiddersCount: number;
}

interface CountyUser {
  id: string;
  name: string | null;
  email: string;
}

interface LinkedBidder {
  id: string;
  status: string | null;
  linkedAt: string;
  bidder: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    bidderNumber: string | null;
  };
}

const PROPERTY_STATUSES = [
  'active', 'sold', 'withdrawn', 'on_list', 'sold_at_tax_sale',
  'redeemed', 'voided', 'cancelled', 'deed_in_progress', 'deed_issued', 'redeemed_check_issued',
] as const;

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

export default function PropertiesList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL or defaults
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [totalProperties, setTotalProperties] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [countyFilter, setCountyFilter] = useState(searchParams.get('countyId') || 'all');
  const [countyUsers, setCountyUsers] = useState<CountyUser[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: searchParams.get('sort') || 'createdAt',
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
    if (statusFilter !== 'all') params.set('status', statusFilter); else params.delete('status');
    if (countyFilter !== 'all') params.set('countyId', countyFilter); else params.delete('countyId');
    params.set('sort', sortConfig.key);
    params.set('direction', sortConfig.direction);
    params.set('page', currentPage.toString());
    params.set('pageSize', pageSize);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [search, statusFilter, countyFilter, sortConfig, currentPage, pageSize, pathname, router, searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrl();
    }, 300);
    return () => clearTimeout(timer);
  }, [updateUrl]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, countyFilter, pageSize]);

  // Inline status change
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const handleInlineStatusChange = async (row: PropertyRow, newStatus: string) => {
    if (newStatus === row.property.status) return;
    setUpdatingStatusId(row.property.id);
    try {
      const res = await fetch(`/api/properties/${row.property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setProperties(prev => prev.map(p =>
          p.property.id === row.property.id
            ? { ...p, property: { ...p.property, status: newStatus } }
            : p
        ));
      }
    } catch (error) {
      console.error('Error updating property status:', error);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Status change dialog (kept for reference, no longer triggered from list)
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  // Linked bidders dialog
  const [showBiddersDialog, setShowBiddersDialog] = useState(false);
  const [biddersProperty, setBiddersProperty] = useState<PropertyRow | null>(null);
  const [biddersLoading, setBiddersLoading] = useState(false);
  const [linkedBidders, setLinkedBidders] = useState<LinkedBidder[]>([]);

  // Send alert dialog
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertProperty, setAlertProperty] = useState<PropertyRow | null>(null);
  const [alertBidders, setAlertBidders] = useState<LinkedBidder[]>([]);
  const [alertBiddersLoading, setAlertBiddersLoading] = useState(false);
  const [alertSelectedIds, setAlertSelectedIds] = useState<string[]>([]);
  const [alertSubject, setAlertSubject] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSending, setAlertSending] = useState(false);
  const [alertResult, setAlertResult] = useState<{ success: boolean; sent: number; failed: any[] } | null>(null);

  // Bulk upload modal
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        sort: sortConfig.key,
        direction: sortConfig.direction,
        page: currentPage.toString(),
        pageSize: pageSize,
      });
      if (countyFilter !== 'all') params.set('countyId', countyFilter);
      const res = await fetch(`/api/properties?${params.toString()}`);
      const data = await res.json();
      setProperties(data.properties || []);
      setTotalProperties(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, countyFilter, sortConfig, currentPage, pageSize]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalProperties / parseInt(pageSize));

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />;
  };

  // Status modal
  const openStatusModal = (prop: PropertyRow) => {
    setSelectedProperty(prop);
    setNewStatus(prop.property.status);
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedProperty(null);
    setNewStatus('');
  };

  const handleStatusUpdate = async () => {
    if (!selectedProperty || !newStatus) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/properties/${selectedProperty.property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProperties(properties.map(p =>
          p.property.id === selectedProperty.property.id
            ? { ...updated, linkedBiddersCount: p.linkedBiddersCount }
            : p
        ));
        closeStatusModal();
      } else {
        alert('Failed to update property status');
      }
    } catch (error) {
      console.error('Error updating property status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      setProperties(properties.filter((p) => p.property.id !== id));
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  // Bidders dialog
  const openBiddersDialog = async (row: PropertyRow) => {
    setBiddersProperty(row);
    setShowBiddersDialog(true);
    setBiddersLoading(true);
    setLinkedBidders([]);
    try {
      const res = await fetch(`/api/properties/${row.property.id}/bidders`);
      const data = await res.json();
      setLinkedBidders(data);
    } catch (err) {
      console.error('Error fetching linked bidders:', err);
    } finally {
      setBiddersLoading(false);
    }
  };

  const closeBiddersDialog = () => {
    setShowBiddersDialog(false);
    setBiddersProperty(null);
  };

  // Alert dialog
  const openAlertDialog = async (row: PropertyRow) => {
    setAlertProperty(row);
    setShowAlertDialog(true);
    setAlertBiddersLoading(true);
    setAlertBidders([]);
    setAlertSelectedIds([]);
    setAlertSubject('');
    setAlertMessage('');
    setAlertResult(null);

    try {
      const res = await fetch(`/api/properties/${row.property.id}/bidders`);
      const data = await res.json();
      setAlertBidders(data);
      setAlertSelectedIds(data.map((b: LinkedBidder) => b.bidder.id));
    } catch (err) {
      console.error('Error fetching bidders for alert:', err);
    } finally {
      setAlertBiddersLoading(false);
    }
  };

  const closeAlertDialog = () => {
    setShowAlertDialog(false);
    setAlertProperty(null);
    setAlertResult(null);
  };

  const toggleAlertBidder = (bidderId: string) => {
    setAlertSelectedIds(prev =>
      prev.includes(bidderId) ? prev.filter(id => id !== bidderId) : [...prev, bidderId]
    );
  };

  const selectAllBidders = () => setAlertSelectedIds(alertBidders.map(b => b.bidder.id));
  const deselectAllBidders = () => setAlertSelectedIds([]);

  const handleSendAlert = async () => {
    if (!alertProperty || !alertSubject.trim() || !alertMessage.trim() || alertSelectedIds.length === 0) return;
    setAlertSending(true);
    setAlertResult(null);
    try {
      const res = await fetch(`/api/properties/${alertProperty.property.id}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: alertSubject,
          message: alertMessage,
          bidderIds: alertSelectedIds,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlertResult({ success: data.success, sent: data.sent, failed: data.failed || [] });
      } else {
        setAlertResult({ success: false, sent: 0, failed: [{ error: data.error || 'Failed to send' }] });
      }
    } catch (err) {
      setAlertResult({ success: false, sent: 0, failed: [{ error: 'Network error' }] });
    } finally {
      setAlertSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchProperties} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Import Properties
          </Button>
          <Button asChild>
            <Link href="/properties/add">
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, address, sale ID or creator..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PROPERTY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
            ))}
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
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('title')}>
                    <div className="flex items-center whitespace-nowrap">Title {getSortIcon('title')}</div>
                  </TableHead>
                  <TableHead className="py-2 px-3">Address</TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('status')}>
                    <div className="flex items-center whitespace-nowrap">Status {getSortIcon('status')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('minBid')}>
                    <div className="flex items-center whitespace-nowrap">Min Bid {getSortIcon('minBid')}</div>
                  </TableHead>
                  <TableHead className="py-2 px-3">County</TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('bidders')}>
                    <div className="flex items-center whitespace-nowrap">Bidders {getSortIcon('bidders')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground py-2 px-3" onClick={() => requestSort('createdAt')}>
                    <div className="flex items-center whitespace-nowrap">Created At {getSortIcon('createdAt')}</div>
                  </TableHead>
                  <TableHead className="text-right py-2 px-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.length > 0 ? (
                  properties.map((row) => (
                    <TableRow key={row.property.id}>
                      <TableCell className="font-medium max-w-[160px] truncate py-1.5 px-3">{row.property.title}</TableCell>
                      <TableCell className="max-w-[140px] truncate py-1.5 px-3">{row.property.address || '—'}</TableCell>
                      <TableCell className="py-1 px-3">
                        <Select
                          value={row.property.status}
                          onValueChange={(val) => handleInlineStatusChange(row, val)}
                          disabled={updatingStatusId === row.property.id}
                        >
                          <SelectTrigger className="h-7 text-xs w-[155px] px-2">
                            {updatingStatusId === row.property.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <SelectValue />}
                          </SelectTrigger>
                          <SelectContent>
                            {PROPERTY_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">{formatStatus(s)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-1.5 px-3">{row.property.minBid ? `$${Number(row.property.minBid).toLocaleString()}` : '—'}</TableCell>
                      <TableCell className="py-1.5 px-3">{row.creator?.name || row.creator?.email || '—'}</TableCell>
                      <TableCell className="py-1.5 px-3">
                        {row.linkedBiddersCount > 0 ? (
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-primary/20 transition-colors text-xs"
                            onClick={() => openBiddersDialog(row)}
                          >
                            <Users className="mr-1 h-3 w-3" />
                            {row.linkedBiddersCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-1.5 px-3">{new Date(row.property.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right py-1.5 px-3">
                        <TooltipProvider delayDuration={200}>
                        <div className="flex gap-1 justify-end whitespace-nowrap">
                          {row.linkedBiddersCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openAlertDialog(row)}>
                                  <Mail className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Send Alert</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                                <Link href={`/properties/edit/${row.property.id}`}>
                                  <Pencil className="h-3 w-3" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Property</TooltipContent>
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
                              <TooltipContent>Delete Property</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent className="sm:max-w-md">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Property</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this property? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(row.property.id)}>Delete</AlertDialogAction>
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No properties found
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
            Showing {Math.min((currentPage - 1) * parseInt(pageSize) + 1, totalProperties)} to {Math.min(currentPage * parseInt(pageSize), totalProperties)} of {totalProperties} properties
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

      {/* Change Status Dialog */}
      <Dialog open={showStatusModal} onOpenChange={(open) => { if (!open) closeStatusModal(); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Change Property Status</DialogTitle>
          </DialogHeader>
          {selectedProperty && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm"><strong>Property:</strong> {selectedProperty.property.title}</p>
                <p className="text-sm">
                  <strong>Current Status:</strong>{' '}
                  <Badge variant={statusVariant[selectedProperty.property.status] || 'secondary'}>
                    {formatStatus(selectedProperty.property.status)}
                  </Badge>
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Status:</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeStatusModal} disabled={updating}>Cancel</Button>
            <Button onClick={handleStatusUpdate} disabled={updating || !selectedProperty || newStatus === selectedProperty?.property.status}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {updating ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Linked Bidders Dialog */}
      <Dialog open={showBiddersDialog} onOpenChange={(open) => { if (!open) closeBiddersDialog(); }}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Linked Bidders — {biddersProperty?.property.title}</DialogTitle>
          </DialogHeader>
          {biddersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading bidders...</span>
            </div>
          ) : linkedBidders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Bidder #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedBidders.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.bidder.name || '—'}</TableCell>
                    <TableCell>{b.bidder.email}</TableCell>
                    <TableCell>{b.bidder.bidderNumber || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={linkStatusVariant[b.status || ''] || 'outline'}>
                        {formatStatus(b.status || 'unknown')}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(b.linkedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No linked bidders for this property.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeBiddersDialog}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={(open) => { if (!open) closeAlertDialog(); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Alert — {alertProperty?.property.title}</DialogTitle>
          </DialogHeader>

          {alertResult ? (
            <div className="space-y-4 py-4">
              {alertResult.success ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Alert sent successfully to {alertResult.sent} recipient{alertResult.sent !== 1 ? 's' : ''}.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    {alertResult.sent > 0
                      ? `Sent to ${alertResult.sent}, but ${alertResult.failed.length} failed.`
                      : `Failed to send alerts. ${alertResult.failed[0]?.error || ''}`}
                  </AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={closeAlertDialog}>Close</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {alertBiddersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading recipients...</span>
                </div>
              ) : alertBidders.length > 0 ? (
                <>
                  <div>
                    <Label className="text-sm font-medium">Recipients</Label>
                    <div className="flex gap-2 mt-1 mb-2">
                      <Button type="button" variant="ghost" size="sm" onClick={selectAllBidders}>Select All</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={deselectAllBidders}>Deselect All</Button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                      {alertBidders.map((b) => (
                        <div key={b.bidder.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`alert-bidder-${b.bidder.id}`}
                            checked={alertSelectedIds.includes(b.bidder.id)}
                            onCheckedChange={() => toggleAlertBidder(b.bidder.id)}
                          />
                          <label htmlFor={`alert-bidder-${b.bidder.id}`} className="text-sm cursor-pointer flex-1">
                            {b.bidder.name || 'Unknown'} <span className="text-muted-foreground">({b.bidder.email})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{alertSelectedIds.length} of {alertBidders.length} selected</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alert-subject">Subject</Label>
                    <Input id="alert-subject" value={alertSubject} onChange={e => setAlertSubject(e.target.value)} placeholder="Alert subject..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alert-message">Message</Label>
                    <Textarea id="alert-message" value={alertMessage} onChange={e => setAlertMessage(e.target.value)} rows={4} placeholder="Type your message to bidders..." />
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-4">No linked bidders to send alerts to.</p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={closeAlertDialog} disabled={alertSending}>Cancel</Button>
                <Button
                  onClick={handleSendAlert}
                  disabled={alertSending || alertSelectedIds.length === 0 || !alertSubject.trim() || !alertMessage.trim()}
                >
                  {alertSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {alertSending ? 'Sending...' : `Send to ${alertSelectedIds.length} Bidder${alertSelectedIds.length !== 1 ? 's' : ''}`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onSuccess={fetchProperties}
      />
    </div>
  );
}
