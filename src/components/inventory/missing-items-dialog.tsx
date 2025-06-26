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
      <DialogContent className="sm:max-w-2xl max-w-[95vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span>缺失商品報告</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            以下商品在庫存檢查中預期但未找到。
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {items.length > 0 ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-red-800">
                    總計 {items.length} 項缺失商品
                  </span>
                </div>
                <Badge variant="destructive" className="text-xs self-start sm:self-center">
                  需要審核
                </Badge>
              </div>
              
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-secondary">
                    <TableRow>
                      <TableHead className="w-[50px]">序號</TableHead>
                      <TableHead>商品名稱</TableHead>
                      <TableHead className="hidden sm:table-cell">類別</TableHead>
                      <TableHead className="hidden md:table-cell">商品編號</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item._id}>
                        <TableCell className="text-center text-muted-foreground font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">{item.name}</div>
                            <div className="sm:hidden flex flex-col gap-1 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs w-fit">
                                {item.category}
                              </Badge>
                              <div className="md:hidden">
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {item.barcode || 'N/A'}
                                </code>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          <code className="text-xs bg-muted px-2 py-1 rounded break-all">
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
              <p className="text-sm">沒有缺失商品</p>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex-1 text-xs text-muted-foreground">
            {items.length > 0 && (
              <>請聯繫倉庫管理員核實這些商品。</>
            )}
          </div>
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
