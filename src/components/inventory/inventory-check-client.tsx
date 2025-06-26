"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import useSWR from 'swr';
import { useAuth } from "@/contexts/auth-context";
import { Product, Store } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Upload, Camera, CheckCircle2, XCircle, Bot, Shirt, Footprints, Laptop, Gem, Eye, Warehouse } from "lucide-react";
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
  // Changed to track quantities instead of just checked status
  const [productQuantities, _setProductQuantities] = useState<Map<string, { scanned: number; total: number }>>(new Map());
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0); // Force re-render counter
  
  // Wrapped setProductQuantities with localStorage backup and ref sync
  const setProductQuantities = (value: Map<string, { scanned: number; total: number }> | ((prev: Map<string, { scanned: number; total: number }>) => Map<string, { scanned: number; total: number }>)) => {
    console.log('🎯 setProductQuantities called!');
    console.trace('🎯 Call stack:');
    
    if (typeof value === 'function') {
      _setProductQuantities((prev) => {
        const newValue = value(prev);
        console.log('🎯 Function update - prev size:', prev.size, 'new size:', newValue.size);
        
        // Sync with ref immediately
        productQuantitiesRef.current = newValue;
        console.log('🔄 Synced with ref size:', productQuantitiesRef.current.size);
        
              // Save to localStorage
      if (selectedStoreId && typeof window !== 'undefined') {
        const serialized = JSON.stringify(Array.from(newValue.entries()));
        localStorage.setItem(`productQuantities_${selectedStoreId}`, serialized);
        console.log('💾 Saved to localStorage');
      }
      
      // Force component re-render
      setForceUpdateCounter(prev => prev + 1);
      console.log('🔄 Forced re-render counter:', forceUpdateCounter + 1);
      
      return newValue;
      });
    } else {
      console.log('🎯 Direct update - new value size:', value.size);
      
      // Sync with ref immediately
      productQuantitiesRef.current = value;
      console.log('🔄 Synced with ref size:', productQuantitiesRef.current.size);
      
      // Save to localStorage
      if (selectedStoreId && typeof window !== 'undefined') {
        const serialized = JSON.stringify(Array.from(value.entries()));
        localStorage.setItem(`productQuantities_${selectedStoreId}`, serialized);
        console.log('💾 Saved to localStorage');
      }
      
      // Force component re-render
      setForceUpdateCounter(prev => prev + 1);
      console.log('🔄 Forced re-render counter (direct):', forceUpdateCounter + 1);
      
      _setProductQuantities(value);
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
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'loading' | 'success' | 'error';
    message: string;
    details?: string;
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
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
  const productQuantitiesRef = useRef<Map<string, { scanned: number; total: number }>>(new Map()); // Backup for quantities
  
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
    console.log('🔍 Current productQuantities state before scan:', Array.from(productQuantities.entries()).slice(0, 3));
    
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
    console.log('🔍 Original scanned code:', JSON.stringify(scannedCode), '(length:', scannedCode.length, ')');
    console.log('🧹 Cleaned code:', JSON.stringify(cleanedCode), '(length:', cleanedCode.length, ')');
    console.log('🔤 Normalized code:', JSON.stringify(normalizedScannedCode), '(length:', normalizedScannedCode.length, ')');
    console.log('📦 Total products:', storeProducts.length);
    
    // Find TST product specifically for comparison
    const tstProduct = storeProducts.find(p => p.name.includes('TST'));
    if (tstProduct) {
      console.log('🎯 TST Product barcode in DB:', JSON.stringify(tstProduct.barcode), '(length:', tstProduct.barcode?.length || 0, ')');
      console.log('🔍 Does scanned match TST?', {
        exact: cleanedCode === tstProduct.barcode,
        normalized: normalizedScannedCode === tstProduct.barcode?.toLowerCase(),
        includes: cleanedCode.includes(tstProduct.barcode || '') || (tstProduct.barcode || '').includes(cleanedCode)
      });
    }
    
    console.log('🔒 Current quantities:', Array.from(productQuantities.entries()).slice(0, 3));
    
    // Try exact match first (with cleaned code)
    let product = storeProducts.find(p => p.barcode === cleanedCode);
    console.log('✓ Exact match result:', product?.name || 'NOT FOUND');
    
    // If no exact match, try normalized match
    if (!product) {
      product = storeProducts.find(p => p.barcode?.trim().toLowerCase() === normalizedScannedCode);
      console.log('✓ Normalized match result:', product?.name || 'NOT FOUND');
    }
    
    // If still no match, try partial match
    if (!product) {
      product = storeProducts.find(p => p.barcode?.includes(cleanedCode) || cleanedCode.includes(p.barcode || ''));
      console.log('✓ Partial match result:', product?.name || 'NOT FOUND');
    }
    
    // Add case-insensitive exact match
    if (!product) {
      product = storeProducts.find(p => p.barcode?.toLowerCase() === normalizedScannedCode);
      console.log('✓ Case-insensitive match result:', product?.name || 'NOT FOUND');
    }
    
    // Show detailed comparison for debugging
    console.log('🔍 DETAILED BARCODE COMPARISON:');
    storeProducts.slice(0, 5).forEach((p, index) => {
      console.log(`${index + 1}. ${p.name.substring(0, 30)}...`);
      console.log(`   DB Barcode: ${JSON.stringify(p.barcode)} (${p.barcode?.length || 0} chars)`);
      console.log(`   Scanned:    ${JSON.stringify(cleanedCode)} (${cleanedCode.length} chars)`);
      console.log(`   Match: ${p.barcode === cleanedCode ? '✅' : '❌'}`);
    });
    
    // If still not found, try to find similar ones
    if (!product) {
      const similarProducts = storeProducts.filter(p => {
        const barcode = p.barcode || '';
        return barcode.includes(cleanedCode.substring(0, 5)) || 
               cleanedCode.includes(barcode.substring(0, 5)) ||
               barcode.toLowerCase().includes(normalizedScannedCode.substring(0, 5));
      });
      console.log('🔍 Similar products found:', similarProducts.map(p => ({ name: p.name, barcode: p.barcode })));
    }
    
    console.log('🎯 Final found product:', product);
    
    if (product) {
        console.log('✅ Product found! ID:', product._id, 'Name:', product.name);
        console.log('📊 Product computerInventory:', product.computerInventory);
        console.log('📊 Product barcode:', product.barcode);
        console.log('📊 Scanned code vs product barcode:', { scanned: scannedCode, product: product.barcode, match: scannedCode === product.barcode });
        
        // Get current quantity info with better default handling - use ref for most current value
        let currentQuantity = productQuantitiesRef.current.get(product._id!) || productQuantities.get(product._id!);
        
        if (!currentQuantity) {
            // Create default quantity if not exists
            const defaultTotal = Math.max(product.computerInventory || 20, 1);
            currentQuantity = { scanned: 0, total: defaultTotal };
            console.log('🆕 Creating new quantity entry:', currentQuantity);
        }
        
        console.log('📋 Current quantity (from ref):', currentQuantity);
        
        if (currentQuantity.scanned >= currentQuantity.total) {
            console.log('⚠️ Product already fully scanned');
            toast({
                title: "已完成掃描",
                description: `${product.name} 已完成所有數量掃描 (${currentQuantity.scanned}/${currentQuantity.total})`,
            });
        } else {
            console.log('🎉 Scanning product, incrementing quantity');
            console.log('🎉 Before scan - current:', currentQuantity.scanned, 'total:', currentQuantity.total);
            
            // Increment scanned count
            const newQuantity = { 
                scanned: currentQuantity.scanned + 1, 
                total: currentQuantity.total 
            };
            
            console.log('🔄 Calculated new quantity:', newQuantity);
            
            // Update ref immediately to prevent race conditions
            productQuantitiesRef.current.set(product._id!, newQuantity);
            console.log('🔧 Updated ref immediately:', newQuantity);
            
            // Update state for UI re-render
            setProductQuantities(prev => {
                const newMap = new Map(prev);
                newMap.set(product._id!, newQuantity);
                console.log('💾 Updated state map for product:', product._id, newQuantity);
                return newMap;
            });
            
            console.log('📝 After scan - new quantity should be:', newQuantity);
            
            // Verify the map was actually updated
            setTimeout(() => {
                const verifyQuantity = productQuantities.get(product._id!);
                console.log('🔍 VERIFICATION: After 100ms, map shows quantity as:', verifyQuantity);
                console.log('🔍 VERIFICATION: Expected vs Actual:', { expected: newQuantity, actual: verifyQuantity });
            }, 100);
            
            const isFullyScanned = newQuantity.scanned >= newQuantity.total;
            
            const remaining = newQuantity.total - newQuantity.scanned;
            
            // Check for similar products but don't show alert (just log for debugging)
            const similarProducts = storeProducts.filter(p => 
                p._id !== product._id && 
                p.barcode && 
                Math.abs(p.barcode.length - product.barcode.length) <= 1 &&
                (p.barcode.substring(0, product.barcode.length - 1) === product.barcode.substring(0, product.barcode.length - 1))
            );
            
            let warningMessage = '';
            if (similarProducts.length > 0) {
                warningMessage = `\n⚠️ 注意：還有 ${similarProducts.length} 個相似條碼的產品！\n請確認掃描的是正確的產品`;
                console.log('⚠️ SIMILAR PRODUCTS WARNING:', similarProducts.map(p => ({ name: p.name, barcode: p.barcode })));
            }
            
            toast({
                title: isFullyScanned ? "掃描完成 ✅" : "掃描成功 ✅",
                description: `🏷️ 產品: ${product.name}\n📊 條碼: ${product.barcode}\n📊 已掃描: ${newQuantity.scanned}/${newQuantity.total}\n🎯 還需掃描: ${remaining} 個${isFullyScanned ? '\n🎉 全部完成!' : ''}${warningMessage}\n正在準備下一次掃描...`,
                duration: 4000,
            });
                                                    console.log('✅ Product scanned successfully:', product.name, `(${newQuantity.scanned}/${newQuantity.total})`);
            console.log(`📊 LOGIC EXPLANATION: 
- 產品總數: ${newQuantity.total} 個
- 已掃描: ${newQuantity.scanned} 個  
- 還需掃描: ${newQuantity.total - newQuantity.scanned} 個
- 完成率: ${Math.round((newQuantity.scanned / newQuantity.total) * 100)}%`);

            // Scroll to and highlight the updated product in table
            setTimeout(() => {
                const productElements = document.querySelectorAll(`[data-product-id="${product._id}"]`);
                if (productElements.length > 0) {
                    const element = productElements[0] as HTMLElement;
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Flash highlight effect
                    element.style.transition = 'all 0.3s ease';
                    element.style.backgroundColor = '#22c55e';
                    element.style.transform = 'scale(1.02)';
                    
                    setTimeout(() => {
                        element.style.backgroundColor = '';
                        element.style.transform = '';
                    }, 1000);
                }
            }, 500);
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

      // Optimized camera constraints for better rear camera support on mobile
      const constraints = {
        video: isMobile ? {
          facingMode: { exact: 'environment' }, // Force rear camera
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          focusMode: { ideal: 'continuous' },
          exposureMode: { ideal: 'continuous' },
          whiteBalanceMode: { ideal: 'continuous' },
          zoom: { ideal: 1.0 }
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
      
      // Try fallback constraints for mobile devices
      if (error.name === 'OverconstrainedError' || error.name === 'NotReadableError') {
        try {
          console.log('Trying fallback camera constraints...');
          // Fallback for mobile devices if exact rear camera fails
          const fallbackConstraints = isMobile ? {
            video: {
              facingMode: { ideal: 'environment' }, // Use ideal instead of exact
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          } : { video: true };
          
          const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
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
    if (!file || !storeProducts || !selectedStoreId) {
      toast({
        variant: "destructive",
        title: "錯誤",
        description: "請先選擇商店",
      });
      return;
    }

    // Get current store name
    const currentStore = stores?.find(s => s._id === selectedStoreId);
    if (!currentStore) {
      toast({
        variant: "destructive",
        title: "錯誤", 
        description: "找不到選中的商店資訊",
      });
      return;
    }

    // Show loading dialog
    setIsImporting(true);
    setShowImportDialog(true);
    setImportStatus({
      type: 'loading',
      message: '正在讀取和處理Excel文件...',
      details: '請稍候，系統正在分析文件內容'
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            setImportStatus({
              type: 'loading',
              message: '正在解析Excel數據...',
              details: '正在讀取工作表內容'
            });

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
            let skippedCount = 0;
            let processedRows = 0;
            const existingBarcodes = new Set<string>();

            setImportStatus({
              type: 'loading',
              message: '正在過濾產品數據...',
              details: `找到 ${rows.length} 行數據，正在處理中...`
            });

            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                if (!row || row.length === 0) continue;
                
                processedRows++;
                
                // Updated Excel format mapping with store name at the beginning:
                // 0: 店名 (Store Name) - NEW COLUMN
                // 1: 大類 (Category)
                // 2: 廠牌 (Brand)
                // 3: 商品編號 (Product Code/Barcode)
                // 4: 商品名稱 (Product Name)
                // 5: 成本 (Cost)
                // 6: 電腦庫存 (Computer Inventory)
                // 7: 實際庫存 (Actual Inventory)
                // 8: 差異數量 (Difference Quantity)
                // 9: 差異金額 (Difference Amount)
                // 10: 備註 (Notes)
                
                const storeName = String(row[0] || '').trim();
                const category = row[1];
                const brand = row[2];
                let barcode = String(row[3] || '').trim();
                const productName = row[4];
                
                // Update progress every 50 rows
                if (processedRows % 50 === 0) {
                  setImportStatus({
                    type: 'loading',
                    message: '正在處理產品數據...',
                    details: `已處理 ${processedRows}/${rows.length} 行 (${Math.round(processedRows/rows.length*100)}%)`
                  });
                  await new Promise(resolve => setTimeout(resolve, 10)); // Allow UI update
                }

                // Filter by store name - only process products for current store
                if (!storeName || storeName.toLowerCase() !== currentStore.name.toLowerCase()) {
                  skippedCount++;
                  console.log(`跳過產品 ${productName || 'Unknown'} - 店名不匹配: "${storeName}" vs "${currentStore.name}"`);
                  continue;
                }

                console.log(`✅ 處理產品 ${productName || 'Unknown'} - 店名匹配: "${storeName}"`);
                
                // Auto-generate barcode if empty or invalid
                if (!barcode || barcode === 'undefined' || barcode === 'null' || barcode.length < 3) {
                    barcode = generateAutoBarcode(rowIndex, category || 'PROD', productName || 'Product', existingBarcodes);
                    autoGeneratedCount++;
                    console.log(`🎯 Auto-generated Code 128 barcode for "${productName}": ${barcode}`);
                } else {
                    // Add existing barcode to set to avoid duplicates
                    existingBarcodes.add(barcode);
                }
                
                // Better number parsing (updated indices)
                const cost = parseExcelNumber(row[5]);
                const computerInventory = parseExcelNumber(row[6]);
                const actualInventory = parseExcelNumber(row[7]);
                const differenceQuantity = parseExcelNumber(row[8]);
                const differenceAmount = parseExcelNumber(row[9]);
                const notes = row[10] || '';
                


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
                    setImportStatus({
                      type: 'loading',
                      message: '正在保存產品到數據庫...',
                      details: `準備保存 ${newProducts.length} 個產品到 ${currentStore.name}`
                    });

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
                        throw new Error(`API返回錯誤: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    createdCount = result.created || 0;
                    
                    console.log('API response result:', result);
                    console.log('API created products sample:', result.createdProducts?.[0]);
                    
                    setImportStatus({
                      type: 'loading',
                      message: '正在刷新產品列表...',
                      details: '更新界面顯示'
                    });

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
                    setImportStatus({
                      type: 'error',
                      message: '保存產品失敗',
                      details: `錯誤詳情: ${error instanceof Error ? error.message : '未知錯誤'}\n請檢查網絡連接或聯繫技術支持。`
                    });
                    return;
                }
            }

            if (newProducts.length === 0) {
                const noMatchMessage = skippedCount > 0 
                  ? `Excel文件中有 ${skippedCount} 個產品，但沒有任何產品屬於商店 "${currentStore.name}"`
                  : "Excel文件中沒有有效的產品資料";
                
                setImportStatus({
                  type: 'error',
                  message: '沒有找到匹配的產品',
                  details: `${noMatchMessage}\n\n請確保:\n• Excel文件第一列為店名，且與選中的商店名稱完全一致\n• 檔案格式正確\n• 產品資料完整`
                });
                return;
            }

            // Success message with detailed statistics
            const autoGeneratedMessage = autoGeneratedCount > 0 ? `\n• 自動生成條碼: ${autoGeneratedCount} 個` : '';
            const skippedMessage = skippedCount > 0 ? `\n• 跳過其他商店產品: ${skippedCount} 個` : '';
            
            setImportStatus({
              type: 'success',
              message: '產品匯入成功！',
              details: `✅ 匯入統計:\n• 商店: ${currentStore.name}\n• 成功創建產品: ${createdCount} 個${autoGeneratedMessage}${skippedMessage}\n• 總處理行數: ${processedRows}\n\n現在可以開始掃描或手動檢查產品。`
            });

        } catch (error) {
            console.error("Error processing XLSX file:", error);
            setImportStatus({
              type: 'error',
              message: '文件處理錯誤',
              details: `無法讀取Excel文件。\n\n錯誤詳情: ${error instanceof Error ? error.message : '未知錯誤'}\n\n請確保:\n• 文件為有效的Excel格式(.xlsx/.xls)\n• 文件沒有被其他程序占用\n• 文件結構符合要求`
            });
        } finally {
            setIsImporting(false);
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

  // Debug: Log productQuantities when it changes
  useEffect(() => {
    console.log('🔍 productQuantities changed:', Array.from(productQuantities.entries()));
    console.log('🔍 Total products with quantities:', productQuantities.size);
    console.log('🔍 Ref backup has:', productQuantitiesRef.current.size, 'items');
    console.log('🔍 Force update counter:', forceUpdateCounter);
    
    // If state was reset but ref still has items, restore from ref
    if (productQuantities.size === 0 && productQuantitiesRef.current.size > 0) {
      console.log('🚨 State reset detected! Restoring from ref backup...');
      console.log('🔄 Restoring items:', Array.from(productQuantitiesRef.current.entries()));
      _setProductQuantities(new Map(productQuantitiesRef.current));
      return;
    }
    
    // Update ref to match state (for normal updates)
    if (productQuantities.size > 0 || productQuantitiesRef.current.size === 0) {
      productQuantitiesRef.current = productQuantities;
    }
    
    // Log stack trace to see what caused the change
    if (productQuantities.size === 0 && productQuantitiesRef.current.size === 0) {
      console.log('⚠️ productQuantities was reset to 0! Stack trace:');
      console.trace();
    }
  }, [productQuantities, forceUpdateCounter]);

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

  // Restore product quantities from localStorage when store changes and initialize from products
  useEffect(() => {
    if (selectedStoreId && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`productQuantities_${selectedStoreId}`);
      if (stored) {
        try {
          const restoredEntries = JSON.parse(stored) as [string, { scanned: number; total: number }][];
          const restoredMap = new Map<string, { scanned: number; total: number }>(restoredEntries);
          console.log('🔄 Restoring product quantities from localStorage:', restoredEntries);
          
          // Update both state and ref
          productQuantitiesRef.current = restoredMap;
          _setProductQuantities(restoredMap);
        } catch (e) {
          console.warn('Failed to parse stored product quantities:', e);
        }
      } else {
        console.log('🔄 No stored quantities found for store:', selectedStoreId);
        // Initialize empty map for new store
        productQuantitiesRef.current = new Map();
        _setProductQuantities(new Map());
      }
    }
  }, [selectedStoreId]);

  // Initialize product quantities when storeProducts change
  useEffect(() => {
    if (storeProducts && storeProducts.length > 0) {
      console.log('🔄 Initializing product quantities for', storeProducts.length, 'products');
      
      setProductQuantities(prev => {
        const newMap = new Map(prev);
        
        // Initialize any new products that don't have quantities yet
        storeProducts.forEach(product => {
          if (!newMap.has(product._id!)) {
            const total = Math.max(product.computerInventory || 20, 1); // Use 20 as default if computerInventory is 0 or null
            const quantity = { scanned: 0, total };
            
            console.log(`📦 Initializing ${product.name} with quantity:`, quantity, `(computerInventory: ${product.computerInventory})`);
            newMap.set(product._id!, quantity);
          } else {
            console.log(`✅ ${product.name} already has quantity:`, newMap.get(product._id!));
          }
        });
        
        console.log('📊 Total quantities initialized:', newMap.size);
        return newMap;
      });
    }
  }, [storeProducts]);

  // Auto-start camera when scanner opens
  useEffect(() => {
    if (isScannerOpen && !cameraStream) {
      startCamera();
    }
  }, [isScannerOpen]);

  // Periodic sync check to ensure state and ref are in sync
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (productQuantities.size === 0 && productQuantitiesRef.current.size > 0) {
        console.log('🔄 Periodic sync: State empty but ref has items, restoring...');
        _setProductQuantities(new Map(productQuantitiesRef.current));
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(syncInterval);
  }, [productQuantities]);

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
      title: "開始掃描",
      description: "將條碼對準相機",
      duration: 2000,
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
      duration: 1000,
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
                  title: "掃描成功",
                  description: `檢測到: ${result.rawValue}`,
                  duration: 1500,
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
          title: "準備下一次掃描",
          duration: 1000,
        });
        
        startBarcodeDetection();
      }
      restartTimeoutRef.current = null;
    }, 1000);
  };



  const handleStoreChange = (storeId: string) => {
    console.log('🏪 handleStoreChange called with storeId:', storeId);
    console.log('🏪 Current selectedStoreId:', selectedStoreId);
    console.log('🏪 Current isChecking:', isChecking);
    console.log('🏪 Current product quantities:', productQuantities.size);
    
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
        // Only reset quantities if switching to a different store
        if (storeId !== selectedStoreId) {
          console.log('🏪 Different store selected, resetting quantities');
          setProductQuantities(new Map());
        } else {
          console.log('🏪 Same store, keeping existing quantities');
        }
        setIsChecking(true);
    } else {
        setIsChecking(false);
    }
  };

  const handleCheckProduct = (productId: string) => {
    setProductQuantities(prev => {
      const newMap = new Map(prev);
      const currentQuantity = newMap.get(productId) || { scanned: 0, total: 1 };
      
      if (currentQuantity.scanned > 0) {
        // Reset to 0 if already scanned
        newMap.set(productId, { ...currentQuantity, scanned: 0 });
      } else {
        // Mark as fully scanned
        newMap.set(productId, { ...currentQuantity, scanned: currentQuantity.total });
      }
      return newMap;
    });
  };
  
  const categories = useMemo(() => {
    if (!storeProducts) return [];
    const cats = new Set(storeProducts.map(p => p.category));
    return ["All", ...Array.from(cats)];
  }, [storeProducts]);

  // Calculate category statistics
  const getCategoryStats = useMemo(() => {
    if (!storeProducts) return {};
    
    const stats: Record<string, { unchecked: number; total: number }> = {};
    
    categories.forEach(category => {
      const categoryProducts = category === 'All' 
        ? storeProducts 
        : storeProducts.filter(p => p.category === category);
      
      const unchecked = categoryProducts.filter(p => {
        const quantity = productQuantities.get(p._id!) || { scanned: 0, total: p.computerInventory || 1 };
        return quantity.scanned < quantity.total;
      }).length;
      
      stats[category] = {
        unchecked,
        total: categoryProducts.length
      };
    });
    
    return stats;
  }, [categories, storeProducts, productQuantities, forceUpdateCounter]);

  const completeCheck = async () => {
    if (!user || !selectedStoreId || !storeProducts) return;
    
    // Calculate which products are fully scanned vs missing/incomplete
    const fullyScannedIds = new Set<string>();
    const incompleteItems: any[] = [];
    
    storeProducts.forEach(product => {
      const quantity = productQuantities.get(product._id!) || { scanned: 0, total: product.computerInventory || 1 };
      if (quantity.scanned >= quantity.total) {
        fullyScannedIds.add(product._id!);
      } else {
        incompleteItems.push({
          ...product,
          scannedQuantity: quantity.scanned,
          totalQuantity: quantity.total,
          missingQuantity: quantity.total - quantity.scanned
        });
      }
    });

    const newCheck = {
      storeId: selectedStoreId,
      storeName: stores?.find(s => s._id === selectedStoreId)?.name || 'Unknown Store',
      employeeName: user.name,
      checkedItems: Array.from(fullyScannedIds),
      missingItems: incompleteItems.map(item => item._id!),
      productQuantities: Array.from(productQuantities.entries()),
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
          localStorage.removeItem(`productQuantities_${selectedStoreId}`);
          console.log('🗑️ Cleared localStorage for completed check');
        }
        setSelectedStoreId("");
        setProductQuantities(new Map());
        setIsChecking(false);

    } catch (error: any) {
        toast({ variant: "destructive", title: "錯誤", description: error.message });
    }
  };

  if (!user || storesLoading) return <Skeleton className="w-full h-96" />;

  return (
    <>
    <Card>
      <CardHeader className="px-3 sm:px-6 pb-3 sm:pb-6">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-1 sm:gap-2">
                <CardTitle className="text-lg sm:text-xl">開始新的檢查</CardTitle>
                <p className="text-sm text-muted-foreground">選擇一個商店開始檢查庫存。</p>
            </div>
            <div className="flex gap-2 flex-wrap">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    accept=".xlsx, .xls"
                    className="hidden"
                />
                <Button 
                    variant="outline" 
                    size="sm"
                    disabled={!isChecking || isImporting} 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs sm:text-sm h-8 sm:h-9"
                >
                    {isImporting ? (
                        <>
                            <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-current mr-1 sm:mr-2"></div>
                            <span className="hidden sm:inline">匯入中...</span>
                            <span className="sm:hidden">匯入</span>
                        </>
                    ) : (
                        <>
                            <Upload className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">匯入 Excel</span>
                            <span className="sm:hidden">匯入</span>
                        </>
                    )}
                </Button>
                <Button 
                    onClick={handleOpenScanner} 
                    disabled={!isChecking || isInitializingCamera}
                    size="sm"
                    className="text-xs sm:text-sm h-8 sm:h-9"
                >
                    <Camera className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{isInitializingCamera ? "啟動相機中..." : "掃描條碼"}</span>
                    <span className="sm:hidden">{isInitializingCamera ? "啟動" : "掃描"}</span>
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
        {/* Store Selection Badges */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-semibold">選擇商店</h3>
            <div className="text-xs bg-gray-50 px-2 py-1 rounded border w-fit">
              總共 {userStores.length} 個商店
            </div>
          </div>
          
          {/* Store Badges - Flex Wrap Layout */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
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
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md ring-1 ring-blue-300' 
                        : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300 hover:border-blue-400'
                      }
                      ${userStores.length <= 1 && isChecking && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {/* Store Icon */}
                    <Warehouse className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${
                      isSelected ? 'text-white' : 'text-blue-600'
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
                        : 'bg-blue-100 text-blue-800'
                      }
                    `}>
                      {isSelected ? '已選' : '選擇'}
                    </div>
                  </Badge>
                  
                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute -top-0.5 -right-0.5 z-10">
                      <div className="bg-green-500 text-white rounded-full p-0.5">
                        <CheckCircle2 className="h-2 w-2 sm:h-3 sm:w-3" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isChecking && productsLoading && <Skeleton className="w-full h-64" />}
        {isChecking && !productsLoading && storeProducts && (
          <div className="w-full">
            {/* Category Filter Tags */}
            <div className="space-y-3 mb-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-base sm:text-lg font-semibold">產品類別篩選</h3>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                    </span>
                    <span className="text-xs sm:text-sm">待完成 {getCategoryStats[selectedCategory]?.unchecked || 0} 項</span>
                  </div>
                  <div className="text-xs bg-blue-50 px-2 py-1 rounded border inline-block w-fit">
                    總計: {getCategoryStats[selectedCategory]?.total || 0} | 已完成: {(getCategoryStats[selectedCategory]?.total || 0) - (getCategoryStats[selectedCategory]?.unchecked || 0)}
                  </div>
                </div>
              </div>
              
              {/* Category Tags - Mobile Optimized */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {categories.map(category => {
                    const stats = getCategoryStats[category] || { unchecked: 0, total: 0 };
                    const isSelected = selectedCategory === category;
                    const isCompleted = stats.unchecked === 0 && stats.total > 0;
                    
                    return (
                      <div
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className="relative cursor-pointer group"
                      >
                        <Badge
                          variant={isSelected ? "default" : "secondary"}
                          className={`
                            flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium 
                            transition-colors duration-200 
                            min-h-[28px] sm:min-h-[36px] select-none text-center
                            ${isSelected 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md ring-1 ring-blue-300' 
                              : isCompleted 
                                ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300' 
                                : stats.unchecked > 0 
                                  ? 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
                            }
                          `}
                        >
                          {/* Icon - Hidden on very small screens */}
                          <div className="hidden xs:block">
                            {React.createElement(
                              categoryIcons[category] || categoryIcons.Default,
                              { 
                                className: `h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${
                                  isSelected ? 'text-white' : 
                                  isCompleted ? 'text-green-600' : 
                                  stats.unchecked > 0 ? 'text-orange-600' : 
                                  'text-gray-500'
                                }`
                              }
                            )}
                          </div>
                          
                          {/* Category Name - Full display */}
                          <span className="font-medium">
                            {category === 'All' ? '全部' : category}
                          </span>
                          
                          {/* Count Badge */}
                          <div className={`
                            px-1.5 py-0.5 sm:px-2 rounded-full text-[10px] sm:text-xs font-bold 
                            min-w-[16px] sm:min-w-[20px] text-center
                            ${isSelected 
                              ? 'bg-white/20 text-white' 
                              : isCompleted 
                                ? 'bg-green-200 text-green-800' 
                                : stats.unchecked > 0 
                                  ? 'bg-orange-200 text-orange-800'
                                  : 'bg-gray-200 text-gray-600'
                            }
                          `}>
                            {stats.unchecked > 0 ? stats.unchecked : stats.total}
                          </div>
                        </Badge>
                        
                        {/* Status Indicator - Smaller on mobile */}
                        {isCompleted && !isSelected && (
                          <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 z-10">
                            <div className="bg-green-500 text-white rounded-full p-0.5">
                              <CheckCircle2 className="h-2 w-2 sm:h-3 sm:w-3" />
                            </div>
                          </div>
                        )}
                        
                        {/* Count Indicator - Show checked/total */}
                        {stats.total > 0 && !isSelected && (
                          <div className="absolute -top-0.5 -left-0.5 sm:-top-1 sm:-left-1 z-10">
                            <div className={`text-white text-[7px] sm:text-[8px] rounded-full min-w-[16px] h-3 sm:min-w-[20px] sm:h-4 flex items-center justify-center font-bold px-1 ${
                              stats.unchecked === 0 ? 'bg-green-500' : 'bg-blue-500'
                            }`}>
                              {stats.total - stats.unchecked}/{stats.total}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                

              </div>
            </div>
            
            {/* Products Table */}
            <div className="w-full">
                <div className="rounded-md border overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ maxWidth: '90vw' }}>
                    <Table className="w-full table-fixed min-w-[750px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px] text-xs">狀態</TableHead>
                                <TableHead className="w-[140px] text-xs whitespace-nowrap">大類</TableHead>
                                <TableHead className="w-[140px] text-xs whitespace-nowrap">商品編號</TableHead>
                                <TableHead className="w-[250px] text-xs">商品名稱</TableHead>
                                <TableHead className="w-[80px] text-xs whitespace-nowrap">電腦庫存</TableHead>
                                <TableHead className="w-[100px] text-right text-xs">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                          {storeProducts.filter(p => selectedCategory === 'All' || p.category === selectedCategory).map((product, index) => {
                            const quantity = productQuantities.get(product._id!) || { scanned: 0, total: product.computerInventory || 1 };
                            const isFullyScanned = quantity.scanned >= quantity.total;
                            const CategoryIcon = categoryIcons[product.category] || categoryIcons.Default;
                            
                            // Debug logging for each product - only log first few for performance
                            if (index < 3) {
                              console.log(`🔍 Table row ${index}: ${product.name} | ID: ${product._id} | Quantity from map:`, quantity, `| Map has entry:`, productQuantities.has(product._id!), `| Total map size:`, productQuantities.size, `| forceUpdateCounter:`, forceUpdateCounter);
                            }
                            
                            return (
                                <TableRow 
                                    key={product._id} 
                                    data-product-id={product._id}
                                    className={`${
                                        isFullyScanned ? "bg-green-50 border-green-200" : 
                                        quantity.scanned > 0 ? "bg-blue-50 border-blue-200" : 
                                        "hover:bg-gray-50"
                                    } [&>td]:py-3`}>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant={isFullyScanned ? "default" : "secondary"} className="text-xs whitespace-nowrap w-fit">
                                              {isFullyScanned ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                              {isFullyScanned ? '已完成' : '進行中'}
                                            </Badge>
                                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                                                <div className="font-medium text-blue-600">
                                                    已掃: {quantity.scanned}/{quantity.total}
                                                </div>
                                                <div className="text-green-600">
                                                    還需: {quantity.total - quantity.scanned}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 whitespace-nowrap">
                                            <CategoryIcon className="h-3 w-3 text-muted-foreground flex-shrink-0"/>
                                            <span className="text-xs">{product.category}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 whitespace-nowrap">
                                            <span className="text-xs font-mono text-muted-foreground">
                                                {product.barcode}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleShowBarcode(product)}
                                                className="px-1 py-1 h-6 w-6 flex-shrink-0"
                                            >
                                                <Eye className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <div className="text-xs font-medium" title={product.name}>
                                                {product.name}
                                            </div>
                                            {/* Brand badge for all devices */}
                                            {product.brand && (
                                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-gray-50">
                                                    {product.brand}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <span className={`text-xs font-medium ${(product.computerInventory || 0) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                            {Number(product.computerInventory || 0).toLocaleString('zh-TW')}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col gap-1 items-end">
                                            <Button 
                                              variant={isFullyScanned ? "outline" : "default"} 
                                              size="sm"
                                              className="text-xs px-3 py-1.5 min-w-[60px]"
                                              onClick={() => handleCheckProduct(product._id!)}
                                            >
                                              {isFullyScanned ? '重設' : '完成'}
                                            </Button>
                                            {!isFullyScanned && quantity.scanned > 0 && (
                                                <div className="text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    剩餘: {quantity.total - quantity.scanned}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                          })}
                                </TableBody>
                    </Table>
                </div>
            </div>
          </div>
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
                <div className="text-sm text-muted-foreground">
                    將條碼對準相機中央，系統會自動識別
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
                            
                        />
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-4 border-green-500 rounded-lg bg-green-500/10">
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
                                    <p className="text-sm text-gray-600">啟動相機中...</p>
                                </div>
                            </div>
                        )}
                        {(isScanning || isScanningRef.current) && videoRef?.current?.srcObject && (
                            <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg">
                                <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                                <span className="font-medium">掃描中</span>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex flex-col gap-2">

                    
                    <div className="space-y-3">
                        <Button 
                            size="lg"
                            variant={(isScanning || isScanningRef.current) ? "destructive" : "default"} 
                            onClick={(isScanning || isScanningRef.current) ? stopAutoScanning : startAutoScanning}
                            disabled={!cameraStream}
                            className="w-full font-medium"
                        >
                            {(isScanning || isScanningRef.current) ? "停止掃描" : "開始掃描"}
                        </Button>
                        


                    </div>
                    <Button variant="outline" onClick={handleCloseScanner} className="w-full">
                    關閉
                </Button>
                </div>
                <canvas 
                    ref={canvasRef} 
                    className="hidden" 
                    width="640" 
                    height="480"
                />

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

    {/* Import Status Dialog */}
    <Dialog open={showImportDialog} onOpenChange={(open) => {
      if (!isImporting) {
        setShowImportDialog(open);
        if (!open) {
          setImportStatus(null);
        }
      }
    }}>
        <DialogContent className="sm:max-w-lg max-w-[90vw]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {importStatus?.type === 'loading' && (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            正在匯入產品
                        </>
                    )}
                    {importStatus?.type === 'success' && (
                        <>
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            匯入成功
                        </>
                    )}
                    {importStatus?.type === 'error' && (
                        <>
                            <XCircle className="h-5 w-5 text-red-600" />
                            匯入失敗
                        </>
                    )}
                </DialogTitle>
                <DialogDescription>
                    {importStatus?.message}
                </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
                {importStatus?.details && (
                    <div className={`p-4 rounded-lg border text-sm whitespace-pre-line ${
                        importStatus.type === 'loading' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                        importStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                        'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        {importStatus.details}
                    </div>
                )}
                
                {importStatus?.type === 'loading' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
                        請等待處理完成，不要關閉此對話框
                    </div>
                )}
                
                {(importStatus?.type === 'success' || importStatus?.type === 'error') && (
                    <div className="flex gap-2">
                        <Button 
                            onClick={() => {
                                setShowImportDialog(false);
                                setImportStatus(null);
                            }}
                            className="flex-1"
                            variant={importStatus.type === 'success' ? 'default' : 'outline'}
                        >
                            確定
                        </Button>
                        {importStatus.type === 'error' && (
                            <Button 
                                onClick={() => fileInputRef.current?.click()}
                                variant="default"
                                className="flex-1"
                            >
                                重新匯入
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}

