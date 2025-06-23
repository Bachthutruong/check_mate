"use client";

import { useState } from "react";
import useSWR from 'swr';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Pencil, PlusCircle, UserPlus, Warehouse } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { Store, User } from "@/lib/data";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function StoreManager() {
  const { data: stores, error: storesError, isLoading: storesLoading, mutate: mutateStores } = useSWR<Store[]>('/api/stores', fetcher);
  const { data: users, error: usersError, isLoading: usersLoading, mutate: mutateUsers } = useSWR<User[]>('/api/users', fetcher);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [currentStore, setCurrentStore] = useState<Partial<Store> | null>(null);
  const { toast } = useToast();

  const openDialog = (store: Partial<Store> | null = null) => {
    setCurrentStore(store ? { ...store } : { name: '', employeeIds: [] });
    setIsDialogOpen(true);
  };

  const openAssignDialog = (store: Store) => {
    setCurrentStore(store);
    setIsAssignDialogOpen(true);
  }

  const handleSave = async () => {
    if (!currentStore || !currentStore.name) {
      toast({ variant: "destructive", title: "Validation Error", description: "Store name is required." });
      return;
    }

    const url = currentStore._id ? `/api/stores/${currentStore._id}` : '/api/stores';
    const method = currentStore._id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentStore.name }),
      });
      if (!res.ok) throw new Error('Failed to save store');
      
      mutateStores();
      toast({ title: `Store ${currentStore._id ? 'Updated' : 'Added'}`, description: `"${currentStore.name}" has been saved.` });
      setIsDialogOpen(false);
      setCurrentStore(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Error", description: error.message });
    }
  };

  const handleDelete = async (storeId: string) => {
    try {
      const res = await fetch(`/api/stores/${storeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete store');
      mutateStores();
      mutateUsers(); // Users might have been unassigned
      toast({ title: "Store Deleted", description: "The store has been successfully deleted." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete Error", description: error.message });
    }
  };
  
  const handleAssignEmployee = async (userId: string) => {
    if (!currentStore?._id) return;

    try {
      const res = await fetch(`/api/stores/${currentStore._id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to assign employee');
      
      mutateStores();
      mutateUsers();
      toast({ title: "Employee Assigned", description: `Employee has been added to "${currentStore.name}".`});
      setIsAssignDialogOpen(false);
      setCurrentStore(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Assign Error", description: error.message });
    }
  };

  const getStoreEmployees = (store: Store) => {
    return users?.filter(u => store.employeeIds?.includes(u._id!)) || [];
  };
  
  const getAssignableEmployees = (store: Store | Partial<Store> | null) => {
    if (!store || !users) return [];
    const assignedEmployeeIds = store.employeeIds || [];
    return users.filter(u => u.role === 'employee' && !assignedEmployeeIds.includes(u._id!));
  }

  if (storesLoading || usersLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }
  
  if (storesError || usersError) return <div>Failed to load data</div>;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Stores</CardTitle>
              <CardDescription>A list of all stores in the system.</CardDescription>
            </div>
            <Button onClick={() => openDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Store
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores?.map(store => (
                  <TableRow key={store._id}>
                    <TableCell className="font-medium flex items-center gap-2"><Warehouse size={16}/> {store.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getStoreEmployees(store).map(emp => <Badge key={emp._id} variant="secondary">{emp.name}</Badge>)}
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
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/admin/stores/${store._id}`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Manage
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAssignDialog(store)}>
                            <UserPlus className="mr-2 h-4 w-4"/>
                            Assign Employee
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Delete</DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete the store "{store.name}" and unassign all its employees.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(store._id!)}>Delete</AlertDialogAction>
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
            <DialogTitle>{currentStore?._id ? 'Edit Store' : 'Add New Store'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input
                id="name"
                value={currentStore?.name || ''}
                onChange={(e) => setCurrentStore({ ...currentStore, name: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>Assign Employee to "{currentStore?.name}"</DialogTitle>
                <DialogDescription>Select an available employee to add to this store.</DialogDescription>
            </DialogHeader>
            <Select onValueChange={handleAssignEmployee}>
                <SelectTrigger>
                    <SelectValue placeholder="Select an employee..." />
                </SelectTrigger>
                <SelectContent>
                    {getAssignableEmployees(currentStore).map(emp => (
                        <SelectItem key={emp._id} value={emp._id!}>{emp.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </DialogContent>
      </Dialog>
    </>
  );
}
