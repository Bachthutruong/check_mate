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
import { Input } from "@/components/ui/input"
import { AlertCircle, CheckCircle2, Eye, Calendar, Filter, ChevronLeft, ChevronRight, Warehouse } from "lucide-react"
import { MissingItemsDialog } from "./missing-items-dialog"
import { Skeleton } from "../ui/skeleton";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface PaginatedInventoryResponse {
  checks: InventoryCheck[];
  total: number;
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function HistoryView() {
  const { user } = useAuth()
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCheckItems, setSelectedCheckItems] = useState<Product[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Helper function to format date and time in yyyy/mm/dd, 00:00 (AM/PM) format
  const formatDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Format time in 12-hour format with AM/PM
    const timeString = date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `${year}/${month}/${day}, ${timeString}`;
  };

  const { data: stores, isLoading: storesLoading } = useSWR<Store[]>(user?.role === 'admin' ? '/api/stores' : null, fetcher);
  
  // Build query params for API call
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedStoreId !== 'all') {
      params.append('storeId', selectedStoreId);
    }
    if (startDate) {
      params.append('startDate', startDate);
    }
    if (endDate) {
      params.append('endDate', endDate);
    }
    params.append('page', currentPage.toString());
    params.append('limit', itemsPerPage.toString());
    return params.toString();
  }, [selectedStoreId, startDate, endDate, currentPage, itemsPerPage]);

  const { data: paginatedData, isLoading: checksLoading } = useSWR<PaginatedInventoryResponse>(
    `/api/inventory-checks?${queryParams}`, 
    fetcher
  );

  const userStores = useMemo(() => {
    if (user?.role === 'admin') return stores || [];
    // For employees, we can derive their stores from the user object if needed, or assume the API handles filtering
    return [];
  }, [user, stores]);

  const handleViewMissingItems = (items: Product[]) => {
    setSelectedCheckItems(items)
    setDialogOpen(true)
  }

  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
    setCurrentPage(1); // Reset to first page when clearing filters
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  }

  // Reset to first page when filters change
  const handleStoreChange = (value: string) => {
    setSelectedStoreId(value);
    setCurrentPage(1);
  }

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
    setCurrentPage(1);
  }

  if (!user) return null;

  const isLoading = (user?.role === 'admin' && storesLoading) || checksLoading;
  const filteredChecks = paginatedData?.checks || [];
  const totalItems = paginatedData?.total || 0;
  const totalPages = paginatedData?.totalPages || 1;
  const hasNext = paginatedData?.hasNext || false;
  const hasPrev = paginatedData?.hasPrev || false;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                  <CardTitle>各盤點記錄</CardTitle>
                  <CardDescription>
                  {/* {user.role === 'admin'
                      ? "Review inventory checks from all stores."
                      : "Review inventory checks from your assigned stores."} */}
                  </CardDescription>
              </div>
            </div>

            {/* Store Selection Tabs - Only show for admin */}
            {user.role === 'admin' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-base sm:text-lg font-semibold">選擇店點</h3>
                  <div className="text-xs bg-gray-50 px-2 py-1 rounded border w-fit">
                    {userStores.length + 1} options
                  </div>
                </div>
                
                {/* Store Badges - Flex Wrap Layout */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {/* All Stores Option */}
                  <div
                    onClick={() => handleStoreChange("all")}
                    className="relative cursor-pointer group"
                  >
                    <Badge
                      variant={selectedStoreId === "all" ? "default" : "secondary"}
                      className={`
                        flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium 
                        transition-colors duration-200 
                        min-h-[28px] sm:min-h-[36px] select-none text-center
                        ${selectedStoreId === "all"
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md ring-1 ring-blue-300'
                          : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300 hover:border-blue-400'
                        }
                      `}
                    >
                      {/* All Stores Icon */}
                      <Filter className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${
                        selectedStoreId === "all" ? 'text-white' : 'text-blue-600'
                      }`} />
                      
                      {/* Store Name */}
                      <span className="font-medium">
                        All Stores
                      </span>
                      
                      {/* Status Badge */}
                      <div className={`
                        px-1.5 py-0.5 sm:px-2 rounded-full text-[10px] sm:text-xs font-bold 
                        min-w-[16px] sm:min-w-[20px] text-center
                        ${selectedStoreId === "all"
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-100 text-blue-800'
                        }
                      `}>
                        {selectedStoreId === "all" ? 'Active' : 'Select'}
                      </div>
                    </Badge>
                    
                    {/* Selected Indicator */}
                    {selectedStoreId === "all" && (
                      <div className="absolute -top-0.5 -right-0.5 z-10">
                        <div className="bg-green-500 text-white rounded-full p-0.5">
                          <CheckCircle2 className="h-2 w-2 sm:h-3 sm:w-3" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Individual Store Options */}
                  {userStores.map(store => {
                    const isSelected = selectedStoreId === store._id;
                    
                    return (
                      <div
                        key={store._id}
                        onClick={() => handleStoreChange(store._id!)}
                        className="relative cursor-pointer group"
                      >
                        <Badge
                          variant={isSelected ? "default" : "secondary"}
                          className={`
                            flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium 
                            transition-colors duration-200 
                            min-h-[28px] sm:min-h-[36px] select-none text-center
                            ${isSelected 
                              ? 'bg-green-600 hover:bg-green-700 text-white shadow-md ring-1 ring-green-300' 
                              : 'bg-white hover:bg-green-50 text-green-700 border-green-300 hover:border-green-400'
                            }
                          `}
                        >
                          {/* Store Icon */}
                          <Warehouse className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${
                            isSelected ? 'text-white' : 'text-green-600'
                          }`} />
                          
                          {/* Store Name */}
                          <span className="font-medium">
                            {store.name}
                          </span>
                          
                          {/* Status Badge */}
                          <div className={`
                            px-1.5 py-0.5 sm:px-2 rounded-full text-[10px] sm:text-xs font-bold 
                            min-w-[16px] sm:min-w-[20px] text-center
                            ${isSelected 
                              ? 'bg-white/20 text-white' 
                              : 'bg-green-100 text-green-800'
                            }
                          `}>
                            {isSelected ? 'Active' : 'Select'}
                          </div>
                        </Badge>
                        
                        {/* Selected Indicator */}
                        {isSelected && (
                          <div className="absolute -top-0.5 -right-0.5 z-10">
                            <div className="bg-blue-500 text-white rounded-full p-0.5">
                              <CheckCircle2 className="h-2 w-2 sm:h-3 sm:w-3" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Date Filter Section */}
            <div className="flex flex-col gap-4 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">篩選日期</span>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-muted-foreground">從:</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs text-muted-foreground">到:</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2 sm:mt-6">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={clearDateFilters}
                    disabled={!startDate && !endDate}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    不篩選了
                  </Button>
                </div>
              </div>
              {(startDate || endDate) && (
                <div className="text-xs text-muted-foreground">
                  {startDate && endDate 
                    ? `Showing results from ${startDate} to ${endDate}`
                    : startDate 
                    ? `Showing results from ${startDate} onwards`
                    : `Showing results up to ${endDate}`
                  }
                </div>
              )}
            </div>

            {/* Pagination Controls - Top */}
            {!isLoading && totalItems > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Items per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
          <div className="w-full">
            <div className="rounded-md border overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ maxWidth: '90vw' }}>
              <Table className="w-full table-fixed min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px] text-xs">Store</TableHead>
                    <TableHead className="w-[120px] text-xs whitespace-nowrap">Checked By</TableHead>
                    <TableHead className="w-[140px] text-xs whitespace-nowrap">Date</TableHead>
                    <TableHead className="w-[100px] text-xs">Status</TableHead>
                    <TableHead className="w-[120px] text-xs whitespace-nowrap">Items Checked</TableHead>
                    <TableHead className="w-[120px] text-xs whitespace-nowrap">Missing Items</TableHead>
                    <TableHead className="w-[100px] text-right text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChecks && filteredChecks.length > 0 ? (
                    filteredChecks.map(check => {
                      const checkedCount = check.checkedItems?.length || 0;
                      const missingCount = check.missingItems?.length || 0;
                      const totalCount = checkedCount + missingCount;
                      
                      return (
                        <TableRow key={check._id} className="[&>td]:py-3">
                          <TableCell className="font-medium">
                            <div className="text-xs font-medium" title={check.storeName}>
                              {check.storeName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {check.employeeName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(new Date(check.date))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={check.status === "Completed" ? "default" : "destructive"} className="text-xs whitespace-nowrap w-fit">
                              {check.status === 'Completed' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
                              {check.status === 'Completed' ? '盤點完畢' : '盤點缺'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-green-600">
                                ✓ {checkedCount} items
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Total: {totalCount}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {missingCount > 0 ? (
                              <span className="text-xs font-medium text-red-600">
                                ⚠ {missingCount} items
                              </span>
                            ) : (
                              <span className="text-xs text-green-600">
                                ✓ None missing
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col gap-1 items-end">
                              {check.status === "Shortage" && missingCount > 0 && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleViewMissingItems(check.missingItems)}
                                  className="text-xs px-2 py-1.5 min-w-[70px]"
                                >
                                  <Eye className="mr-1 h-3 w-3" /> 
                                  <span className="hidden sm:inline">View</span>
                                  <span className="sm:hidden">詳情</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Calendar className="h-8 w-8 text-muted-foreground" />
                          <span className="text-muted-foreground text-sm">
                            {startDate || endDate ? 'No history found for the selected date range.' : 'No inventory history found.'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination Controls - Bottom */}
            {!isLoading && totalItems > 0 && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({totalItems} total items)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!hasPrev}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="text-muted-foreground">...</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(totalPages)}
                          className="w-8 h-8 p-0"
                        >
                          {totalPages}
                        </Button>
                      </>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!hasNext}
                    className="flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
