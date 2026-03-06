'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

export default function EditAdmin() {
  const router = useRouter();
  const params = useParams();
  const adminId = params.id as string;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roleId: '',
  });
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/admins/${adminId}`).then(res => res.json()),
      fetch('/api/roles').then(res => res.json())
    ])
      .then(([adminData, rolesData]) => {
        setFormData({
          name: adminData.name || '',
          email: adminData.email || '',
          password: '',
          roleId: adminData.roleId || '',
        });
        setRoles(rolesData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load admin or roles');
        setLoading(false);
      });
  }, [adminId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const dataToSubmit = {
      name: formData.name,
      email: formData.email,
      roleId: formData.roleId,
      ...(formData.password ? { password: formData.password } : {})
    };

    try {
      const response = await fetch(`/api/admins/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update admin');
      }

      router.push('/admins');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-lg">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight">Edit Admin</h1>

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
              <Label htmlFor="password">New Password (leave empty to keep current)</Label>
              <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleId">Role</Label>
              <Select value={formData.roleId} onValueChange={(value) => setFormData({ ...formData, roleId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role: any) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/admins')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
