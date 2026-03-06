'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
import { RefreshCw, Plus, Pencil, Trash2, ArrowUpDown, Users, Mail, Loader2, CheckCircle2 } from 'lucide-react';

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
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Status change dialog
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

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/properties');
      const data = await res.json();
      setProperties(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

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
          <Button asChild>
            <Link href="/properties/add">
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Link>
          </Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Sale ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Min Bid</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Bidders</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.length > 0 ? (
                  properties.map((row) => (
                    <TableRow key={row.property.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{row.property.title}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.property.address || '—'}</TableCell>
                      <TableCell>{row.property.city || '—'}</TableCell>
                      <TableCell>{row.property.saleId}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[row.property.status] || 'secondary'}>
                          {formatStatus(row.property.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.property.minBid ? `$${Number(row.property.minBid).toLocaleString()}` : '—'}</TableCell>
                      <TableCell>{row.creator?.name || row.creator?.email || '—'}</TableCell>
                      <TableCell>
                        {row.linkedBiddersCount > 0 ? (
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-primary/20 transition-colors"
                            onClick={() => openBiddersDialog(row)}
                          >
                            <Users className="mr-1 h-3 w-3" />
                            {row.linkedBiddersCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">0</span>
                        )}
                      </TableCell>
                      <TableCell>{new Date(row.property.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          {row.linkedBiddersCount > 0 && (
                            <Button variant="outline" size="sm" onClick={() => openAlertDialog(row)}>
                              <Mail className="mr-1 h-3 w-3" />
                              Alert
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openStatusModal(row)}>
                            <ArrowUpDown className="mr-1 h-3 w-3" />
                            Status
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/properties/edit/${row.property.id}`}>
                              <Pencil className="mr-1 h-3 w-3" />
                              Edit
                            </Link>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="mr-1 h-3 w-3" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
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
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No properties found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Change Status Dialog */}
      <Dialog open={showStatusModal} onOpenChange={(open) => { if (!open) closeStatusModal(); }}>
        <DialogContent>
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
    </div>
  );
}
