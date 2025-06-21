"use client"

import { useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { inventoryChecks, Product, Store, stores } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle2, Eye } from "lucide-react"
import { MissingItemsDialog } from "./missing-items-dialog"

export function HistoryView() {
  const { user } = useAuth()
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCheckItems, setSelectedCheckItems] = useState<Product[]>([])

  const userStores = useMemo(() => {
    if (!user || user.role !== 'admin') return []
    return stores
  }, [user])

  const filteredChecks = useMemo(() => {
    let checks = inventoryChecks
    if (user?.role === "employee") {
      checks = checks.filter(c => user.storeIds.includes(c.storeId))
    }
    if (user?.role === "admin" && selectedStoreId !== "all") {
      checks = checks.filter(c => c.storeId === parseInt(selectedStoreId))
    }
    return checks
  }, [user, selectedStoreId])

  const handleViewMissingItems = (items: Product[]) => {
    setSelectedCheckItems(items)
    setDialogOpen(true)
  }

  if (!user) return null

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
                        <SelectItem key={store.id} value={String(store.id)}>
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
                {filteredChecks.length > 0 ? (
                  filteredChecks.map(check => (
                    <TableRow key={check.id}>
                      <TableCell className="font-medium">{check.storeName}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{check.employeeName}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(check.date)}
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
