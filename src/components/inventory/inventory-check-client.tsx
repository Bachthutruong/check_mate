"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import useSWR from 'swr';
import { useAuth } from "@/contexts/auth-context";
import { Product, Store } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Camera, CheckCircle2, XCircle, Bot, Shirt, Footprints, Laptop, Gem } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useZxing } from "react-zxing";
import Barcode from "react-barcode";
import { Skeleton } from "../ui/skeleton";
import * as XLSX from 'xlsx';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const categoryIcons: { [key: string]: React.ElementType } = {
    Apparel: Shirt,
    Footwear: Footprints,
    Electronics: Laptop,
    Accessories: Gem,
    Default: CheckCircle2
};

export function InventoryCheckClient() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [checkedProductIds, setCheckedProductIds] = useState<Set<string>>(new Set());
  const [isChecking, setIsChecking] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: stores, isLoading: storesLoading } = useSWR<Store[]>('/api/stores', fetcher);
  const { data: storeProducts, isLoading: productsLoading } = useSWR<Product[]>(selectedStoreId ? `/api/products?storeId=${selectedStoreId}` : null, fetcher);

  const { ref } = useZxing({
    onDecodeResult(result) {
      handleScanResult(result.getText());
    },
    onError(error: any) {
        if (error.name !== 'NotFoundException') {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Scanner Error",
                description: "Could not start the scanner. Please ensure camera permissions are granted.",
            });
            setIsScannerOpen(false);
        }
    }
  });

  const scannerRef: any = ref;

  const handleScanResult = (scannedCode: string) => {
    if (!storeProducts) return;
    const product = storeProducts.find(p => p.barcode === scannedCode);
    if (product) {
        if (checkedProductIds.has(product._id!)) {
            toast({
                title: "Already Checked",
                description: `${product.name} is already on the list.`,
            });
        } else {
            setCheckedProductIds(prev => new Set(prev).add(product._id!));
            toast({
                title: "Scan Successful",
                description: `Checked: ${product.name}`,
            });
        }
    } else {
        toast({
            variant: "destructive",
            title: "Product Not Found",
            description: `No product in this store has barcode: ${scannedCode}`,
        });
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !storeProducts) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Assuming barcodes are in the first column
            const barcodes = json.map(row => row[0]).filter(Boolean);
            
            const productMap = new Map(storeProducts.map(p => [p.barcode, p._id]));
            const foundProductIds = new Set<string>();

            for (const barcode of barcodes) {
                const productId = productMap.get(String(barcode));
                if (productId) {
                    foundProductIds.add(productId);
                }
            }

            if (foundProductIds.size === 0) {
                 toast({
                    variant: "destructive",
                    title: "No Products Found",
                    description: "No matching products were found in the store for the barcodes in the file.",
                });
                return;
            }

            setCheckedProductIds(prev => new Set([...prev, ...foundProductIds]));

            toast({
                title: "Import Successful",
                description: `${foundProductIds.size} products were found and have been checked.`,
            });
        } catch (error) {
            console.error("Error processing XLSX file:", error);
            toast({
                variant: "destructive",
                title: "Import Error",
                description: "Could not read the file. Please ensure it is a valid XLSX file with barcodes in the first column.",
            });
        } finally {
            // Reset file input
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const userStores = useMemo(() => {
    if (!user || !stores) return [];
    if (user.role === 'admin') {
      return stores;
    }
    return stores.filter(store => user.storeIds?.includes(store._id!));
  }, [user, stores]);

  useEffect(() => {
    if(userStores.length === 1) {
        handleStoreChange(userStores[0]._id!);
    }
  }, [userStores]);

  const handleStoreChange = (storeId: string) => {
    if (isChecking) {
        toast({
            variant: "destructive",
            title: "Cannot change store",
            description: "Please complete or cancel the current inventory check first.",
        });
        return;
    }
    setSelectedStoreId(storeId);
    if (storeId) {
        setCheckedProductIds(new Set());
        setIsChecking(true);
    } else {
        setIsChecking(false);
    }
  };

  const handleCheckProduct = (productId: string) => {
    setCheckedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };
  
  const categories = useMemo(() => {
    if (!storeProducts) return [];
    const cats = new Set(storeProducts.map(p => p.category));
    return ["All", ...Array.from(cats)];
  }, [storeProducts]);

  const completeCheck = async () => {
    if (!user || !selectedStoreId || !storeProducts) return;
    
    const allProductIds = new Set(storeProducts.map(p => p._id!));
    const missingProductIds = new Set([...allProductIds].filter(id => !checkedProductIds.has(id)));
    const missingItems = storeProducts.filter(p => missingProductIds.has(p._id!));

    const newCheck = {
      storeId: selectedStoreId,
      storeName: stores?.find(s => s._id === selectedStoreId)?.name || 'Unknown Store',
      employeeName: user.name,
      checkedItems: Array.from(checkedProductIds),
      missingItems: missingItems.map(item => item._id!),
    };

    try {
        const res = await fetch('/api/inventory-checks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCheck),
        });
        if (!res.ok) throw new Error('Failed to save inventory check');

        const result = await res.json();
        toast({
            title: "Inventory Check Completed",
            description: `Status: ${result.status}. The results have been saved to history.`,
        });

        // Reset state
        setSelectedStoreId("");
        setCheckedProductIds(new Set());
        setIsChecking(false);

    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  if (!user || storesLoading) return <Skeleton className="w-full h-96" />;

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-2">
                <CardTitle>Start a New Check</CardTitle>
                <p className="text-muted-foreground">Select a store to begin checking inventory.</p>
            </div>
            <div className="flex gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    accept=".xlsx, .xls"
                    className="hidden"
                />
                <Button variant="outline" disabled={!isChecking} onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2" />
                    Import XLSX
                </Button>
                <Button onClick={() => setIsScannerOpen(true)} disabled={!isChecking}>
                    <Camera className="mr-2" />
                    Scan with Camera
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="w-full max-w-sm">
            <Select onValueChange={handleStoreChange} value={selectedStoreId} disabled={userStores.length <= 1 && isChecking}>
                <SelectTrigger id="store-select">
                    <SelectValue placeholder="Select a store..." />
                </SelectTrigger>
                <SelectContent>
                    {userStores.map(store => (
                        <SelectItem key={store._id} value={String(store._id)}>{store.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        {isChecking && productsLoading && <Skeleton className="w-full h-64" />}
        {isChecking && !productsLoading && storeProducts && (
          <Tabs defaultValue="All" className="w-full">
            <div className="flex items-center">
              <TabsList>
                {categories.map(category => (
                  <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
                ))}
              </TabsList>
              <div className="ml-auto flex items-center gap-2">
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                    </span>
                    <span>{storeProducts.length - checkedProductIds.size} to check</span>
                 </div>
              </div>
            </div>
            {categories.map(category => (
              <TabsContent key={category} value={category}>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Status</TableHead>
                                <TableHead>Product Name</TableHead>
                                <TableHead className="hidden md:table-cell">Barcode</TableHead>
                                <TableHead className="text-right w-[120px]">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                          {storeProducts.filter(p => category === 'All' || p.category === category).map(product => {
                            const isChecked = checkedProductIds.has(product._id!);
                            const CategoryIcon = categoryIcons[product.category] || categoryIcons.Default;
                            return (
                                <TableRow key={product._id} className={isChecked ? "bg-accent/50" : ""}>
                                    <TableCell>
                                        <Badge variant={isChecked ? "default" : "secondary"} className="bg-opacity-80">
                                          {isChecked ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                          {isChecked ? 'Checked' : 'Pending'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <CategoryIcon className="h-5 w-5 text-muted-foreground hidden sm:inline-block"/>
                                            <div className="font-medium">{product.name}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Barcode value={product.barcode} height={30} displayValue={false} margin={0} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                          variant={isChecked ? "outline" : "default"} 
                                          size="sm"
                                          onClick={() => handleCheckProduct(product._id!)}
                                        >
                                          {isChecked ? 'Uncheck' : 'Check'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                          })}
                        </TableBody>
                    </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
      {isChecking && (
        <CardFooter className="border-t px-6 py-4">
            <div className="flex w-full items-center justify-between">
                <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Bot className="h-5 w-5 text-primary" />
                        <span>AI Assistant Enabled</span>
                    </div>
                    </TooltipTrigger>
                    <TooltipContent>
                    <p>Our AI will cross-reference the check against past records for potential discrepancies.</p>
                    </TooltipContent>
                </Tooltip>
                </TooltipProvider>
                <Button onClick={completeCheck}>Complete Check</Button>
            </div>
        </CardFooter>
      )}
    </Card>
    
    <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Scan Barcode</DialogTitle>
                <DialogDescription>
                    Point your camera at a product's barcode.
                </DialogDescription>
            </DialogHeader>
            <video ref={scannerRef} className="w-full rounded-lg" />
            <Button variant="outline" onClick={() => setIsScannerOpen(false)}>Close Scanner</Button>
        </DialogContent>
    </Dialog>
    </>
  );
}
