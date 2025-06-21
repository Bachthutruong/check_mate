"use client";

import { useState } from "react";
import { stores as mockStores, users, Store, User } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, UserPlus, Warehouse } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";

export function StoreManager() {
  const [stores, setStores] = useState<Store[]>(mockStores);
  const [allUsers, setAllUsers] = useState<User[]>(users);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [currentStore, setCurrentStore] = useState<Partial<Store> | null>(null);
  const { toast } = useToast();

  const openDialog = (store: Partial<Store> | null = null) => {
    setCurrentStore(store ? { ...store } : { name: '' });
    setIsDialogOpen(true);
  };

  const openAssignDialog = (store: Store) => {
    setCurrentStore(store);
    setIsAssignDialogOpen(true);
  }

  const handleSave = () => {
    if (!currentStore || !currentStore.name) {
        toast({ variant: "destructive", title: "Validation Error", description: "Store name is required." });
        return;
    }

    if (currentStore.id) { // Editing existing store
        setStores(stores.map(s => s.id === currentStore!.id ? { ...s, name: currentStore!.name! } : s));
        toast({ title: "Store Updated", description: `"${currentStore.name}" has been updated.` });
    } else { // Adding new store
        const newStore: Store = { id: Date.now(), name: currentStore.name, employeeIds: [] };
        setStores([...stores, newStore]);
        toast({ title: "Store Added", description: `"${newStore.name}" has been created.` });
    }
    setIsDialogOpen(false);
    setCurrentStore(null);
  };
  
  const handleAssignEmployee = (userId: string) => {
    if(!currentStore || !currentStore.id) return;

    const employeeId = parseInt(userId);
    
    // Update store
    const updatedStore = { ...currentStore, employeeIds: [...currentStore.employeeIds || [], employeeId] };
    setStores(stores.map(s => s.id === updatedStore.id ? updatedStore as Store : s));
    
    // Update user
    setAllUsers(allUsers.map(u => {
        if(u.id === employeeId && !u.storeIds.includes(currentStore!.id!)) {
            return { ...u, storeIds: [...u.storeIds, currentStore!.id!] };
        }
        return u;
    }));

    toast({ title: "Employee Assigned", description: `Employee has been added to "${currentStore.name}".`});
    setIsAssignDialogOpen(false);
    setCurrentStore(null);
  };

  const getStoreEmployees = (store: Store) => {
    return allUsers.filter(u => store.employeeIds.includes(u.id));
  };
  
  const getAssignableEmployees = (store: Store | Partial<Store> | null) => {
      if(!store) return [];
      return allUsers.filter(u => u.role === 'employee' && !u.storeIds.includes(store.id!));
  }


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
                {stores.map(store => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium flex items-center gap-2"><Warehouse size={16}/> {store.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getStoreEmployees(store).map(emp => <Badge key={emp.id} variant="secondary">{emp.name}</Badge>)}
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
                          <DropdownMenuItem onClick={() => openDialog(store)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAssignDialog(store)}>
                            <UserPlus className="mr-2 h-4 w-4"/>
                            Assign Employee
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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
      
      {/* Add/Edit Store Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentStore?.id ? 'Edit Store' : 'Add New Store'}</DialogTitle>
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
      
      {/* Assign Employee Dialog */}
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
                        <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </DialogContent>
      </Dialog>
    </>
  );
}
