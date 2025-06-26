"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Package } from "lucide-react"
import type { Product } from "@/lib/data"

interface MissingItemsDialogProps {
  isOpen: boolean
  onClose: () => void
  items: Product[]
}

export function MissingItemsDialog({ isOpen, onClose, items }: MissingItemsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Missing Items Report
          </DialogTitle>
          <DialogDescription>
            The following items were expected but not found during the inventory check.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {items.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    Total {items.length} missing items
                  </span>
                </div>
                <Badge variant="destructive" className="text-xs">
                  Requires Review
                </Badge>
              </div>
              
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-secondary">
                    <TableRow>
                      <TableHead className="w-[50px]">No.</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="hidden sm:table-cell">商品編號</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item._id}>
                        <TableCell className="text-center text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {item.barcode || 'N/A'}
                          </code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p>No missing items</p>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 text-xs text-muted-foreground">
            {items.length > 0 && (
              <>Please contact warehouse management to verify these items.</>
            )}
          </div>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
