
"use client";

import { useState } from "react";
import useSWR from 'swr';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, UserCog } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { User, Store } from "@/lib/data";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea } from "../ui/scroll-area";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function EmployeeManager() {
  const { data: users, error: usersError, isLoading: usersLoading, mutate: mutateUsers } = useSWR<User[]>('/api/users', fetcher);
  const { data: stores, error: storesError, isLoading: storesLoading } = useSWR<Store[]>('/api/stores', fetcher);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<User> | null>(null);
  const { toast } = useToast();

  const openDialog = (user: Partial<User> | null = null) => {
    setCurrentUser(user ? { ...user } : { name: '', role: 'employee', storeIds: [] });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentUser || !currentUser.name || !currentUser.role) {
      toast({ variant: "destructive", title: "Validation Error", description: "Name and role are required." });
      return;
    }

    const url = currentUser._id ? `/api/users/${currentUser._id}` : '/api/users';
    const method = currentUser._id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentUser),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save user');
      }
      
      mutateUsers();
      toast({ title: `User ${currentUser._id ? 'Updated' : 'Added'}`, description: `"${currentUser.name}" has been saved.` });
      setIsDialogOpen(false);
      setCurrentUser(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Error", description: error.message });
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      mutateUsers();
      toast({ title: "User Deleted", description: "The user has been successfully deleted." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete Error", description: error.message });
    }
  };

  const getUserStores = (user: User) => {
    if (!stores) return [];
    return stores.filter(s => user.storeIds.includes(s._id!));
  };
  
  if (usersLoading || storesLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }
  
  if (usersError || storesError) return <div>Failed to load data</div>;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage employees and admins.</CardDescription>
            </div>
            <Button onClick={() => openDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Stores</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map(user => (
                  <TableRow key={user._id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        <UserCog className="mr-2 h-4 w-4" />
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getUserStores(user).map(store => <Badge key={store._id} variant="outline">{store.name}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDialog(user)}>Edit</DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Delete</DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the user "{user.name}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(user._id!)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentUser?._id ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input
                id="name"
                value={currentUser?.name || ''}
                onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Role</Label>
              <Select
                value={currentUser?.role || ''}
                onValueChange={(value: 'admin' | 'employee') => setCurrentUser({ ...currentUser, role: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Stores</Label>
                <ScrollArea className="h-32 w-full rounded-md border col-span-3">
                   <div className="p-4 space-y-2">
                    {stores?.map(store => (
                        <div key={store._id} className="flex items-center space-x-2">
                            <Checkbox
                                id={store._id}
                                checked={currentUser?.storeIds?.includes(store._id!)}
                                onCheckedChange={(checked) => {
                                    const storeId = store._id!;
                                    const currentStoreIds = currentUser?.storeIds || [];
                                    if (checked) {
                                        setCurrentUser({...currentUser, storeIds: [...currentStoreIds, storeId]});
                                    } else {
                                        setCurrentUser({...currentUser, storeIds: currentStoreIds.filter(id => id !== storeId)});
                                    }
                                }}
                            />
                            <label htmlFor={store._id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {store.name}
                            </label>
                        </div>
                    ))}
                   </div>
                </ScrollArea>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
