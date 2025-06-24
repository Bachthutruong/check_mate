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
import { Upload, Camera, CheckCircle2, XCircle, Bot, Shirt, Footprints, Laptop, Gem, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
// import { useZxing } from "react-zxing";
import Barcode from "react-barcode";
import { Skeleton } from "../ui/skeleton";
import * as XLSX from 'xlsx';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

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
  const [checkedProductIds, _setCheckedProductIds] = useState<Set<string>>(new Set());
  
  // Wrapped setCheckedProductIds with localStorage backup and ref sync
  const setCheckedProductIds = (value: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    console.log('🎯 setCheckedProductIds called!');
    console.trace('🎯 Call stack:');
    
    if (typeof value === 'function') {
      _setCheckedProductIds((prev) => {
        const newValue = value(prev);
        console.log('🎯 Function update - prev:', Array.from(prev), 'new:', Array.from(newValue));
        
        // Sync with ref immediately
        checkedProductIdsRef.current = newValue;
        console.log('🔄 Synced with ref:', Array.from(checkedProductIdsRef.current));
        
        // Save to localStorage
        if (selectedStoreId && typeof window !== 'undefined') {
          localStorage.setItem(`checkedItems_${selectedStoreId}`, JSON.stringify(Array.from(newValue)));
          console.log('💾 Saved to localStorage:', Array.from(newValue));
        }
        
        return newValue;
      });
    } else {
      console.log('🎯 Direct update - new value:', Array.from(value));
      
      // Sync with ref immediately
      checkedProductIdsRef.current = value;
      console.log('🔄 Synced with ref:', Array.from(checkedProductIdsRef.current));
      
      // Save to localStorage
      if (selectedStoreId && typeof window !== 'undefined') {
        localStorage.setItem(`checkedItems_${selectedStoreId}`, JSON.stringify(Array.from(value)));
        console.log('💾 Saved to localStorage:', Array.from(value));
      }
      
      _setCheckedProductIds(value);
    }
  };
  const [isChecking, setIsChecking] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string>("");
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const isScanningRef = useRef(false); // Use ref to avoid race conditions
  const lastScannedRef = useRef<string | null>(null); // Prevent duplicate scans
  const isProcessingRef = useRef(false); // Prevent concurrent processing
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce restart
  const checkedProductIdsRef = useRef<Set<string>>(new Set()); // Backup for checked items
  
  // Debug isScanning state changes and sync with ref
  useEffect(() => {
    console.log('🎯 isScanning state changed to:', isScanning);
    isScanningRef.current = isScanning; // Sync ref with state
  }, [isScanning]);
  
  // Detect mobile device
  const isMobile = useMemo(() => {
    if (typeof window !== 'undefined') {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    return false;
  }, []);
  
  const { data: stores, isLoading: storesLoading } = useSWR<Store[]>('/api/stores', fetcher);
  const { data: storeProducts, isLoading: productsLoading, mutate: mutateProducts } = useSWR<Product[]>(selectedStoreId ? `/api/products?storeId=${selectedStoreId}` : null, fetcher);

  const handleScanResult = (scannedCode: string) => {
    console.log('🔍 SCAN RESULT TRIGGERED:', scannedCode);
    
    // Prevent concurrent processing
    if (isProcessingRef.current) {
      console.log('⚠️ Already processing a scan, ignoring:', scannedCode);
      return;
    }
    
    // Prevent duplicate scans of the same barcode
    if (lastScannedRef.current === scannedCode) {
      console.log('⚠️ Duplicate scan ignored:', scannedCode, '- last scanned:', lastScannedRef.current);
      return;
    }
    
    // Set processing flag
    isProcessingRef.current = true;
    lastScannedRef.current = scannedCode;
    
    // Reset duplicate prevention after 1.5 seconds (shorter for continuous scanning)
    setTimeout(() => {
      lastScannedRef.current = null;
      console.log('🔄 Reset lastScanned - ready for same barcode again');
    }, 1500);
    
    if (!storeProducts) {
      console.error('❌ No store products loaded');
      isProcessingRef.current = false; // Reset processing flag
            toast({
                variant: "destructive",
        title: "錯誤",
        description: "尚未載入產品資料",
      });
      return;
    }

    // Filter out QR codes with URLs - only process barcodes
    if (scannedCode.includes('http') || scannedCode.includes('://') || scannedCode.includes('www.')) {
      console.log('🚫 Ignoring QR code URL:', scannedCode);
      isProcessingRef.current = false; // Reset processing flag
      toast({
        title: "QR Code 檢測到",
        description: "請使用商品條碼，不是QR碼",
        duration: 2000,
      });
      return;
    }

    // Only process numeric barcodes (our format)
    const cleanedCode = scannedCode.trim();
    if (!/^[0-9A-Z]{8,15}$/i.test(cleanedCode)) {
      console.log('🚫 Invalid barcode format:', cleanedCode);
      isProcessingRef.current = false; // Reset processing flag
      toast({
        variant: "destructive",
        title: "條碼格式錯誤",
        description: "請掃描有效的產品條碼 (8-15位數字/字母)",
        duration: 3000,
      });
      return;
    }

    // Clean and normalize the scanned code
    const normalizedScannedCode = cleanedCode.toLowerCase();
    
    console.log('=== BARCODE SCAN DEBUG ===');
    console.log('🔍 Original scanned code:', scannedCode);
    console.log('🧹 Cleaned code:', cleanedCode);
    console.log('🔤 Normalized code:', normalizedScannedCode);
    console.log('📦 Total products:', storeProducts.length);
    console.log('📋 ALL product barcodes:', storeProducts.map(p => ({ name: p.name, barcode: p.barcode, id: p._id })));
    console.log('🔒 Current checked IDs:', Array.from(checkedProductIds));
    
    // Try exact match first (with cleaned code)
    let product = storeProducts.find(p => p.barcode === cleanedCode);
    console.log('✓ Exact match result:', product);
    
    // If no exact match, try normalized match
    if (!product) {
      product = storeProducts.find(p => p.barcode?.trim().toLowerCase() === normalizedScannedCode);
      console.log('✓ Normalized match result:', product);
    }
    
    // If still no match, try partial match
    if (!product) {
      product = storeProducts.find(p => p.barcode?.includes(cleanedCode) || cleanedCode.includes(p.barcode || ''));
      console.log('✓ Partial match result:', product);
    }
    
    // Add case-insensitive exact match
    if (!product) {
      product = storeProducts.find(p => p.barcode?.toLowerCase() === normalizedScannedCode);
      console.log('✓ Case-insensitive match result:', product);
    }
    
    console.log('🎯 Final found product:', product);
    
    if (product) {
        console.log('✅ Product found! ID:', product._id, 'Name:', product.name);
        
        if (checkedProductIds.has(product._id!)) {
            console.log('⚠️ Product already checked');
            toast({
                title: "已檢查過",
                description: `${product.name} 已在清單中。`,
            });
        } else {
            console.log('🎉 Adding product to checked list');
            console.log('🎉 Before adding - checked items:', checkedProductIds.size, Array.from(checkedProductIds));
            console.log('🎉 Before adding - ref backup:', checkedProductIdsRef.current.size, Array.from(checkedProductIdsRef.current));
            
            // Create new set from current state OR ref backup (whichever has more items)
            const currentItems = checkedProductIds.size > 0 ? checkedProductIds : checkedProductIdsRef.current;
            const newCheckedIds = new Set(currentItems).add(product._id!);
            
            // Update both state and ref immediately
            checkedProductIdsRef.current = newCheckedIds;
            setCheckedProductIds(newCheckedIds);
            
            console.log('📝 After adding - checked IDs:', Array.from(newCheckedIds));
            console.log('📝 After adding - ref backup:', Array.from(checkedProductIdsRef.current));
            console.log('📝 New set size:', newCheckedIds.size);
            
            toast({
                title: "掃描成功 ✅",
                description: `已檢查: ${product.name}\n正在準備下一次掃描...`,
                duration: 2000,
            });
            console.log('✅ Product checked successfully:', product.name);
        }
        
        // Don't close scanner immediately to allow multiple scans
        // setIsScannerOpen(false);
    } else {
        console.log('❌ Product not found for barcode:', scannedCode);
        
        // Show more detailed error with suggestions
        const similarProducts = storeProducts.filter(p => 
          p.barcode?.includes(scannedCode.slice(0, 5)) || 
          scannedCode.includes(p.barcode?.slice(0, 5) || '')
        ).slice(0, 3);
        
        const suggestions = similarProducts.length > 0 
          ? `\n可能的相似產品: ${similarProducts.map(p => `${p.name} (${p.barcode})`).join(', ')}`
          : '';
          
        toast({
            variant: "destructive",
            title: "找不到產品 ❌",
            description: `此商店中沒有條碼為: ${scannedCode} 的產品${suggestions}`,
            duration: 5000,
        });
        
        console.log('📋 All barcodes in store:', storeProducts.map(p => ({ name: p.name, barcode: p.barcode })));
    }
    
    // Reset processing flag at the end
    setTimeout(() => {
      isProcessingRef.current = false;
      console.log('🏁 Processing completed for:', scannedCode, '- ready for next scan');
      
      // If scanning was restarted during processing, ensure it's still active
      if (isScanningRef.current && !scanIntervalRef.current && !restartTimeoutRef.current) {
        console.log('🔄 Auto-scan should be active but no interval found, restarting...');
        startBarcodeDetection();
      }
    }, 500); // Small delay to prevent immediate re-detection
  };

  const startCamera = async () => {
    try {
    setScannerError("");
      
      // Stop existing stream first
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }

      // Camera constraints for mobile vs desktop
      const constraints = {
        video: isMobile ? {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        } : {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      console.log('Starting camera with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load and play
        return new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          
          const onLoadedMetadata = () => {
            video.play()
              .then(() => {
                console.log('Camera started successfully');
                toast({
                  title: "🎥 相機已啟動",
                  description: "✨ 自動掃描已啟動！將商品條碼放入綠色框內",
                  duration: 4000,
                });
                // Auto-start scanning when camera is ready
                setTimeout(() => {
                  console.log('🎬 Camera ready, starting auto-scan...');
                  console.log('- Current isScanning:', isScanning);
                  console.log('- Has interval:', !!scanIntervalRef.current);
                  
                  // Force start auto-scanning
                  if (!isScanning) {
                    startAutoScanning();
                  } else {
                    console.log('⚠️ Already scanning, restarting...');
                    // Restart if needed
                    setIsScanning(false);
                    setTimeout(() => {
                      startAutoScanning();
                    }, 100);
                  }
                }, 1000); // Faster start
                resolve();
              })
              .catch(reject);
          };
          
          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          video.addEventListener('error', reject, { once: true });
          
          // Timeout after 10 seconds
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', reject);
            reject(new Error('Camera load timeout'));
          }, 10000);
        });
      }
    } catch (error: any) {
      console.error("Camera error:", error);
      setScannerError("相機啟動失敗: " + (error.message || "未知錯誤"));
      
      // Try fallback constraints
      if (error.name === 'OverconstrainedError' || error.name === 'NotReadableError') {
        try {
          console.log('Trying fallback camera constraints...');
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraStream(fallbackStream);
          
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play();
            setScannerError("");
            toast({
              title: "相機已啟動",
              description: "使用預設相機設定",
            });
          }
        } catch (fallbackError: any) {
          console.error("Fallback camera error:", fallbackError);
          setScannerError("無法啟動相機。請檢查相機權限和設備可用性。");
        }
      }
    }
  };

  const handleOpenScanner = async () => {
    setScannerError("");
    setIsInitializingCamera(true);
    
    // Check if media devices are supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScannerError("此瀏覽器不支援相機功能。請使用支援的瀏覽器 (Chrome, Firefox, Safari)。");
      setIsInitializingCamera(false);
      return;
    }
    
    setIsScannerOpen(true);
    
    try {
      await startCamera();
    } catch (error) {
      console.error("Failed to start camera:", error);
    } finally {
      setIsInitializingCamera(false);
    }
  };

  const handleCloseScanner = () => {
    console.log('🚪 Closing scanner - cleaning up all scanning processes');
    
    // Stop auto-scanning
    stopAutoScanning();
    
    // Force clear all intervals and timeouts
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
      console.log('🧹 Force cleared scan interval on close');
    }
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
      console.log('🧹 Force cleared restart timeout on close');
    }
    
    // Stop camera stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScannerOpen(false);
    setScannerError("");
    setIsInitializingCamera(false);
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

  // Helper function to generate automatic barcode (Code 128 format)
  const generateAutoBarcode = (index: number, category: string, productName: string, existingBarcodes: Set<string> = new Set()): string => {
    // Generate simple numeric Code 128 barcode - easier to scan
    const indexPadded = String(index + 1).padStart(3, '0'); // 3 digits for index
    const randomNum = Math.floor(Math.random() * 100000000); // 8 random digits
    const randomPadded = randomNum.toString().padStart(8, '0');
    
    let attempts = 0;
    let barcode: string;
    
    // Simple numeric format: 11 digits total (easier for Code 128 scanning)
    do {
      const suffix = (Math.floor(Math.random() * 100) + attempts).toString().padStart(2, '0');
      barcode = `${indexPadded}${randomPadded.slice(0, 6)}${suffix}`;
      // Ensure exactly 11 digits
      if (barcode.length !== 11) {
        barcode = barcode.padStart(11, '0').slice(0, 11);
      }
      attempts++;
    } while (existingBarcodes.has(barcode) && attempts < 100);
    
    existingBarcodes.add(barcode);
    console.log(`🎯 Generated barcode: ${barcode} (length: ${barcode.length})`);
    return barcode;
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
            let autoGeneratedCount = 0;
            const existingBarcodes = new Set<string>();

            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
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
                let barcode = String(row[2] || '').trim();
                const productName = row[3];
                
                // Auto-generate barcode if empty or invalid
                if (!barcode || barcode === 'undefined' || barcode === 'null' || barcode.length < 3) {
                    barcode = generateAutoBarcode(rowIndex, category || 'PROD', productName || 'Product', existingBarcodes);
                    autoGeneratedCount++;
                    console.log(`🎯 Auto-generated Code 128 barcode for "${productName}": ${barcode}`);
                } else {
                    // Add existing barcode to set to avoid duplicates
                    existingBarcodes.add(barcode);
                }
                
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
                    
                    // Don't reset checked items - preserve what user has already checked
                    // setCheckedProductIds(new Set());
                    
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

            const autoGeneratedMessage = autoGeneratedCount > 0 ? `，其中 ${autoGeneratedCount} 個自動生成 Code 128 條碼` : '';
            toast({
                title: "匯入成功",
                description: `已替換商店產品清單。創建了 ${createdCount} 個新產品${autoGeneratedMessage}，請開始掃描或手動檢查。`,
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
    if(userStores.length === 1 && !selectedStoreId) {
        console.log('🏪 Auto-selecting single store:', userStores[0].name);
        handleStoreChange(userStores[0]._id!);
    }
  }, [userStores, selectedStoreId]);

  // Debug: Log storeProducts when it changes
  useEffect(() => {
    if (storeProducts) {
      console.log('storeProducts updated:', storeProducts);
      console.log('Sample product values:', storeProducts[0]);
    }
  }, [storeProducts]);

  // Debug: Log checkedProductIds when it changes
  useEffect(() => {
    console.log('🔍 checkedProductIds changed:', Array.from(checkedProductIds));
    console.log('🔍 Total checked items:', checkedProductIds.size);
    console.log('🔍 Ref backup has:', checkedProductIdsRef.current.size, 'items');
    
    // If state was reset but ref still has items, restore from ref
    if (checkedProductIds.size === 0 && checkedProductIdsRef.current.size > 0) {
      console.log('🚨 State reset detected! Restoring from ref backup...');
      console.log('🔄 Restoring items:', Array.from(checkedProductIdsRef.current));
      _setCheckedProductIds(new Set(checkedProductIdsRef.current));
      return;
    }
    
    // Update ref to match state (for normal updates)
    if (checkedProductIds.size > 0 || checkedProductIdsRef.current.size === 0) {
      checkedProductIdsRef.current = checkedProductIds;
    }
    
    // Log stack trace to see what caused the change
    if (checkedProductIds.size === 0 && checkedProductIdsRef.current.size === 0) {
      console.log('⚠️ checkedProductIds was reset to 0! Stack trace:');
      console.trace();
    }
  }, [checkedProductIds]);

  // Debug: Log component mount/render
  useEffect(() => {
    console.log('🔄 InventoryCheckClient component mounted/rendered');
    return () => {
      console.log('🔄 InventoryCheckClient component unmounting');
    };
  }, []);

  // Debug: Log selectedStoreId changes
  useEffect(() => {
    console.log('🏪 selectedStoreId changed to:', selectedStoreId);
  }, [selectedStoreId]);

  // Debug: Log isChecking changes
  useEffect(() => {
    console.log('✅ isChecking changed to:', isChecking);
  }, [isChecking]);

  // Restore checked items from localStorage when store changes
  useEffect(() => {
    if (selectedStoreId && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`checkedItems_${selectedStoreId}`);
      if (stored) {
        try {
          const restoredItems = JSON.parse(stored) as string[];
          const restoredSet = new Set<string>(restoredItems);
          console.log('🔄 Restoring checked items from localStorage:', restoredItems);
          
          // Update both state and ref
          checkedProductIdsRef.current = restoredSet;
          _setCheckedProductIds(restoredSet);
        } catch (e) {
          console.warn('Failed to parse stored checked items:', e);
        }
      } else {
        console.log('🔄 No stored items found for store:', selectedStoreId);
        // Clear both state and ref for new store
        checkedProductIdsRef.current = new Set();
        _setCheckedProductIds(new Set());
      }
    }
  }, [selectedStoreId]);

  // Auto-start camera when scanner opens
  useEffect(() => {
    if (isScannerOpen && !cameraStream) {
      startCamera();
    }
  }, [isScannerOpen]);

  // Periodic sync check to ensure state and ref are in sync
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (checkedProductIds.size === 0 && checkedProductIdsRef.current.size > 0) {
        console.log('🔄 Periodic sync: State empty but ref has items, restoring...');
        _setCheckedProductIds(new Set(checkedProductIdsRef.current));
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(syncInterval);
  }, [checkedProductIds]);

  // Auto-scanning functionality  
  const startAutoScanning = () => {
    if (!videoRef.current) {
      console.log('❌ Cannot start scanning: no video element');
      toast({
        variant: "destructive",
        title: "無法開始掃描", 
        description: "相機尚未準備就緒",
      });
      return;
    }
    
    if (!canvasRef.current) {
      console.log('❌ Cannot start scanning: no canvas element');
      toast({
        variant: "destructive",
        title: "無法開始掃描",
        description: "Canvas尚未準備就緒",
      });
      return;
    }
    
    if (isScanning) {
      console.log('⚠️ Scanning already in progress');
      return;
    }
    
    // Clear any existing intervals first
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
      console.log('🧹 Cleared existing scan interval');
    }
    
    console.log('🚀 Starting barcode auto-scanning...');
    console.log('📹 Video element ready:', !!videoRef.current);
    console.log('🖼️ Canvas element ready:', !!canvasRef.current);
    console.log('🎥 Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
    
    // Reset all flags and set scanning state
    isProcessingRef.current = false;
    lastScannedRef.current = null;
    isScanningRef.current = true;
    setIsScanning(true);
    console.log('🔒 Scanning state set to: true, ref set to:', isScanningRef.current);
    console.log('🧹 Reset flags - processing:', isProcessingRef.current, 'lastScanned:', lastScannedRef.current);
    
    toast({
      title: "🚀 自動掃描已啟動",
      description: "將商品條碼對準相機中央，系統會自動識別",
      duration: 3000,
    });
    
    // Try native BarcodeDetector first, then ZXing as backup
    console.log('🔧 Using advanced barcode detection (Native + ZXing)');
    startBarcodeDetection();
  };

  const stopAutoScanning = () => {
    // Stop both state and ref
    isScanningRef.current = false;
    setIsScanning(false);
    
    // Reset processing flags
    isProcessingRef.current = false;
    lastScannedRef.current = null;
    
    // Clear restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    // Clear interval scanning
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Stop ZXing code reader
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
        console.log('🧹 ZXing reader reset');
      } catch (error) {
        console.warn('Error resetting code reader:', error);
      }
    }
    
    console.log('🛑 Stopped auto-scanning - ref:', isScanningRef.current, 'state:', false);
    console.log('🧹 Reset all flags - processing:', isProcessingRef.current, 'lastScanned:', lastScannedRef.current, 'restart:', restartTimeoutRef.current);
    
    toast({
      title: "停止掃描",
      description: "自動掃描已停止",
      duration: 1500,
    });
  };

  const startBarcodeDetection = async () => {
    console.log('🔍 Starting continuous barcode detection...');
    console.log('🔍 isScanningRef.current:', isScanningRef.current);
    console.log('🔍 isScanning state:', isScanning);
    
    // Stop any existing scanning first
    if (scanIntervalRef.current) {
      console.log('🛑 Clearing existing scan interval before starting new detection');
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Force set ref to true and reset processing flags
    isProcessingRef.current = false;
    lastScannedRef.current = null;
    isScanningRef.current = true;
    
    let detectionCount = 0;
    
    // Use the same logic as the test button that works
    const performContinuousDetection = async () => {
      if (!isScanningRef.current || !videoRef.current) {
        console.log('❌ Stopping continuous detection - isScanningRef:', isScanningRef.current, 'video:', !!videoRef.current);
        return;
      }

      detectionCount++;
      
      // Log every 20 detection attempts
      if (detectionCount % 20 === 0) {
        console.log(`🔄 Auto-scan attempt #${detectionCount} | isScanningRef: ${isScanningRef.current} | state: ${isScanning}`);
      }

      try {
        // @ts-ignore - BarcodeDetector is experimental
        if (typeof BarcodeDetector !== 'undefined') {
          // @ts-ignore
          const detector = new BarcodeDetector({
            formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar']
          });
          
          try {
            // @ts-ignore
            const results = await detector.detect(videoRef.current);
            
            if (results.length > 0) {
              const result = results[0];
              
                              if (isScanningRef.current && !isProcessingRef.current) {
                console.log('🎯 Auto-detection success:', result.rawValue, 'Format:', result.format);
                
                // Show success feedback
                toast({
                  title: "✅ 自動掃描成功",
                  description: `檢測到: ${result.rawValue}\n正在準備下一次掃描...`,
                  duration: 2000,
                });
                
                handleScanResult(result.rawValue);
                
                // Restart scanning for next barcode
                restartAutoScanning();
                return;
              } else if (isProcessingRef.current) {
                console.log('⚠️ Detection skipped - already processing:', result.rawValue);
              }
            }
          } catch (detectionError) {
            // Silent failure, continue scanning
            if (detectionCount % 50 === 0) {
              console.log('⚠️ Detection error (continuing):', detectionError);
            }
          }
        }
      } catch (error) {
        // Native API not available, continue with ZXing fallback
        if (detectionCount === 1) {
          console.log('❌ Native BarcodeDetector not available, using backup methods');
        }
      }

      // Continue scanning if still active
      if (isScanningRef.current) {
        setTimeout(performContinuousDetection, 100); // Very fast continuous scanning
      }
    };

    // Start continuous detection immediately
    console.log('🚀 Starting immediate continuous detection...');
    console.log('🔧 Flag status - scanning:', isScanningRef.current, 'processing:', isProcessingRef.current, 'lastScanned:', lastScannedRef.current);
    performContinuousDetection();
    
    // Also start ZXing backup after a delay
    setTimeout(() => {
      if (isScanningRef.current) {
        console.log('🔄 Starting ZXing backup detection...');
        startCanvasScanning();
      }
    }, 1000);
  };

  const startCanvasScanning = () => {
    console.log('🔧 Starting ZXing barcode scanning (backup method)...');
    
    if (!isScanningRef.current) {
      console.log('❌ Cannot start canvas scanning: isScanningRef is false');
      return;
    }
    
    try {
      // Use specialized barcode reader
      const barcodeReader = new BrowserMultiFormatReader();
      
      codeReaderRef.current = barcodeReader;
      
      console.log('🖼️ ZXing backup detection active...');
      console.log('📋 Target: Linear barcodes (Code128, Code39, EAN, UPC)');
      startCanvasPolling(barcodeReader);
      
    } catch (error) {
      console.error('❌ ZXing setup error:', error);
      // Start a simple detection as last resort
      startSimpleDetection();
    }
  };

  // Simple detection method as last resort
  const startSimpleDetection = () => {
    console.log('🔧 Starting simple detection method...');
    
    if (!isScanning) return;
    
    scanIntervalRef.current = setInterval(() => {
      if (!isScanning || !videoRef.current || !canvasRef.current) return;
      
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!ctx || video.videoWidth === 0) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        // Simple barcode detection using QuaggaJS-like approach
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // This is a placeholder - in real implementation you'd use a library like QuaggaJS
        // For now, just log that we're trying to detect
        console.log('🔍 Simple detection attempt...');
        
      } catch (error) {
        console.warn('Simple detection error:', error);
      }
    }, 500);
  };

  const startCanvasPolling = (codeReader: BrowserMultiFormatReader) => {
    console.log('🖼️ Starting ZXing backup detection...');
    console.log('🔍 Current isScanningRef:', isScanningRef.current);
    
    if (!isScanningRef.current) {
      console.log('❌ Cannot start polling: isScanningRef is false');
      return;
    }
    
    // Clear existing interval first to prevent multiple intervals
    if (scanIntervalRef.current) {
      console.log('🧹 Clearing existing ZXing interval before starting new one');
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    let scanAttempts = 0;
    scanIntervalRef.current = setInterval(() => {
      scanAttempts++;
      
      if (!isScanningRef.current) {
        if (scanIntervalRef.current) {
          console.log('🛑 Clearing ZXing backup interval - scan stopped');
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        return;
      }
      
      if (!videoRef.current || !canvasRef.current) {
        console.log('❌ Missing refs, stopping polling');
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        return;
      }

      if (scanAttempts % 20 === 0) { // Less frequent logging for backup method
        console.log(`🔄 ZXing backup attempt #${scanAttempts}`);
      }

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!ctx || video.videoWidth === 0 || video.readyState < 2) {
          return;
        }

        // Simple, fast detection for backup
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        // Simple single-pass detection
        const performSimpleDetection = async () => {
          if (!isScanningRef.current) return;
          
          try {
            const dataURL = canvas.toDataURL('image/jpeg', 0.9); // Faster JPEG
            const img = new Image();
            img.onload = async () => {
              try {
                const result = await codeReader.decodeFromImageElement(img);
                if (result && result.getText()) {
                  if (isScanningRef.current && !isProcessingRef.current) {
                    console.log('🎯 ZXing backup success:', result.getText());
                    console.log('🏷️ Format:', result.getBarcodeFormat());
                    
                    handleScanResult(result.getText());
                    
                    // Restart scanning for next barcode
                    restartAutoScanning();
                    return;
                  } else if (isProcessingRef.current) {
                    console.log('⚠️ ZXing detection skipped - already processing:', result.getText());
                  }
                }
              } catch (error) {
                // Silent failure for backup method
              }
            };
            img.src = dataURL;
          } catch (error) {
            // Silent failure
          }
        };
        
        performSimpleDetection();
        
      } catch (error) {
        // Silent failure for backup method
      }
    }, 300); // Slower polling for backup method
    
    console.log('✅ ZXing backup polling started with interval ID:', scanIntervalRef.current);
  };

  // Fallback method for testing when libraries don't work
  const startSimulatedScanning = () => {
    console.log('Starting simulated scanning for testing...');
    
    scanIntervalRef.current = setInterval(() => {
      if (!isScanning) return;
      
      // Simulate finding a barcode occasionally for testing
      const shouldSimulate = Math.random() < 0.02; // 2% chance per scan
      if (shouldSimulate && storeProducts && storeProducts.length > 0) {
        const randomProduct = storeProducts[Math.floor(Math.random() * storeProducts.length)];
        console.log('🎯 Simulated detection:', randomProduct.barcode, randomProduct.name);
        setIsScanning(false);
        handleScanResult(randomProduct.barcode);
      }
    }, 500);
  };

  const detectBarcodeFromImageData = (imageData: ImageData): string | null => {
    // This is a simplified barcode detection simulation
    // In production, you would use a proper barcode detection library like ZXing
    
    // For demo purposes, simulate finding a barcode occasionally
    const shouldSimulate = Math.random() < 0.05; // 5% chance per scan
    if (shouldSimulate && storeProducts && storeProducts.length > 0) {
      // Return a random barcode from the store's products for demo
      const randomProduct = storeProducts[Math.floor(Math.random() * storeProducts.length)];
      console.log('Simulated barcode detection:', randomProduct.barcode);
      return randomProduct.barcode;
    }
    
    return null;
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);
      
      // Convert to blob and trigger download for user to scan manually
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'barcode-capture.jpg';
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.9);
      
      toast({
        title: "已拍攝",
        description: "圖片已下載，請手動輸入條碼",
      });
    }
  };

  const handleManualBarcodeInput = () => {
    const input = prompt('請輸入條碼 (例如: BCC00036002):');
    if (input && input.trim()) {
      const cleanInput = input.trim();
      console.log('Manual input received:', cleanInput);
      handleScanResult(cleanInput);
    } else if (input !== null) { // User clicked OK but didn't enter anything
      toast({
        variant: "destructive",
        title: "輸入錯誤",
        description: "請輸入有效的條碼",
      });
    }
  };

  const handleShowBarcode = (product: Product) => {
    setSelectedBarcodeProduct(product);
    setShowBarcodeDialog(true);
  };

  // Debounced restart function
  const restartAutoScanning = () => {
    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    // Stop current scanning
    isScanningRef.current = false;
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Restart after delay
    restartTimeoutRef.current = setTimeout(() => {
      if (!isProcessingRef.current) {
        console.log('🔄 Restarting auto-scanning...');
        isScanningRef.current = true;
        setIsScanning(true);
        
        toast({
          title: "🔄 準備下一次掃描",
          description: "自動掃描已重新啟動，請掃描下一個商品",
          duration: 1500,
        });
        
        startBarcodeDetection();
      }
      restartTimeoutRef.current = null;
    }, 1000);
  };

  const showDebugInfo = () => {
    if (!storeProducts) {
      alert('尚未載入產品資料');
      return;
    }
    
    const debugInfo = storeProducts.slice(0, 10).map(p => 
      `${p.name}: ${p.barcode}`
    ).join('\n');
    
    alert(`前 10 個產品的條碼:\n\n${debugInfo}\n\n共 ${storeProducts.length} 個產品`);
    
    // Also log to console for easier copying
    console.log('All product barcodes:', storeProducts.map(p => ({ name: p.name, barcode: p.barcode, id: p._id })));
  };

  const testScanWithFirstProduct = () => {
    if (!storeProducts || storeProducts.length === 0) {
      toast({
        variant: "destructive",
        title: "無法測試",
        description: "尚未載入產品資料",
      });
      return;
    }
    
    const firstProduct = storeProducts[0];
    console.log('🧪 Testing scan with first product:', firstProduct);
    toast({
      title: "測試掃描",
      description: `測試產品: ${firstProduct.name} (${firstProduct.barcode})`,
    });
    handleScanResult(firstProduct.barcode);
  };

  const handleStoreChange = (storeId: string) => {
    console.log('🏪 handleStoreChange called with storeId:', storeId);
    console.log('🏪 Current selectedStoreId:', selectedStoreId);
    console.log('🏪 Current isChecking:', isChecking);
    console.log('🏪 Current checked items:', checkedProductIds.size);
    
    if (isChecking && storeId !== selectedStoreId) {
        toast({
            variant: "destructive",
            title: "無法變更商店",
            description: "請先完成或取消目前的庫存檢查。",
        });
        return;
    }
    
    setSelectedStoreId(storeId);
    if (storeId) {
        // Only reset checked items if switching to a different store
        if (storeId !== selectedStoreId) {
          console.log('🏪 Different store selected, resetting checked items');
          setCheckedProductIds(new Set());
        } else {
          console.log('🏪 Same store, keeping existing checked items');
        }
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

        // Reset state and clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`checkedItems_${selectedStoreId}`);
          console.log('🗑️ Cleared localStorage for completed check');
        }
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
                <Button onClick={handleOpenScanner} disabled={!isChecking || isInitializingCamera}>
                    <Camera className="mr-2" />
                    {isInitializingCamera ? "啟動相機中..." : "掃描條碼"}
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
                 <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                    </span>
                    <span>待檢查 {storeProducts.length - checkedProductIds.size} 項</span>
                    </div>
                    <div className="text-xs bg-blue-50 px-2 py-1 rounded">
                        總計: {storeProducts.length} 產品 | 已檢查: {checkedProductIds.size}
                    </div>
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
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-xs font-mono text-muted-foreground">
                                                {product.barcode}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleShowBarcode(product)}
                                                className="px-2 py-1"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
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
                <DialogTitle>自動掃描條碼 🚀</DialogTitle>
                <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                        <strong>📱 使用說明：</strong>
                        <br />• <strong>自動掃描</strong>：將條碼對準相機即可自動識別
                        <br />• <strong>手動輸入</strong>：直接輸入條碼號碼
                        <br />• <strong>查看產品</strong>：瀏覽商店所有產品條碼
                    </div>
                    
                    {isMobile && (
                        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                            💡 手機提示：如果自動掃描無法使用，請使用「手動輸入」功能
                        </div>
                    )}
                    
                    <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        🎯 掃描目標：對準條碼，保持穩定，等待自動識別
                    </div>
                </div>
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
                            <br />• 使用支援的瀏覽器 (Chrome, Firefox, Safari)
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        <video 
                            ref={videoRef} 
                            id="barcode-scanner-video"
                            className="w-full rounded-lg border"
                            style={{ 
                                minHeight: '300px',
                                maxHeight: '400px',
                                width: '100%',
                                objectFit: 'cover'
                            }}
                            playsInline
                            autoPlay
                            muted
                            webkit-playsinline="true"
                            onLoadedMetadata={() => console.log('📹 Video metadata loaded')}
                            onCanPlay={() => console.log('▶️ Video can play')}
                        />
                        <div className="absolute inset-0 border-2 border-dashed border-green-400 rounded-lg pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-4 border-green-500 rounded-lg bg-green-500/10">
                                <div className="text-sm text-green-600 text-center font-bold mt-2 bg-white/90 rounded px-2 py-1 mx-2">
                                    📱 將條碼放在此處
                                </div>
                                                                    <div className="text-xs text-green-700 text-center mt-1 bg-white/80 rounded px-2 py-1 mx-4">
                                    {restartTimeoutRef.current ? '正在準備下一次掃描...' : '系統會自動識別 • 可連續掃描'}
                                </div>
                                
                                {/* Corner indicators */}
                                <div className="absolute top-0 left-0 w-6 h-6 border-l-4 border-t-4 border-green-500"></div>
                                <div className="absolute top-0 right-0 w-6 h-6 border-r-4 border-t-4 border-green-500"></div>
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-l-4 border-b-4 border-green-500"></div>
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-r-4 border-b-4 border-green-500"></div>
                            </div>
                        </div>
                        {(!videoRef?.current?.srcObject || videoRef?.current?.readyState < 3) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                    <p className="text-sm text-gray-600">正在啟動相機...</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        如果載入過久，請關閉重新開啟
                                    </p>
                        </div>
                    </div>
                )}
                        {(isScanning || isScanningRef.current) && videoRef?.current?.srcObject && (
                            <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg">
                                <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                                <span className="font-medium">🔍 自動掃描中...</span>
                            </div>
                        )}
                        {(isScanning || isScanningRef.current) && videoRef?.current?.srcObject && (
                            <div className="absolute bottom-2 left-2 right-2 text-center">
                                <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                                    <div className="font-medium">🎯 將條碼對準此區域</div>
                                    <div className="text-xs mt-1 text-green-300">
                                        {restartTimeoutRef.current ? '⏳ 正在準備下一次掃描...' : '✨ 系統正在自動識別中... 可連續掃描'}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="absolute bottom-2 left-2 right-2 text-center">
                            <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                                <div className="font-medium">將條碼對準此區域</div>
                                <div className="text-xs mt-1">
                                    已檢查: {checkedProductIds.size} / {storeProducts?.length || 0}
                                </div>
                                <div className="text-xs mt-1 text-yellow-300">
                                    💡 提示：保持穩定，確保條碼清晰可見
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    {cameraStream && (
                        <div className="text-center text-sm text-green-600 font-medium mb-3">
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                相機已就緒 - {isScanning ? '自動掃描中' : '待機模式'}
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        <Button 
                            size="lg"
                            variant={(isScanning || isScanningRef.current) ? "destructive" : "default"} 
                            onClick={(isScanning || isScanningRef.current) ? stopAutoScanning : startAutoScanning}
                            disabled={!cameraStream}
                            className="w-full font-medium"
                        >
                            {(isScanning || isScanningRef.current) ? "🛑 停止自動掃描" : "🚀 開始自動掃描"}
                        </Button>
                        
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleManualBarcodeInput} className="flex-1">
                                ✏️ 手動輸入
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={async () => {
                                    console.log('🧪 Testing native BarcodeDetector...');
                                    try {
                                        // @ts-ignore
                                        if (typeof BarcodeDetector !== 'undefined') {
                                            toast({
                                                title: "Native API 可用",
                                                description: "BarcodeDetector API 已支援",
                                            });
                                            console.log('✅ BarcodeDetector API is supported');
                                            
                                            // Test with current video frame
                                            if (videoRef.current) {
                                                // @ts-ignore
                                                const detector = new BarcodeDetector({
                                                    formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
                                                });
                                                
                                                try {
                                                    // @ts-ignore
                                                    const results = await detector.detect(videoRef.current);
                                                    console.log('🔍 Immediate detection results:', results);
                                                    
                                                    if (results.length > 0) {
                                                        const result = results[0];
                                                        toast({
                                                            title: "檢測成功!",
                                                            description: `發現: ${result.rawValue} (${result.format})`,
                                                        });
                                                        handleScanResult(result.rawValue);
                                                    } else {
                                                        toast({
                                                            title: "未檢測到條碼",
                                                            description: "請將條碼對準相機",
                                                        });
                                                    }
                                                } catch (detectionError) {
                                                    console.error('Detection error:', detectionError);
                                                    toast({
                                                        variant: "destructive",
                                                        title: "檢測錯誤",
                                                        description: "無法檢測當前畫面",
                                                    });
                                                }
                                            }
                                        } else {
                                            toast({
                                                variant: "destructive",
                                                title: "API 不支援",
                                                description: "此瀏覽器不支援 BarcodeDetector",
                                            });
                                        }
                                    } catch (error) {
                                        console.error('BarcodeDetector test error:', error);
                                        toast({
                                            variant: "destructive",
                                            title: "測試失敗",
                                            description: "BarcodeDetector 測試失敗",
                                        });
                                    }
                                }}
                                className="flex-1"
                            >
                                🔬 測試API
                            </Button>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    if (!storeProducts) {
                                        toast({
                                            variant: "destructive",
                                            title: "無產品資料",
                                            description: "請先載入產品",
                                        });
                                        return;
                                    }
                                    console.log('=== ALL STORE PRODUCTS DEBUG ===');
                                    console.log('Total products:', storeProducts.length);
                                    storeProducts.forEach((p, index) => {
                                        console.log(`${index + 1}. ${p.name} | Barcode: ${p.barcode} | ID: ${p._id}`);
                                    });
                                    console.log('=== END DEBUG ===');
                                    
                                    toast({
                                        title: "Debug Info",
                                        description: `已記錄 ${storeProducts.length} 個產品到控制台`,
                                    });
                                }}
                                className="flex-1"
                            >
                                📋 Debug產品
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={testScanWithFirstProduct}
                                className="flex-1"
                            >
                                🧪 測試掃描
                            </Button>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    const testBarcode = prompt('輸入要測試的條碼:');
                                    if (testBarcode && testBarcode.trim()) {
                                        console.log('🧪 Manual test with input:', testBarcode.trim());
                                        handleScanResult(testBarcode.trim());
                                    }
                                }}
                                className="flex-1"
                            >
                                ✏️ 輸入測試
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    console.log('🔄 重新啟動掃描...');
                                    
                                    // Stop current scanning
                                    isScanningRef.current = false;
                                    setIsScanning(false);
                                    
                                    if (scanIntervalRef.current) {
                                        clearInterval(scanIntervalRef.current);
                                        scanIntervalRef.current = null;
                                    }
                                    
                                    // Wait a bit then restart
                                    setTimeout(() => {
                                        if (videoRef.current && canvasRef.current) {
                                            console.log('🔄 Restarting auto-scanning...');
                                            startAutoScanning();
                                        } else {
                                            toast({
                                                variant: "destructive",
                                                title: "無法重新啟動",
                                                description: "相機或Canvas未準備就緒",
                                            });
                                        }
                                    }, 200);
                                }} 
                                className="flex-1"
                            >
                                🔄 重新掃描
                            </Button>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleCloseScanner} className="w-full">
                    關閉掃描器
                </Button>
                </div>
                <canvas 
                    ref={canvasRef} 
                    className="hidden" 
                    width="640" 
                    height="480"
                />
                {/* Debug info */}
                <div className="text-xs text-gray-500 text-center mt-2">
                    Canvas: {canvasRef.current ? '✅' : '❌'} | 
                    Video: {videoRef.current ? '✅' : '❌'} | 
                    Scanning: {isScanning ? '🔴' : '⚪'}
                </div>
            </div>
        </DialogContent>
    </Dialog>
    
    <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent className="sm:max-w-lg max-w-[90vw]">
            <DialogHeader>
                <DialogTitle>條碼顯示</DialogTitle>
                <DialogDescription>
                    {selectedBarcodeProduct && (
                        <div className="space-y-1 text-sm">
                            <div><strong>產品名稱:</strong> {selectedBarcodeProduct.name}</div>
                            <div><strong>類別:</strong> {selectedBarcodeProduct.category}</div>
                            <div><strong>廠牌:</strong> {selectedBarcodeProduct.brand || '未指定'}</div>
                        </div>
                    )}
                </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 w-full">
                {selectedBarcodeProduct && (
                    <div className="flex flex-col items-center w-full">
                        <div className="bg-white p-3 rounded border shadow-sm w-full flex justify-center overflow-hidden">
                            <div className="max-w-full">
                                <Barcode 
                                    value={selectedBarcodeProduct.barcode} 
                                    height={80} 
                                    width={2}
                                    fontSize={10} 
                                    displayValue={true} 
                                    margin={2} 
                                    background="#ffffff"
                                    lineColor="#000000"
                                    format="CODE128"
                                />
                            </div>
                        </div>
                        <div className="mt-3 text-center">
                            <p className="text-sm text-muted-foreground">條碼號碼</p>
                            <p className="font-mono font-bold text-base break-all">{selectedBarcodeProduct.barcode}</p>
                        </div>
                    </div>
                )}
                <Button 
                    variant="outline" 
                    onClick={() => setShowBarcodeDialog(false)}
                    className="w-full"
                >
                    關閉
                </Button>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}

