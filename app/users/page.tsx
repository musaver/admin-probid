'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Plus, Pencil, Trash2, UserCog, Building2, Loader2 } from 'lucide-react';

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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Properties dialog state
  const [showPropsDialog, setShowPropsDialog] = useState(false);
  const [propsUser, setPropsUser] = useState<User | null>(null);
  const [propsLoading, setPropsLoading] = useState(false);
  const [propsUserType, setPropsUserType] = useState<string>('');
  const [countyProperties, setCountyProperties] = useState<UserProperty[]>([]);
  const [bidderProperties, setBidderProperties] = useState<BidderProperty[]>([]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || '—'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.type === 'county' ? 'default' : 'secondary'}>
                          {user.type || 'bidder'}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.phone || '—'}</TableCell>
                      <TableCell>
                        {[user.city, user.state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => openPropertiesDialog(user)}>
                            <Building2 className="mr-1 h-3 w-3" />
                            Properties
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/users/edit/${user.id}`}>
                              <Pencil className="mr-1 h-3 w-3" />
                              Edit
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openChangeTypeModal(user)}>
                            <UserCog className="mr-1 h-3 w-3" />
                            Type
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

      {/* Change Type Dialog */}
      <Dialog open={showTypeModal} onOpenChange={(open) => { if (!open) { setShowTypeModal(false); setSelectedUser(null); } }}>
        <DialogContent>
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
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
