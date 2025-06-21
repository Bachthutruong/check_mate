"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { stores, products, addInventoryCheck, Product } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, ScanLine, CheckCircle2, XCircle, Bot, Shirt, Footprints, Laptop, Gem } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

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
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [checkedProductIds, setCheckedProductIds] = useState<Set<number>>(new Set());
  const [isChecking, setIsChecking] = useState(false);

  const userStores = useMemo(() => {
    if (!user) return [];
    return stores.filter(store => user.storeIds.includes(store.id));
  }, [user]);

  useEffect(() => {
    if(userStores.length === 1) {
        handleStoreChange(String(userStores[0].id));
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
        const prods = products.filter(p => p.storeId === parseInt(storeId));
        setStoreProducts(prods);
        setCheckedProductIds(new Set());
        setIsChecking(true);
    } else {
        setStoreProducts([]);
        setIsChecking(false);
    }
  };

  const handleCheckProduct = (productId: number) => {
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

  const simulateBarcodeScan = () => {
    const uncheckedProducts = storeProducts.filter(p => !checkedProductIds.has(p.id));
    if (uncheckedProducts.length > 0) {
      const randomProduct = uncheckedProducts[Math.floor(Math.random() * uncheckedProducts.length)];
      handleCheckProduct(randomProduct.id);
      toast({
        title: "Scan Successful",
        description: `Checked: ${randomProduct.name}`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: "All products have been checked.",
      });
    }
  };
  
  const categories = useMemo(() => {
    const cats = new Set(storeProducts.map(p => p.category));
    return ["All", ...Array.from(cats)];
  }, [storeProducts]);

  const completeCheck = () => {
    if (!user || !selectedStoreId) return;
    
    const allProductIds = new Set(storeProducts.map(p => p.id));
    const missingProductIds = new Set([...allProductIds].filter(id => !checkedProductIds.has(id)));
    const missingItems = storeProducts.filter(p => missingProductIds.has(p.id));

    const newCheck = {
      id: `hist-${Date.now()}`,
      storeId: parseInt(selectedStoreId),
      storeName: stores.find(s => s.id === parseInt(selectedStoreId))?.name || 'Unknown Store',
      employeeName: user.name,
      date: new Date(),
      status: missingItems.length > 0 ? 'Shortage' : 'Completed',
      checkedItems: Array.from(checkedProductIds),
      missingItems: missingItems,
    };

    addInventoryCheck(newCheck);
    
    toast({
      title: "Inventory Check Completed",
      description: `Status: ${newCheck.status}. The results have been saved to history.`,
    });

    // Reset state
    setSelectedStoreId("");
    setStoreProducts([]);
    setCheckedProductIds(new Set());
    setIsChecking(false);
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-2">
                <CardTitle>Start a New Check</CardTitle>
                <p className="text-muted-foreground">Select a store to begin checking inventory.</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" disabled={!isChecking}>
                    <Upload className="mr-2" />
                    Import XLSX
                </Button>
                <Button onClick={simulateBarcodeScan} disabled={!isChecking}>
                    <ScanLine className="mr-2" />
                    Simulate Scan
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="w-full max-w-sm">
            <Select onValueChange={handleStoreChange} value={selectedStoreId} disabled={userStores.length <= 1}>
                <SelectTrigger id="store-select">
                    <SelectValue placeholder="Select a store..." />
                </SelectTrigger>
                <SelectContent>
                    {userStores.map(store => (
                        <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        {isChecking && storeProducts.length > 0 && (
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
                            const isChecked = checkedProductIds.has(product.id);
                            const CategoryIcon = categoryIcons[product.category] || categoryIcons.Default;
                            return (
                                <TableRow key={product.id} className={isChecked ? "bg-accent/50" : ""}>
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
                                    <TableCell className="hidden md:table-cell font-mono text-sm">{product.barcode}</TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                          variant={isChecked ? "outline" : "default"} 
                                          size="sm"
                                          onClick={() => handleCheckProduct(product.id)}
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
  );
}
