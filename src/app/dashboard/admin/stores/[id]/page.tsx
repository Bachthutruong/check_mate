"use client";

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { Store, User } from '@/lib/data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function StoreInfo({ store, mutate }: { store: Store, mutate: () => void }) {
    const [name, setName] = useState(store.name);
    const { toast } = useToast();

    const handleSave = async () => {
        const res = await fetch(`/api/stores/${store._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });

        if (res.ok) {
            toast({ title: "Store Updated", description: "Store information has been saved." });
            mutate();
        } else {
            toast({ variant: "destructive", title: "Error", description: "Failed to update store." });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Store Information</CardTitle>
                <CardDescription>View and edit store details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Store Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <Button onClick={handleSave}>Save Changes</Button>
            </CardContent>
        </Card>
    );
}

function StoreEmployees({ store, mutateStore }: { store: Store, mutateStore: () => void }) {
    const { data: users, error: usersError, isLoading: usersLoading, mutate: mutateUsers } = useSWR<User[]>('/api/users', fetcher);
    const { toast } = useToast();
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);

    const storeEmployees = users?.filter(u => store.employeeIds?.includes(u._id!)) || [];
    const assignableEmployees = users?.filter(u => u.role === 'employee' && !store.employeeIds?.includes(u._id!)) || [];

    const handleAssignEmployee = async () => {
        if (!selectedUserId) {
            toast({ variant: "destructive", title: "No employee selected", description: "Please select an employee to assign." });
            return;
        }
        try {
            const res = await fetch(`/api/stores/${store._id}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedUserId }),
            });
            if (!res.ok) throw new Error('Failed to assign employee');
            toast({ title: "Employee Assigned", description: "The employee has been added to the store." });
            mutateStore();
            mutateUsers();
            setIsAssignDialogOpen(false);
            setSelectedUserId(null);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Assign Error", description: error.message });
        }
    };

    const handleRemoveEmployee = async (userId: string) => {
        try {
            const res = await fetch(`/api/stores/${store._id}/assign`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            if (!res.ok) throw new Error('Failed to remove employee');
            toast({ title: "Employee Removed", description: "The employee has been removed from the store." });
            mutateStore();
            mutateUsers();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Remove Error", description: error.message });
        }
    };

    if (usersLoading) return <Skeleton className="h-40 w-full" />;
    if (usersError) return <div>Failed to load users.</div>;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Manage Employees</CardTitle>
                    <CardDescription>Assign or unassign employees from this store.</CardDescription>
                </div>
                <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Assign Employee
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Assign Employee to "{store.name}"</DialogTitle>
                            <DialogDescription>Select an available employee to add to this store.</DialogDescription>
                        </DialogHeader>
                        <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen} modal={true}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isComboboxOpen}
                                    className="w-full justify-between"
                                >
                                    {selectedUserId
                                        ? assignableEmployees.find(emp => emp._id === selectedUserId)?.name
                                        : "Select employee..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search employee..." />
                                    <CommandEmpty>No employee found.</CommandEmpty>
                                    <CommandGroup>
                                        {assignableEmployees.map(emp => (
                                            <CommandItem
                                                key={emp._id}
                                                value={emp.name}
                                                onSelect={() => {
                                                    setSelectedUserId(emp._id!);
                                                    setIsComboboxOpen(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedUserId === emp._id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {emp.name} ({emp.username})
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleAssignEmployee} disabled={!selectedUserId}>
                                Assign Employee
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Username</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {storeEmployees.map(emp => (
                                <TableRow key={emp._id}>
                                    <TableCell className="font-medium">{emp.name}</TableCell>
                                    <TableCell><Badge variant="secondary">{emp.username}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will remove "{emp.name}" from this store.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRemoveEmployee(emp._id!)}>
                                                        Unassign
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {storeEmployees.length === 0 && (
                    <div className="text-center p-4 text-sm text-muted-foreground">
                        No employees are assigned to this store.
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default function StoreDetailPage() {
    const { id } = useParams();
    const { data: store, error, isLoading, mutate } = useSWR<Store>(id ? `/api/stores/${id}` : null, fetcher);

    if (isLoading) return (
        <div className="space-y-4">
            <Skeleton className="h-12 w-1/4" />
            <Skeleton className="h-10 w-48" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-24" />
                </CardContent>
            </Card>
        </div>
    );
    if (error) return <div>Failed to load store details.</div>;
    if (!store) return <div>Store not found.</div>;

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Manage: {store.name}</h1>
            <Tabs defaultValue="info" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="info">Store Information</TabsTrigger>
                    <TabsTrigger value="employees">Employees</TabsTrigger>
                </TabsList>
                <TabsContent value="info">
                    <StoreInfo store={store} mutate={mutate} />
                </TabsContent>
                <TabsContent value="employees">
                    <StoreEmployees store={store} mutateStore={mutate} />
                </TabsContent>
            </Tabs>
        </div>
    );
} 