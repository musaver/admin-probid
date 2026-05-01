'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface CountyUser {
  id: string;
  name: string | null;
  email: string;
}

export default function AddUser() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: 'bidder',
    phone: '',
    country: '',
    city: '',
    state: '',
    countyId: '',
    bidderNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countyUsers, setCountyUsers] = useState<CountyUser[]>([]);
  const [loadingCounties, setLoadingCounties] = useState(true);

  useEffect(() => {
    const fetchCountyUsers = async () => {
      try {
        const res = await fetch('/api/users?type=county&pageSize=all');
        const data = await res.json();
        setCountyUsers(
          (data.users || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email }))
        );
      } catch (err) {
        console.error('Error fetching county users:', err);
      } finally {
        setLoadingCounties(false);
      }
    };
    fetchCountyUsers();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload: any = { ...formData };
    if (payload.type !== 'bidder') {
      delete payload.countyId;
    } else if (!payload.countyId) {
      payload.countyId = null;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }

      router.push('/users');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight">Add New User</h1>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value, countyId: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bidder">Bidder</SelectItem>
                  <SelectItem value="county">County</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'bidder' && (
              <div className="space-y-2">
                <Label htmlFor="bidderNumber">Bidder Number</Label>
                <Input
                  id="bidderNumber"
                  name="bidderNumber"
                  value={formData.bidderNumber}
                  onChange={handleChange}
                  placeholder="Auto-generated if left blank"
                />
              </div>
            )}

            {formData.type === 'bidder' && (
              <div className="space-y-2">
                <Label htmlFor="countyId">Assigned County</Label>
                {loadingCounties ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading counties...
                  </div>
                ) : countyUsers.length > 0 ? (
                  <Select
                    value={formData.countyId}
                    onValueChange={(value) => setFormData({ ...formData, countyId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a county user" />
                    </SelectTrigger>
                    <SelectContent>
                      {countyUsers.map((county) => (
                        <SelectItem key={county.id} value={county.id}>
                          {county.name || county.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    No county users available. Create a county user first.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" value={formData.city} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" name="state" value={formData.state} onChange={handleChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" value={formData.country} onChange={handleChange} />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Creating...' : 'Create User'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/users')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
