
"use client"

import { useMemo, useState } from "react"
import useSWR from 'swr';
import { useAuth } from "@/contexts/auth-context"
import { InventoryCheck, Product, Store } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle2, Eye } from "lucide-react"
import { MissingItemsDialog } from "./missing-items-dialog"
import { Skeleton } from "../ui/skeleton";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function HistoryView() {
  const { user } = useAuth()
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCheckItems, setSelectedCheckItems] = useState<Product[]>([])

  const { data: stores, isLoading: storesLoading } = useSWR<Store[]>(user?.role === 'admin' ? '/api/stores' : null, fetcher);
  const { data: filteredChecks, isLoading: checksLoading } = useSWR<InventoryCheck[]>(`/api/inventory-checks?storeId=${selectedStoreId}`, fetcher);

  const userStores = useMemo(() => {
    if (user?.role === 'admin') return stores || [];
    // For employees, we can derive their stores from the user object if needed, or assume the API handles filtering
    return [];
  }, [user, stores]);

  const handleViewMissingItems = (items: Product[]) => {
    setSelectedCheckItems(items)
    setDialogOpen(true)
  }

  if (!user) return null;

  const isLoading = (user?.role === 'admin' && storesLoading) || checksLoading;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="grid gap-2">
                <CardTitle>Past Inventory Checks</CardTitle>
                <CardDescription>
                {user.role === 'admin'
                    ? "Review checks from all stores."
                    : "Review checks from your assigned stores."}
                </CardDescription>
            </div>
            {user.role === 'admin' && (
              <div className="w-full md:w-[250px]">
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filter by store..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All Stores</SelectItem>
                      {userStores.map((store: Store) => (
                        <SelectItem key={store._id} value={String(store._id)}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="rounded-md border">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="hidden sm:table-cell">Checked By</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecks && filteredChecks.length > 0 ? (
                  filteredChecks.map(check => (
                    <TableRow key={check._id}>
                      <TableCell className="font-medium">{check.storeName}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{check.employeeName}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(check.date))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={check.status === "Completed" ? "default" : "destructive"}>
                          {check.status === 'Completed' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
                          {check.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {check.status === "Shortage" && (
                          <Button variant="outline" size="sm" onClick={() => handleViewMissingItems(check.missingItems)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No history found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>
      <MissingItemsDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        items={selectedCheckItems}
      />
    </>
  )
}
