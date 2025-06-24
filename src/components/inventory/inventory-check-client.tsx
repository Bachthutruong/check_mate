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
    '專案手機攝站': Camera,
    '實類': Gem,
    '攝重類': Laptop,
    '攝约頻': Footprints,
    'Catch99(6)': CheckCircle2,
    '行動電話類': Shirt,
    '序號行動電話': Footprints,
    'Apparel': Shirt,
    'Footwear': Footprints,
    'Electronics': Laptop,
    'Accessories': Gem,
    Default: CheckCircle2
};

export function InventoryCheckClient() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [checkedProductIds, setCheckedProductIds] = useState<Set<string>>(new Set());
  const [isChecking, setIsChecking] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: stores, isLoading: storesLoading } = useSWR<Store[]>('/api/stores', fetcher);
  const { data: storeProducts, isLoading: productsLoading, mutate: mutateProducts } = useSWR<Product[]>(selectedStoreId ? `/api/products?storeId=${selectedStoreId}` : null, fetcher);

  const { ref } = useZxing({
    onDecodeResult(result) {
      handleScanResult(result.getText());
    },
    onError(error: any) {
        console.error("Scanner error:", error);
        setScannerError(error.message || "掃描器發生錯誤");
        if (error.name !== 'NotFoundException') {
            toast({
                variant: "destructive",
                title: "掃描器錯誤",
                description: "無法啟動掃描器。請確保已授予相機權限且相機可用。",
            });
        }
    },
    constraints: {
      video: {
        facingMode: 'environment' // Use back camera on mobile devices
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
                title: "已檢查過",
                description: `${product.name} 已在清單中。`,
            });
        } else {
            setCheckedProductIds(prev => new Set(prev).add(product._id!));
            toast({
                title: "掃描成功",
                description: `已檢查: ${product.name}`,
            });
        }
        setIsScannerOpen(false); // Close scanner after successful scan
    } else {
        toast({
            variant: "destructive",
            title: "找不到產品",
            description: `此商店中沒有條碼為: ${scannedCode} 的產品`,
        });
    }
  };

  const handleOpenScanner = () => {
    setScannerError("");
    setIsScannerOpen(true);
  };

  const handleCloseScanner = () => {
    setIsScannerOpen(false);
    setScannerError("");
  };

  // Helper function to clean and parse numbers from Excel
  const parseExcelNumber = (value: any): number => {
    if (value === undefined || value === null || value === '') {
      return 0;
    }
    
    // Convert to string and clean common Excel formatting
    let cleanValue = String(value)
      .replace(/,/g, '') // Remove commas
      .replace(/\s/g, '') // Remove spaces
      .replace(/[^\d.-]/g, ''); // Keep only digits, dots, and minus signs
    
    const parsed = Number(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !storeProducts) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Skip header row and process data
            const rows = json.slice(1);
            const newProducts: any[] = [];
            let createdCount = 0;

            for (const row of rows) {
                if (!row || row.length === 0) continue;
                
                // Excel format mapping - New order:
                // 0: 大類 (Category)
                // 1: 廠牌 (Brand)
                // 2: 商品編號 (Product Code/Barcode)
                // 3: 商品名稱 (Product Name)
                // 4: 成本 (Cost)
                // 5: 電腦庫存 (Computer Inventory)
                // 6: 實際庫存 (Actual Inventory)
                // 7: 差異數量 (Difference Quantity)
                // 8: 差異金額 (Difference Amount)
                // 9: 備註 (Notes)
                
                const category = row[0];
                const brand = row[1];
                const barcode = String(row[2]);
                const productName = row[3];
                
                // Better number parsing
                const cost = parseExcelNumber(row[4]);
                const computerInventory = parseExcelNumber(row[5]);
                const actualInventory = parseExcelNumber(row[6]);
                const differenceQuantity = parseExcelNumber(row[7]);
                const differenceAmount = parseExcelNumber(row[8]);
                const notes = row[9] || '';

                // Debug logging
                console.log('Processing row:', {
                    barcode,
                    productName,
                    cost: cost,
                    computerInventory: computerInventory,
                    actualInventory: actualInventory,
                    rawValues: {
                        costRaw: row[4],
                        computerInventoryRaw: row[5],
                        actualInventoryRaw: row[6]
                    }
                });

                // Skip rows without essential data
                if (!barcode || !productName || !category) continue;

                // Validate numeric values
                const finalCost = isNaN(cost) ? 0 : cost;
                const finalComputerInventory = isNaN(computerInventory) ? 0 : computerInventory;
                const finalActualInventory = isNaN(actualInventory) ? 0 : actualInventory;
                const finalDifferenceQuantity = isNaN(differenceQuantity) ? 0 : differenceQuantity;
                const finalDifferenceAmount = isNaN(differenceAmount) ? 0 : differenceAmount;

                console.log('Final validated values:', {
                    finalCost,
                    finalComputerInventory,
                    finalActualInventory
                });

                // Since we're replacing all, just add to newProducts
                const newProduct = {
                    name: productName,
                    category: category,
                    brand: brand,
                    barcode: barcode,
                    cost: finalCost,
                    computerInventory: finalComputerInventory,
                    actualInventory: finalActualInventory,
                    differenceQuantity: finalDifferenceQuantity,
                    differenceAmount: finalDifferenceAmount,
                    notes: notes,
                    storeId: selectedStoreId
                };
                
                console.log('Created product object:', JSON.stringify(newProduct, null, 2));
                newProducts.push(newProduct);
            }

            // Create new products (replacing all)
            if (newProducts.length > 0) {
                try {
                    console.log('Sending API request with products:', newProducts.length);
                    console.log('Request payload sample:', newProducts[0]);
                    
                    const response = await fetch('/api/products', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            products: newProducts,
                            replaceAll: true,
                            storeId: selectedStoreId
                        }),
                    });

                    console.log('API response status:', response.status);
                    console.log('API response ok:', response.ok);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('API error response:', errorText);
                        throw new Error('Failed to create new products');
                    }

                    const result = await response.json();
                    createdCount = result.created || 0;
                    
                    console.log('API response result:', result);
                    console.log('API created products sample:', result.createdProducts?.[0]);
                    
                    // Refresh products data to include new products
                    await mutateProducts();
                    
                    // Log what we got after refresh
                    setTimeout(() => {
                        console.log('After mutate - storeProducts:', storeProducts);
                        if (storeProducts && storeProducts.length > 0) {
                            console.log('First product after refresh:', storeProducts[0]);
                        }
                    }, 1000);
                    
                    // Reset checked items - all imported products start as unchecked
                    setCheckedProductIds(new Set());
                    
                } catch (error) {
                    console.error('Error creating products:', error);
                    toast({
                        variant: "destructive",
                        title: "創建產品失敗",
                        description: "無法創建新產品，請稍後再試。",
                    });
                    return;
                }
            }

            if (newProducts.length === 0) {
                toast({
                    variant: "destructive",
                    title: "沒有找到有效產品",
                    description: "Excel檔案中沒有有效的產品資料。請檢查檔案格式。",
                });
                return;
            }

            toast({
                title: "匯入成功",
                description: `已替換商店產品清單。創建了 ${createdCount} 個新產品，請開始掃描或手動檢查。`,
            });
        } catch (error) {
            console.error("Error processing XLSX file:", error);
            toast({
                variant: "destructive",
                title: "匯入錯誤",
                description: "無法讀取檔案。請確保是有效的Excel檔案且格式正確。",
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

  // Debug: Log storeProducts when it changes
  useEffect(() => {
    if (storeProducts) {
      console.log('storeProducts updated:', storeProducts);
      console.log('Sample product values:', storeProducts[0]);
    }
  }, [storeProducts]);

  const handleStoreChange = (storeId: string) => {
    if (isChecking) {
        toast({
            variant: "destructive",
            title: "無法變更商店",
            description: "請先完成或取消目前的庫存檢查。",
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
            title: "庫存檢查完成",
            description: `狀態: ${result.status === 'Completed' ? '完成' : '短缺'}。結果已保存到歷史記錄。`,
        });

        // Reset state
        setSelectedStoreId("");
        setCheckedProductIds(new Set());
        setIsChecking(false);

    } catch (error: any) {
        toast({ variant: "destructive", title: "錯誤", description: error.message });
    }
  };

  if (!user || storesLoading) return <Skeleton className="w-full h-96" />;

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-2">
                <CardTitle>開始新的檢查</CardTitle>
                <p className="text-muted-foreground">選擇一個商店開始檢查庫存。</p>
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
                    匯入 Excel
                </Button>
                <Button onClick={handleOpenScanner} disabled={!isChecking}>
                    <Camera className="mr-2" />
                    掃描條碼
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="w-full max-w-sm">
            <Select onValueChange={handleStoreChange} value={selectedStoreId} disabled={userStores.length <= 1 && isChecking}>
                <SelectTrigger id="store-select">
                    <SelectValue placeholder="選擇商店..." />
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
                  <TabsTrigger key={category} value={category}>{category === 'All' ? '全部' : category}</TabsTrigger>
                ))}
              </TabsList>
              <div className="ml-auto flex items-center gap-2">
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                    </span>
                    <span>待檢查 {storeProducts.length - checkedProductIds.size} 項</span>
                 </div>
              </div>
            </div>
            {categories.map(category => (
              <TabsContent key={category} value={category}>
                <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[800px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">狀態</TableHead>
                                <TableHead className="w-[100px]">大類</TableHead>
                                <TableHead className="w-[80px]">廠牌</TableHead>
                                <TableHead className="w-[120px]">商品編號</TableHead>
                                <TableHead className="w-[200px]">商品名稱</TableHead>
                                <TableHead className="w-[80px]">成本</TableHead>
                                <TableHead className="w-[80px]">電腦庫存</TableHead>
                                <TableHead className="w-[80px]">實際庫存</TableHead>
                                <TableHead className="w-[80px]">差異數量</TableHead>
                                <TableHead className="w-[80px]">差異金額</TableHead>
                                <TableHead className="w-[120px] text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                          {storeProducts.filter(p => category === 'All' || p.category === category).map(product => {
                            const isChecked = checkedProductIds.has(product._id!);
                            const CategoryIcon = categoryIcons[product.category] || categoryIcons.Default;
                            
                            // Debug logging for each product
                            console.log('Rendering product:', {
                                name: product.name,
                                cost: product.cost,
                                computerInventory: product.computerInventory,
                                actualInventory: product.actualInventory
                            });
                            
                            return (
                                <TableRow key={product._id} className={isChecked ? "bg-accent/50" : ""}>
                                    <TableCell>
                                        <Badge variant={isChecked ? "default" : "secondary"} className="text-xs whitespace-nowrap">
                                          {isChecked ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                          {isChecked ? '已檢查' : '待檢查'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <CategoryIcon className="h-3 w-3 text-muted-foreground flex-shrink-0"/>
                                            <span className="text-xs whitespace-nowrap">{product.category}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs whitespace-nowrap">{product.brand || '-'}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col items-center">
                                            <Barcode 
                                                value={product.barcode} 
                                                height={12} 
                                                width={1}
                                                fontSize={6} 
                                                displayValue={false} 
                                                margin={0} 
                                            />
                                            <span className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">{product.barcode}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs font-medium truncate" title={product.name}>
                                            {product.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs font-medium text-blue-600 whitespace-nowrap">
                                            {Number(product.cost || 0).toLocaleString('zh-TW')}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-medium whitespace-nowrap ${(product.computerInventory || 0) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                            {Number(product.computerInventory || 0).toLocaleString('zh-TW')}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-medium whitespace-nowrap ${(product.actualInventory || 0) < 0 ? 'text-red-600' : (product.actualInventory || 0) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                            {Number(product.actualInventory || 0).toLocaleString('zh-TW')}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-medium whitespace-nowrap ${(product.differenceQuantity || 0) !== 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                                            {Number(product.differenceQuantity || 0).toLocaleString('zh-TW')}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-medium whitespace-nowrap ${(product.differenceAmount || 0) !== 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                                            {Number(product.differenceAmount || 0).toLocaleString('zh-TW')}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                          variant={isChecked ? "outline" : "default"} 
                                          size="sm"
                                          className="text-xs px-2 py-1"
                                          onClick={() => handleCheckProduct(product._id!)}
                                        >
                                          {isChecked ? '取消' : '檢查'}
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
                        <span>AI 助手已啟用</span>
                    </div>
                    </TooltipTrigger>
                    <TooltipContent>
                    <p>我們的AI將根據過往記錄交叉比對檢查結果，發現潛在差異。</p>
                    </TooltipContent>
                </Tooltip>
                </TooltipProvider>
                <Button onClick={completeCheck}>完成檢查</Button>
            </div>
        </CardFooter>
      )}
    </Card>
    
    <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>掃描條碼</DialogTitle>
                <DialogDescription>
                    將相機對準產品的條碼。出現提示時請允許相機權限。
                </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col space-y-4">
                {scannerError ? (
                    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                        <p className="text-red-700 text-sm">
                            <strong>相機錯誤:</strong> {scannerError}
                        </p>
                        <p className="text-red-600 text-xs mt-2">
                            請確保:
                            <br />• 已授予相機權限
                            <br />• 相機沒有被其他應用程式使用
                            <br />• 設備有可用的相機
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        <video 
                            ref={scannerRef} 
                            className="w-full rounded-lg border"
                            style={{ minHeight: '300px' }}
                            playsInline
                            muted
                        />
                        <div className="absolute inset-0 border-2 border-dashed border-blue-400 rounded-lg pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-24 border-2 border-blue-500 rounded-lg">
                                <div className="text-xs text-blue-600 text-center mt-2">將條碼放在此處</div>
                            </div>
                        </div>
                    </div>
                )}
                <Button variant="outline" onClick={handleCloseScanner}>
                    關閉掃描器
                </Button>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
