'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

const permissions = [
  { id: 'users_view', label: 'View Users' },
  { id: 'users_create', label: 'Create Users' },
  { id: 'users_edit', label: 'Edit Users' },
  { id: 'users_delete', label: 'Delete Users' },
  { id: 'courses_view', label: 'View Courses' },
  { id: 'courses_create', label: 'Create Courses' },
  { id: 'courses_edit', label: 'Edit Courses' },
  { id: 'courses_delete', label: 'Delete Courses' },
  { id: 'orders_view', label: 'View Orders' },
  { id: 'orders_create', label: 'Create Orders' },
  { id: 'orders_edit', label: 'Edit Orders' },
  { id: 'orders_delete', label: 'Delete Orders' },
  { id: 'admins_view', label: 'View Admins' },
  { id: 'admins_create', label: 'Create Admins' },
  { id: 'admins_edit', label: 'Edit Admins' },
  { id: 'admins_delete', label: 'Delete Admins' },
  { id: 'roles_view', label: 'View Roles' },
  { id: 'roles_create', label: 'Create Roles' },
  { id: 'roles_edit', label: 'Edit Roles' },
  { id: 'roles_delete', label: 'Delete Roles' },
  { id: 'logs_view', label: 'View Logs' },
];

export default function EditRole() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.id as string;

  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/roles/${roleId}`)
      .then(res => res.json())
      .then(data => {
        setFormData({
          name: data.name || '',
          permissions: JSON.parse(data.permissions || '[]'),
        });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load role');
        setLoading(false);
      });
  }, [roleId]);

  const togglePermission = (permissionId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter(id => id !== permissionId),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          permissions: JSON.stringify(formData.permissions),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      router.push('/roles');
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
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight">Edit Role</h1>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {permissions.map((permission) => (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={permission.id}
                      checked={formData.permissions.includes(permission.id)}
                      onCheckedChange={(checked) => togglePermission(permission.id, checked as boolean)}
                    />
                    <Label htmlFor={permission.id} className="text-sm font-normal cursor-pointer">
                      {permission.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/roles')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
