'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

const PROPERTY_STATUSES = [
  'active', 'sold', 'withdrawn', 'on_list', 'sold_at_tax_sale',
  'redeemed', 'voided', 'cancelled', 'deed_in_progress', 'deed_issued', 'redeemed_check_issued',
] as const;

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function EditProperty() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [parcelId, setParcelId] = useState('');
  const [saleId, setSaleId] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [squareFeet, setSquareFeet] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [lotSize, setLotSize] = useState('');
  const [minBid, setMinBid] = useState('');
  const [status, setStatus] = useState('active');

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const response = await fetch(`/api/properties/${propertyId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch property');
        }
        const data = await response.json();
        setTitle(data.title || '');
        setDescription(data.description || '');
        setAddress(data.address || '');
        setParcelId(data.parcelId || '');
        setSaleId(data.saleId || '');
        setCity(data.city || '');
        setZipCode(data.zipCode || '');
        setSquareFeet(data.squareFeet ? String(data.squareFeet) : '');
        setYearBuilt(data.yearBuilt ? String(data.yearBuilt) : '');
        setLotSize(data.lotSize || '');
        setMinBid(data.minBid || '');
        setStatus(data.status || 'active');
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load property');
        setLoading(false);
      }
    };
    fetchProperty();
  }, [propertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          address: address || null,
          parcelId: parcelId || null,
          saleId,
          city: city || null,
          zipCode: zipCode || null,
          squareFeet: squareFeet ? Number(squareFeet) : null,
          yearBuilt: yearBuilt ? Number(yearBuilt) : null,
          lotSize: lotSize || null,
          minBid: minBid || null,
          status,
        }),
      });

      if (!response.ok) throw new Error('Failed to update property');
      router.push('/properties');
    } catch (err) {
      setError('Failed to save changes. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardContent className="space-y-6 pt-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !title) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/properties')}>Back to Properties</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Property</h1>
        <p className="text-muted-foreground mt-1">Update property details</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Property title" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Property description" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parcelId">Parcel ID</Label>
                <Input id="parcelId" value={parcelId} onChange={(e) => setParcelId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saleId">Sale ID <span className="text-destructive">*</span></Label>
                <Input id="saleId" value={saleId} onChange={(e) => setSaleId(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="squareFeet">Square Feet</Label>
                <Input id="squareFeet" type="number" value={squareFeet} onChange={(e) => setSquareFeet(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearBuilt">Year Built</Label>
                <Input id="yearBuilt" type="number" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lotSize">Lot Size</Label>
                <Input id="lotSize" value={lotSize} onChange={(e) => setLotSize(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minBid">Minimum Bid ($)</Label>
                <Input id="minBid" type="number" step="0.01" value={minBid} onChange={(e) => setMinBid(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/properties')} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
