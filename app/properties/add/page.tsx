'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';

const PROPERTY_STATUSES = [
  'active', 'sold', 'withdrawn', 'on_list', 'sold_at_tax_sale',
  'redeemed', 'voided', 'cancelled', 'deed_in_progress', 'deed_issued', 'redeemed_check_issued',
] as const;

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface CountyUser {
  id: string;
  name: string | null;
  email: string;
}

interface BidderResult {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  bidderNumber: string | null;
}

export default function AddProperty() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Property fields
  const [saleId, setSaleId] = useState('');
  const [parcelId, setParcelId] = useState('');
  const [owners, setOwners] = useState<string[]>(['']);
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [description, setDescription] = useState('');

  // Auction fields
  const [minBid, setMinBid] = useState('');
  const [winningBid, setWinningBid] = useState('');
  const [status, setStatus] = useState('active');
  const [auctionStart, setAuctionStart] = useState('');
  const [auctionEnd, setAuctionEnd] = useState('');

  // Assignment
  const [countyUsers, setCountyUsers] = useState<CountyUser[]>([]);
  const [loadingCounties, setLoadingCounties] = useState(true);
  const [createdBy, setCreatedBy] = useState('');

  // Bidder search
  const [bidderQuery, setBidderQuery] = useState('');
  const [bidderResults, setBidderResults] = useState<BidderResult[]>([]);
  const [loadingBidders, setLoadingBidders] = useState(false);
  const [selectedBidders, setSelectedBidders] = useState<BidderResult[]>([]);
  const bidderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchCountyUsers = async () => {
      try {
        const res = await fetch('/api/users?type=county&pageSize=all');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? 'Failed to fetch users');
        const list = Array.isArray(data?.users) ? data.users : [];
        setCountyUsers(
          list.map((u: { id: string; name: string | null; email: string }) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          }))
        );
      } catch (err) {
        console.error('Error fetching county users:', err);
      } finally {
        setLoadingCounties(false);
      }
    };
    fetchCountyUsers();
  }, []);

  const searchBidders = useCallback((q: string) => {
    if (bidderTimer.current) clearTimeout(bidderTimer.current);
    if (!q.trim()) {
      setBidderResults([]);
      setLoadingBidders(false);
      return;
    }
    setLoadingBidders(true);
    bidderTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/bidders?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setBidderResults(Array.isArray(data) ? data : []);
        } else {
          setBidderResults([]);
        }
      } catch {
        setBidderResults([]);
      } finally {
        setLoadingBidders(false);
      }
    }, 350);
  }, []);

  useEffect(() => {
    searchBidders(bidderQuery);
  }, [bidderQuery, searchBidders]);

  const addOwner = () => setOwners([...owners, '']);
  const removeOwner = (i: number) => setOwners(owners.filter((_, idx) => idx !== i));
  const updateOwner = (i: number, val: string) => {
    const next = [...owners];
    next[i] = val;
    setOwners(next);
  };

  const selectBidder = (b: BidderResult) => {
    if (!selectedBidders.find(s => s.id === b.id)) {
      setSelectedBidders([...selectedBidders, b]);
    }
    setBidderQuery('');
    setBidderResults([]);
  };

  const removeBidder = (id: string) => {
    setSelectedBidders(selectedBidders.filter(b => b.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdBy) {
      setError('Please select a county user.');
      return;
    }
    if (!saleId.trim()) {
      setError('Sale ID is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const cleanMinBid = minBid.replace(/[^0-9.]/g, '') || null;
      const cleanWinningBid = winningBid.replace(/[^0-9.]/g, '') || null;

      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId,
          parcelId: parcelId || null,
          title: `Property ${saleId}`,
          description: description || null,
          address: address || null,
          city: city || null,
          zipCode: zipCode || null,
          owners: owners.filter(o => o.trim()),
          auctionStart: auctionStart || null,
          auctionEnd: auctionEnd || null,
          minBid: cleanMinBid,
          winningBid: cleanWinningBid,
          status,
          createdBy,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create property');
      }

      const newProp = await res.json();
      const propertyId = newProp.id;

      // Link selected bidders
      for (const bidder of selectedBidders) {
        try {
          await fetch(`/api/properties/${propertyId}/linked-bidders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bidderId: bidder.id }),
          });
        } catch (err) {
          console.error('Failed to link bidder:', err);
        }
      }

      router.push('/properties');
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Property</h1>
        <p className="text-muted-foreground mt-1">Create a new property listing</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Section 1: Property & Ownership Info */}
          <Card>
            <CardHeader>
              <CardTitle>Property & Ownership Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="saleId">Sale ID <span className="text-destructive">*</span></Label>
                  <Input id="saleId" value={saleId} onChange={e => setSaleId(e.target.value)} placeholder="e.g. 2023-001" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parcelId">Parcel Number</Label>
                  <Input id="parcelId" value={parcelId} onChange={e => setParcelId(e.target.value)} placeholder="123-456-789" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Owner Name(s) <span className="text-xs text-muted-foreground font-normal">(Last name first)</span></Label>
                {owners.map((owner, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={owner}
                      onChange={e => updateOwner(i, e.target.value)}
                      placeholder="Doe, John"
                      className="flex-1"
                    />
                    {owners.length > 1 && (
                      <Button type="button" variant="outline" size="icon" onClick={() => removeOwner(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="link" size="sm" className="px-0" onClick={addOwner}>
                  <Plus className="h-3 w-3 mr-1" /> Add another owner
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => setShowMoreFields(!showMoreFields)}
              >
                {showMoreFields ? (
                  <>Less Property Details <ChevronUp className="ml-1 h-4 w-4" /></>
                ) : (
                  <>More Property Details (Address, City, ZIP) <ChevronDown className="ml-1 h-4 w-4" /></>
                )}
              </Button>

              {showMoreFields && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main Street" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={city} onChange={e => setCity(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input id="zipCode" value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="12345" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Auction Info */}
          <Card>
            <CardHeader>
              <CardTitle>Auction Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minBid">Minimum Bid ($)</Label>
                  <Input id="minBid" value={minBid} onChange={e => setMinBid(e.target.value)} placeholder="50000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="winningBid">Winning Bid ($)</Label>
                  <Input id="winningBid" value={winningBid} onChange={e => setWinningBid(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Property Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="auctionStart">Auction start date</Label>
                  <Input id="auctionStart" type="date" value={auctionStart} onChange={e => setAuctionStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auctionEnd">Auction end date</Label>
                  <Input id="auctionEnd" type="date" value={auctionEnd} onChange={e => setAuctionEnd(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>County User <span className="text-destructive">*</span></Label>
                {loadingCounties ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading counties...
                  </div>
                ) : countyUsers.length > 0 ? (
                  <Select value={createdBy} onValueChange={setCreatedBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select county user (creator)" />
                    </SelectTrigger>
                    <SelectContent>
                      {countyUsers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name || c.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No county users found. Create one first.</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Assign Bidders</Label>
                <div className="relative">
                  <Input
                    value={bidderQuery}
                    onChange={e => setBidderQuery(e.target.value)}
                    placeholder="Search by name, email, phone, or bidder number..."
                    autoComplete="off"
                  />
                  {loadingBidders && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {bidderQuery.trim() && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {bidderResults
                        .filter(b => !selectedBidders.find(s => s.id === b.id))
                        .map(b => (
                          <button
                            key={b.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm"
                            onClick={() => selectBidder(b)}
                          >
                            <div className="font-medium">{b.name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">
                              {b.email}{b.phone ? ` \u2022 ${b.phone}` : ''}{b.bidderNumber ? ` \u2022 #${b.bidderNumber}` : ''}
                            </div>
                          </button>
                        ))}
                      {bidderResults.filter(b => !selectedBidders.find(s => s.id === b.id)).length === 0 && !loadingBidders && (
                        <div className="px-3 py-2 text-sm text-muted-foreground text-center">No bidders found</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedBidders.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedBidders.map(b => (
                      <Badge key={b.id} variant="secondary" className="gap-1 py-1 px-2">
                        {b.name || b.email}
                        {b.bidderNumber && <span className="text-muted-foreground">#{b.bidderNumber}</span>}
                        <button type="button" onClick={() => removeBidder(b.id)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Adding Property...' : 'Add Property'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/properties')} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
