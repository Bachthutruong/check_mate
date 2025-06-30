"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import useSWR from 'swr';
import { useAuth } from "@/contexts/auth-context";
import { Product, Store } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Upload, Camera, CheckCircle2, XCircle, Bot, Shirt, Footprints, Laptop, Gem, Eye, Warehouse, Download, X, Edit3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  
  // Add state for tracking upload date information
  const [uploadInfo, setUploadInfo] = useState<{
    uploadDate: string;
    fileName: string;
    productCount: number;
  } | null>(null);
  
  // Wrapped setProductQuantities with localStorage backup and ref sync
  const setProductQuantities = (value: Map<string, { scanned: number; total: number }> | ((prev: Map<string, { scanned: number; total: number }>) => Map<string, { scanned: number; total: number }>)) => {
    
    if (typeof value === 'function') {
      _setProductQuantities((prev) => {
        const newValue = value(prev);
        
        // Sync with ref immediately
        productQuantitiesRef.current = newValue;
        
        // Save to localStorage with better debugging
        if (selectedStoreId && typeof window !== 'undefined' && newValue.size > 0) {
          const serialized = JSON.stringify(Array.from(newValue.entries()));
          const storageKey = `productQuantities_${selectedStoreId}`;
          localStorage.setItem(storageKey, serialized);
          
          // Save upload info separately
          if (uploadInfo) {
            const uploadStorageKey = `uploadInfo_${selectedStoreId}`;
            localStorage.setItem(uploadStorageKey, JSON.stringify(uploadInfo));
          }
          
          // Verify save
          const verified = localStorage.getItem(storageKey);
        } else if (newValue.size === 0) {
          console.log('⚠️ Skipping localStorage save - empty map');
        } else {
          console.log('⚠️ Skipping localStorage save - no store selected');
        }
        
        // Force component re-render
        setForceUpdateCounter(prev => prev + 1);
        
        return newValue;
      });
    } else {
      
      // Sync with ref immediately
      productQuantitiesRef.current = value;
      
      // Save to localStorage with better debugging
      if (selectedStoreId && typeof window !== 'undefined' && value.size > 0) {
        const serialized = JSON.stringify(Array.from(value.entries()));
        const storageKey = `productQuantities_${selectedStoreId}`;
        localStorage.setItem(storageKey, serialized);
        
        // Save upload info separately
        if (uploadInfo) {
          const uploadStorageKey = `uploadInfo_${selectedStoreId}`;
          localStorage.setItem(uploadStorageKey, JSON.stringify(uploadInfo));
        }
        
        // Verify save
        const verified = localStorage.getItem(storageKey);
      } else if (value.size === 0) {
        console.log('⚠️ Skipping localStorage save - empty map');
      } else {
        console.log('⚠️ Skipping localStorage save - no store selected');
      }
      
      // Force component re-render
      setForceUpdateCounter(prev => prev + 1);
      
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
  const [hasCompletedCheck, setHasCompletedCheck] = useState<boolean>(false);
  const [showQuantityDialog, setShowQuantityDialog] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'incomplete' | 'completed'>('incomplete');
  
  // Handle tab change and reset category if needed
  const handleTabChange = (newTab: 'incomplete' | 'completed') => {
    setActiveTab(newTab);
    
    // Reset category to "All" when switching tabs to avoid empty categories
    // This ensures user always sees results when switching tabs
    setTimeout(() => {
      const currentStats = getCategoryStats[selectedCategory];
      if (!currentStats || currentStats.total === 0) {
        setSelectedCategory('All');
      }
    }, 0);
  };
  const [quantityInputProduct, setQuantityInputProduct] = useState<Product | null>(null);
  const [quantityInput, setQuantityInput] = useState<string>("");
  const [cameraInfo, setCameraInfo] = useState<{
    facing: string;
    width: number;
    height: number;
    devices: string[];
  } | null>(null);
  const [showManualInputDialog, setShowManualInputDialog] = useState<boolean>(false);
  const [manualBarcode, setManualBarcode] = useState<string>("");
  const [manualQuantity, setManualQuantity] = useState<string>("1");
  const [productSuggestions, setProductSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
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
    
    // Reset duplicate prevention after 3 seconds (longer delay to prevent rapid scanning)
    setTimeout(() => {
      lastScannedRef.current = null;
      console.log('🔄 Reset lastScanned - ready for same barcode again');
    }, 3000);
    
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
            console.log('🎉 Scanning product, checking if needs quantity input');
            console.log('🎉 Before scan - current:', currentQuantity.scanned, 'total:', currentQuantity.total);
            
            // If total quantity > 2 and not fully scanned, show quantity input dialog
            if (currentQuantity.total > 2) {
                console.log('📝 Product has >2 total, showing quantity input dialog');
                
                // Stop scanning temporarily
                stopAutoScanning();
                
                // Show quantity input dialog
                setQuantityInputProduct(product);
                setQuantityInput(String(Math.min(currentQuantity.total - currentQuantity.scanned, currentQuantity.total))); // Default to remaining or total
                setShowQuantityDialog(true);
                
                toast({
                    title: "掃描成功 ✅",
                    description: `🏷️ 產品: ${product.name}\n📊 請輸入實際掃描數量 (最多 ${currentQuantity.total - currentQuantity.scanned} 個)`,
                    duration: 3000,
                });
                
                return; // Don't process further, wait for user input
            }
            
            // For products with total <= 2, increment by 1 as before
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

      // Enhanced mobile detection
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                           (window.innerWidth <= 768 && 'ontouchstart' in window);
      
      console.log('Device detection:', { isMobile, isMobileDevice, userAgent: navigator.userAgent });

      // Progressive constraint strategy for mobile devices
      const constraintStrategies = [];
      
      if (isMobileDevice) {
        // Strategy 1: High-end mobile constraints
        constraintStrategies.push({
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 1920, min: 640, max: 1920 },
            height: { ideal: 1080, min: 480, max: 1080 },
            aspectRatio: { ideal: 16/9 },
            frameRate: { ideal: 30, min: 15, max: 30 }
          }
        });
        
        // Strategy 2: Medium mobile constraints
        constraintStrategies.push({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 24, min: 15 }
          }
        });
        
        // Strategy 3: Basic mobile constraints
        constraintStrategies.push({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 854, min: 640 },
            height: { ideal: 480, min: 360 }
          }
        });
        
        // Strategy 4: Minimal mobile constraints
        constraintStrategies.push({
          video: {
            facingMode: 'environment'
          }
        });
      } else {
        // Desktop constraints
        constraintStrategies.push({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      }
      
      // Strategy 5: Universal fallback
      constraintStrategies.push({ video: true });

      let stream = null;
      let usedStrategy = -1;
      
      // Try each strategy until one works
      for (let i = 0; i < constraintStrategies.length; i++) {
        try {
          console.log(`Trying camera strategy ${i + 1}:`, constraintStrategies[i]);
          
          stream = await navigator.mediaDevices.getUserMedia(constraintStrategies[i]);
          usedStrategy = i;
          
          console.log(`✅ Camera strategy ${i + 1} successful!`);
          
          // Check camera capabilities
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const capabilities = videoTrack.getCapabilities?.();
            const settings = videoTrack.getSettings();
            console.log('Camera capabilities:', capabilities);
            console.log('Camera settings:', settings);
            
            // Verify we got the rear camera on mobile
            if (isMobileDevice && settings.facingMode !== 'environment' && i < 2) {
              console.log('⚠️ Did not get rear camera, trying next strategy...');
              stream.getTracks().forEach(track => track.stop());
              continue;
            }
          }
          
          break;
        } catch (error: any) {
          console.log(`❌ Camera strategy ${i + 1} failed:`, error.name, error.message);
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
          }
          
          // Continue to next strategy
          if (i === constraintStrategies.length - 1) {
            throw error; // Re-throw if all strategies failed
          }
        }
      }
      
      if (!stream) {
        throw new Error('無法獲取相機流');
      }
      
      setCameraStream(stream);
      
      // Show success message with strategy info
      if (usedStrategy >= 0) {
        const strategyNames = ['高畫質', '中等畫質', '基本畫質', '最小設定', '通用模式'];
        toast({
          title: "相機已啟動",
          description: `使用${strategyNames[usedStrategy] || '預設'}設定`,
          duration: 3000,
        });
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Enhanced video loading with better error handling
        return new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          let timeoutId: NodeJS.Timeout;
          
          const cleanup = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            video.removeEventListener('canplay', onCanPlay);
            if (timeoutId) clearTimeout(timeoutId);
          };
          
          const onLoadedMetadata = () => {
            console.log('📹 Video metadata loaded:', {
              width: video.videoWidth,
              height: video.videoHeight,
              duration: video.duration
            });
          };
          
          const onCanPlay = () => {
            video.play()
              .then(() => {
                console.log('✅ Camera started successfully');
                cleanup();
                
                // Auto-start scanning when camera is ready
                setTimeout(() => {
                  console.log('🎬 Camera ready, starting auto-scan...');
                  if (!isScanning) {
                    startAutoScanning();
                  } else {
                    console.log('⚠️ Already scanning, restarting...');
                    setIsScanning(false);
                    setTimeout(() => {
                      startAutoScanning();
                    }, 100);
                  }
                }, 1000);
                
                resolve();
              })
              .catch((playError) => {
                console.error('Video play error:', playError);
                cleanup();
                reject(playError);
              });
          };
          
          const onError = (errorEvent: Event) => {
            console.error('Video error:', errorEvent);
            cleanup();
            reject(new Error('視頻載入錯誤'));
          };
          
          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          video.addEventListener('canplay', onCanPlay, { once: true });
          video.addEventListener('error', onError, { once: true });
          
          // Longer timeout for mobile devices
          const timeoutDuration = isMobileDevice ? 15000 : 10000;
          timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('相機載入超時'));
          }, timeoutDuration);
        });
      }
      
    } catch (error: any) {
      console.error("Camera error:", error);
      
      let errorMessage = "相機啟動失敗: " + (error.message || "未知錯誤");
      
      // Provide specific error messages for common issues
      if (error.name === 'NotAllowedError') {
        errorMessage = "需要相機權限。請在瀏覽器設定中允許使用相機。";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "找不到相機設備。請確認設備有可用的相機。";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "相機正被其他應用程式使用。請關閉其他使用相機的應用程式。";
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "相機不支援所需的設定。將嘗試使用基本設定。";
      } else if (error.name === 'SecurityError') {
        errorMessage = "安全限制阻止了相機存取。請確認您在安全的連線 (HTTPS) 上使用此功能。";
      }
      
      setScannerError(errorMessage);
      
      // Show helpful tips for mobile users
      if (isMobile) {
        toast({
          variant: "destructive",
          title: "行動裝置相機問題",
          description: "請嘗試重新整理頁面或在瀏覽器設定中重新授權相機權限",
          duration: 5000,
        });
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

    // Check if there are existing scan quantities and warn user
    const hasExistingScans = productQuantities.size > 0 && 
      Array.from(productQuantities.values()).some(qty => qty.scanned > 0);
    
    if (hasExistingScans) {
      const confirmImport = window.confirm(
        '⚠️ 注意：匯入新的Excel文件將會重置所有已掃描的產品狀態！\n\n您確定要繼續嗎？\n\n建議：如果需要保留當前掃描狀態，請先點擊「完成檢查」保存結果。'
      );
      
      if (!confirmImport) {
        // Reset file input if user cancels
        if (event.target) {
          event.target.value = '';
        }
        return;
      }
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

    // Store upload information
    const currentUploadInfo = {
      uploadDate: new Date().toISOString(),
      fileName: file.name,
      productCount: 0 // Will be updated after processing
    };

    // Show loading dialog
    setIsImporting(true);
    setShowImportDialog(true);
    setImportStatus({
      type: 'loading',
      message: '正在讀取和處理Excel文件...',
      details: `文件名稱: ${file.name}\n上傳時間: ${formatDateTime(new Date())}\n請稍候，系統正在分析文件內容`
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            setImportStatus({
              type: 'loading',
              message: '正在解析Excel數據...',
              details: `文件名稱: ${file.name}\n處理時間: ${formatDateTime(new Date())}\n正在讀取工作表內容`
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
              details: `文件名稱: ${file.name}\n找到 ${rows.length} 行數據，正在處理中...\n開始時間: ${formatDateTime(new Date())}`
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
                    details: `文件名稱: ${file.name}\n已處理 ${processedRows}/${rows.length} 行 (${Math.round(processedRows/rows.length*100)}%)\n處理時間: ${formatDateTime(new Date())}`
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
                      details: `文件名稱: ${file.name}\n準備保存 ${newProducts.length} 個產品到 ${currentStore.name}\n保存時間: ${formatDateTime(new Date())}`
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
                    
                    // Update upload info with final product count
                    currentUploadInfo.productCount = createdCount;
                    setUploadInfo(currentUploadInfo);
                    
                    console.log('API response result:', result);
                    console.log('API created products sample:', result.createdProducts?.[0]);
                    
                    setImportStatus({
                      type: 'loading',
                      message: '正在刷新產品列表...',
                      details: `文件名稱: ${file.name}\n已成功保存 ${createdCount} 個產品\n完成時間: ${formatDateTime(new Date())}\n更新界面顯示`
                    });

                    // Refresh products data to include new products
                    await mutateProducts();
                    
                    // Reset scan quantities when importing new products
                    // This ensures fresh start for the new product list
                    setProductQuantities(new Map());
                    setHasCompletedCheck(false); // Reset completion status for new products
                    
                    // Clear localStorage for the current store since we have new products
                    if (typeof window !== 'undefined' && selectedStoreId) {
                      const storageKey = `productQuantities_${selectedStoreId}`;
                      localStorage.removeItem(storageKey);
                      console.log('🗑️ Cleared scan quantities for new import:', storageKey);
                      
                      // Save new upload info to localStorage
                      const uploadStorageKey = `uploadInfo_${selectedStoreId}`;
                      localStorage.setItem(uploadStorageKey, JSON.stringify(currentUploadInfo));
                      console.log('💾 Saved upload info:', uploadStorageKey, currentUploadInfo);
                      
                      // Verify removal
                      const verifyRemoval = localStorage.getItem(storageKey);
                      console.log('✅ Verified removal:', verifyRemoval === null ? 'Success' : 'Failed');
                    }
                    
                    // Log what we got after refresh
                    setTimeout(() => {
                        console.log('After mutate - storeProducts:', storeProducts);
                        if (storeProducts && storeProducts.length > 0) {
                            console.log('First product after refresh:', storeProducts[0]);
                        }
                    }, 1000);
                    
                } catch (error) {
                    console.error('Error creating products:', error);
                    setImportStatus({
                      type: 'error',
                      message: '保存產品失敗',
                      details: `文件名稱: ${file.name}\n錯誤時間: ${formatDateTime(new Date())}\n錯誤詳情: ${error instanceof Error ? error.message : '未知錯誤'}\n請檢查網絡連接或聯繫技術支持。`
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
                  details: `文件名稱: ${file.name}\n處理時間: ${formatDateTime(new Date())}\n\n${noMatchMessage}\n\n請確保:\n• Excel文件第一列為店名，且與選中的商店名稱完全一致\n• 檔案格式正確\n• 產品資料完整`
                });
                return;
            }

            // Success message with detailed statistics
            const autoGeneratedMessage = autoGeneratedCount > 0 ? `\n• 自動生成條碼: ${autoGeneratedCount} 個` : '';
            const skippedMessage = skippedCount > 0 ? `\n• 跳過其他商店產品: ${skippedCount} 個` : '';
            const uploadDateTime = formatDateTime(new Date(currentUploadInfo.uploadDate));
            
            setImportStatus({
              type: 'success',
              message: '產品匯入成功！',
              details: `✅ 匯入統計:\n• 文件名稱: ${file.name}\n• 上傳時間: ${uploadDateTime}\n• 商店: ${currentStore.name}\n• 成功創建產品: ${createdCount} 個${autoGeneratedMessage}${skippedMessage}\n• 總處理行數: ${processedRows}\n• 完成時間: ${formatDateTime(new Date())}\n\n現在可以開始掃描或手動檢查產品。`
            });

        } catch (error) {
            console.error("Error processing XLSX file:", error);
            setImportStatus({
              type: 'error',
              message: '文件處理錯誤',
              details: `文件名稱: ${file.name}\n錯誤時間: ${formatDateTime(new Date())}\n\n無法讀取Excel文件。\n\n錯誤詳情: ${error instanceof Error ? error.message : '未知錯誤'}\n\n請確保:\n• 文件為有效的Excel格式(.xlsx/.xls)\n• 文件沒有被其他程序占用\n• 文件結構符合要求`
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

  // Reset state when store changes (smart initialize will handle localStorage restore)
  useEffect(() => {
    if (selectedStoreId) {
      console.log('🏪 Store changed to:', selectedStoreId);
      // Reset completion status when switching stores
      setHasCompletedCheck(false);
      
      // Don't reset productQuantities here - let smart initialize handle it
      // This prevents race condition between restore and initialize
    } else {
      console.log('🔄 No store selected, clearing quantities');
      productQuantitiesRef.current = new Map();
      _setProductQuantities(new Map());
      setHasCompletedCheck(false);
    }
  }, [selectedStoreId]);

  // Initialize product quantities when storeProducts change - but preserve localStorage data
  useEffect(() => {
    if (storeProducts && storeProducts.length > 0 && selectedStoreId) {
      console.log('🔄 Smart initializing product quantities for', storeProducts.length, 'products');
      
      // Check if we have localStorage data first
      const stored = localStorage.getItem(`productQuantities_${selectedStoreId}`);
      const uploadStored = localStorage.getItem(`uploadInfo_${selectedStoreId}`);
      let hasStoredData = false;
      let storedMap = new Map<string, { scanned: number; total: number }>();
      
      if (stored) {
        try {
          const restoredEntries = JSON.parse(stored) as [string, { scanned: number; total: number }][];
          storedMap = new Map(restoredEntries);
          hasStoredData = storedMap.size > 0;
          console.log('📱 Found localStorage data:', hasStoredData, 'items:', storedMap.size);
        } catch (e) {
          console.warn('Failed to parse stored data during initialize:', e);
        }
      }
      
      // Restore upload info if available
      if (uploadStored) {
        try {
          const restoredUploadInfo = JSON.parse(uploadStored);
          setUploadInfo(restoredUploadInfo);
          console.log('📱 Restored upload info:', restoredUploadInfo);
        } catch (e) {
          console.warn('Failed to parse stored upload info:', e);
        }
      }
      
      setProductQuantities(prev => {
        // If we have stored data, prioritize it
        const baseMap = hasStoredData ? storedMap : prev;
        const newMap = new Map(baseMap);
        
        console.log('🏗️ Base map size:', baseMap.size, 'Has stored data:', hasStoredData);
        
        // Only add missing products, don't override existing data
        storeProducts.forEach(product => {
          if (!newMap.has(product._id!)) {
            const total = Math.max(product.computerInventory || 20, 1);
            const quantity = { scanned: 0, total };
            
            console.log(`📦 Adding new product ${product.name} with quantity:`, quantity, `(computerInventory: ${product.computerInventory})`);
            newMap.set(product._id!, quantity);
          } else {
            const existingQuantity = newMap.get(product._id!);
            console.log(`✅ ${product.name} already has quantity:`, existingQuantity);
            
            // Update total quantity if product computerInventory changed but keep scanned count
            const newTotal = Math.max(product.computerInventory || 20, 1);
            if (existingQuantity && existingQuantity.total !== newTotal) {
              console.log(`🔄 Updating total for ${product.name} from ${existingQuantity.total} to ${newTotal}`);
              newMap.set(product._id!, {
                scanned: Math.min(existingQuantity.scanned, newTotal), // Don't exceed new total
                total: newTotal
              });
            }
          }
        });
        
        // Update ref to match
        productQuantitiesRef.current = newMap;
        
        console.log('📊 Total quantities after smart initialize:', newMap.size);
        console.log('💾 Sample quantities:', Array.from(newMap.entries()).slice(0, 3));
        
        // Show notification if we restored data from localStorage
        if (hasStoredData) {
          const scannedCount = Array.from(storedMap.values()).reduce((sum, qty) => sum + qty.scanned, 0);
          const totalItems = Array.from(storedMap.values()).reduce((sum, qty) => sum + qty.total, 0);
          
          // Include upload info in restoration message
          let restorationMessage = `從上次檢查恢復了 ${storedMap.size} 個產品的掃描進度\n已掃描: ${scannedCount}/${totalItems} 個`;
          
          if (uploadInfo) {
            restorationMessage += `\n上傳文件: ${uploadInfo.fileName}\n上傳時間: ${getRelativeTime(uploadInfo.uploadDate)}`;
          }
          
          toast({
            title: "數據已恢復 ✅",
            description: restorationMessage,
            duration: 5000,
          });
        }
        
        return newMap;
      });
    }
  }, [storeProducts, selectedStoreId]);

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

  const handleDownloadBarcode = (product: Product) => {
    // First show the barcode dialog to generate the SVG
    setSelectedBarcodeProduct(product);
    setShowBarcodeDialog(true);
    
    // Wait a bit for dialog to render, then capture and download
    setTimeout(() => {
      try {
        // Find the barcode SVG in the dialog
        const dialogContent = document.querySelector('[role="dialog"]');
        const svgElement = dialogContent?.querySelector('svg');
        
        if (!svgElement) {
          throw new Error('Barcode SVG not found in dialog');
        }

        // Create canvas for download image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available');

        // Set canvas size
        canvas.width = 400;
        canvas.height = 200;

        // Fill white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw product info
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px Arial';
        
        // Product name
        ctx.fillText(product.name, canvas.width / 2, 30);
        
        // Category and brand info
        ctx.font = '12px Arial';
        ctx.fillText(`類別: ${product.category}`, canvas.width / 2, 50);
        ctx.fillText(`廠牌: ${product.brand || 'Apple'}`, canvas.width / 2, 70);

        // Convert SVG to image and draw on canvas
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
          // Calculate centered position for barcode
          const scale = Math.min(300 / img.width, 80 / img.height); // Scale to fit within 300x80
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const barcodeX = (canvas.width - scaledWidth) / 2;
          const barcodeY = 90;
          
          // Draw barcode
          ctx.drawImage(img, barcodeX, barcodeY, scaledWidth, scaledHeight);

          // Clean up SVG URL
          URL.revokeObjectURL(svgUrl);

          // Convert canvas to blob and download
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `barcode-${product.barcode}-${product.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              toast({
                title: "條碼已下載",
                description: `${product.name} 的條碼圖片已保存`,
                duration: 2000,
              });
              
              // Close the dialog after download
              setShowBarcodeDialog(false);
            }
          }, 'image/png');
        };

        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          throw new Error('Failed to load barcode SVG as image');
        };

        img.src = svgUrl;

      } catch (error) {
        console.error('Error generating barcode download:', error);
        toast({
          variant: "destructive",
          title: "下載失敗",
          description: "無法生成條碼圖片，請稍後再試",
          duration: 3000,
        });
        // Close dialog on error
        setShowBarcodeDialog(false);
      }
    }, 500); // Wait for dialog to fully render
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
    
    // Restart after delay (longer delay to prevent rapid consecutive scans)
    restartTimeoutRef.current = setTimeout(() => {
      if (!isProcessingRef.current) {
        console.log('🔄 Restarting auto-scanning...');
        isScanningRef.current = true;
        setIsScanning(true);
        
        toast({
          title: "準備下一次掃描",
          description: "請更換條碼後再次掃描",
          duration: 1500,
        });
        
        startBarcodeDetection();
      }
      restartTimeoutRef.current = null;
    }, 2500);
  };



  const handleStoreChange = (storeId: string) => {
    console.log('🏪 handleStoreChange called with storeId:', storeId);
    console.log('🏪 Current selectedStoreId:', selectedStoreId);
    console.log('🏪 Current isChecking:', isChecking);
    console.log('🏪 Current hasCompletedCheck:', hasCompletedCheck);
    console.log('🏪 Current product quantities:', productQuantities.size);
    
    // Allow store change if:
    // 1. Not currently checking, OR
    // 2. Same store selected, OR  
    // 3. Has completed at least one check (data is saved)
    if (isChecking && storeId !== selectedStoreId && !hasCompletedCheck) {
        toast({
            variant: "destructive",
            title: "無法變更商店",
            description: "請先完成檢查或點擊「結束檢查」才能切換商店。",
        });
        return;
    }
    
    setSelectedStoreId(storeId);
    if (storeId) {
        // Only reset quantities if switching to a different store
        if (storeId !== selectedStoreId) {
          console.log('🏪 Different store selected, resetting quantities and flags');
          setProductQuantities(new Map());
          setHasCompletedCheck(false); // Reset completion status for new store
        } else {
          console.log('🏪 Same store, keeping existing quantities');
        }
        setIsChecking(true);
    } else {
        setIsChecking(false);
        setHasCompletedCheck(false);
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



  const handleEndCheck = () => {
    // End checking mode directly without confirmation
    setIsChecking(false);
    setSelectedStoreId("");
    setProductQuantities(new Map());
    setHasCompletedCheck(false);
    setUploadInfo(null); // Clear upload info
    
    // Clear localStorage
    if (typeof window !== 'undefined' && selectedStoreId) {
      const storageKey = `productQuantities_${selectedStoreId}`;
      const uploadStorageKey = `uploadInfo_${selectedStoreId}`;
      localStorage.removeItem(storageKey);
      localStorage.removeItem(uploadStorageKey);
      console.log('🗑️ Cleared localStorage on end check:', storageKey, uploadStorageKey);
      
      // Verify removal
      const verifyRemoval = localStorage.getItem(storageKey);
      const verifyUploadRemoval = localStorage.getItem(uploadStorageKey);
      console.log('✅ Verified removal:', {
        quantities: verifyRemoval === null ? 'Success' : 'Failed',
        uploadInfo: verifyUploadRemoval === null ? 'Success' : 'Failed'
      });
    }
    
    let endMessage = "已退出檢查模式，現在可以選擇其他商店";
    if (uploadInfo) {
      const totalDuration = Math.round((new Date().getTime() - new Date(uploadInfo.uploadDate).getTime()) / (1000 * 60));
      endMessage += `\n\n本次檢查總時長: ${totalDuration} 分鐘`;
      endMessage += `\n文件: ${uploadInfo.fileName}`;
    }
    
    toast({
      title: "檢查已結束",
      description: endMessage,
      duration: 3000,
    });
  };

  const handleQuantitySubmit = () => {
    if (!quantityInputProduct) return;
    
    const inputQuantity = parseInt(quantityInput);
    const currentQuantity = productQuantities.get(quantityInputProduct._id!) || { 
      scanned: 0, 
      total: quantityInputProduct.computerInventory || 1 
    };
    
    // Validation
    if (isNaN(inputQuantity) || inputQuantity <= 0) {
      toast({
        variant: "destructive",
        title: "輸入錯誤",
        description: "請輸入有效的數量 (大於0)",
      });
      return;
    }
    
    if (inputQuantity > (currentQuantity.total - currentQuantity.scanned)) {
      toast({
        variant: "destructive",
        title: "數量超出限制",
        description: `最多只能掃描 ${currentQuantity.total - currentQuantity.scanned} 個`,
      });
      return;
    }
    
    // Update quantity
    const newQuantity = {
      scanned: currentQuantity.scanned + inputQuantity,
      total: currentQuantity.total
    };
    
    // Update ref immediately to prevent race conditions
    productQuantitiesRef.current.set(quantityInputProduct._id!, newQuantity);
    
    // Update state for UI re-render
    setProductQuantities(prev => {
      const newMap = new Map(prev);
      newMap.set(quantityInputProduct._id!, newQuantity);
      return newMap;
    });
    
    const isFullyScanned = newQuantity.scanned >= newQuantity.total;
    const remaining = newQuantity.total - newQuantity.scanned;
    
    toast({
      title: isFullyScanned ? "掃描完成 ✅" : "數量已更新 ✅",
      description: `🏷️ 產品: ${quantityInputProduct.name}\n📊 本次掃描: ${inputQuantity} 個\n📊 總計掃描: ${newQuantity.scanned}/${newQuantity.total}\n🎯 還需掃描: ${remaining} 個${isFullyScanned ? '\n🎉 全部完成!' : ''}`,
      duration: 4000,
    });
    
    // Close dialog and reset
    setShowQuantityDialog(false);
    setQuantityInputProduct(null);
    setQuantityInput("");
    
    // Highlight the updated product in table
    setTimeout(() => {
      const productElements = document.querySelectorAll(`[data-product-id="${quantityInputProduct._id}"]`);
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
    
    // Restart scanning after a short delay
    setTimeout(() => {
      if (isScannerOpen && !isScanning) {
        startAutoScanning();
      }
    }, 1000);
  };

  const handleQuantityCancel = () => {
    setShowQuantityDialog(false);
    setQuantityInputProduct(null);
    setQuantityInput("");
    
    // Restart scanning after cancellation
    setTimeout(() => {
      if (isScannerOpen && !isScanning) {
        startAutoScanning();
      }
    }, 500);
  };

  const handleManualInput = () => {
    if (!storeProducts) {
      toast({
        variant: "destructive",
        title: "錯誤",
        description: "尚未載入產品資料",
      });
      return;
    }

    const searchTerm = manualBarcode.trim();
    const quantity = parseInt(manualQuantity);

    // Validation
    if (!searchTerm) {
      toast({
        variant: "destructive",
        title: "輸入錯誤",
        description: "請輸入產品條碼或名稱",
      });
      return;
    }

    if (isNaN(quantity) || quantity <= 0) {
      toast({
        variant: "destructive",
        title: "輸入錯誤",
        description: "請輸入有效的數量 (大於0)",
      });
      return;
    }

    // Find product by barcode or name
    const searchQuery = searchTerm.toLowerCase();
    const product = storeProducts.find(p => {
      const nameMatch = p.name.toLowerCase().includes(searchQuery);
      const barcodeMatch = p.barcode?.toLowerCase() === searchQuery || p.barcode === searchTerm;
      return barcodeMatch || (nameMatch && p.name.toLowerCase() === searchQuery);
    }) || storeProducts.find(p => {
      const nameMatch = p.name.toLowerCase().includes(searchQuery);
      const barcodeMatch = p.barcode?.toLowerCase().includes(searchQuery);
      return nameMatch || barcodeMatch;
    });

    if (!product) {
      toast({
        variant: "destructive",
        title: "找不到產品",
        description: `沒有找到匹配 "${searchTerm}" 的產品，請從建議列表中選擇`,
      });
      return;
    }

    // Get current quantity
    const currentQuantity = productQuantities.get(product._id!) || { 
      scanned: 0, 
      total: product.computerInventory || 1 
    };

    // Check if quantity exceeds limit
    if (quantity > (currentQuantity.total - currentQuantity.scanned)) {
      toast({
        variant: "destructive",
        title: "數量超出限制",
        description: `最多只能掃描 ${currentQuantity.total - currentQuantity.scanned} 個`,
      });
      return;
    }

    // Update quantity
    const newQuantity = {
      scanned: currentQuantity.scanned + quantity,
      total: currentQuantity.total
    };

    // Update ref immediately
    productQuantitiesRef.current.set(product._id!, newQuantity);

    // Update state for UI re-render
    setProductQuantities(prev => {
      const newMap = new Map(prev);
      newMap.set(product._id!, newQuantity);
      return newMap;
    });

    const isFullyScanned = newQuantity.scanned >= newQuantity.total;
    const remaining = newQuantity.total - newQuantity.scanned;

    toast({
      title: isFullyScanned ? "手動輸入完成 ✅" : "手動輸入成功 ✅",
      description: `🏷️ 產品: ${product.name}\n📊 本次輸入: ${quantity} 個\n📊 總計掃描: ${newQuantity.scanned}/${newQuantity.total}\n🎯 還需掃描: ${remaining} 個${isFullyScanned ? '\n🎉 全部完成!' : ''}`,
      duration: 4000,
    });

    // Reset inputs but keep dialog open for continued input
    setManualBarcode("");
    setManualQuantity("1");
    setProductSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    // Auto-focus back to barcode input for next entry
    setTimeout(() => {
      const barcodeInput = document.getElementById('manual-barcode');
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }, 100);

    // Highlight the updated product in table
    setTimeout(() => {
      const productElements = document.querySelectorAll(`[data-product-id="${product._id}"]`);
      if (productElements.length > 0) {
        const element = productElements[0] as HTMLElement;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Flash highlight effect
        element.style.transition = 'all 0.3s ease';
        element.style.backgroundColor = '#3b82f6'; // blue color for manual input
        element.style.transform = 'scale(1.02)';
        
        setTimeout(() => {
          element.style.backgroundColor = '';
          element.style.transform = '';
        }, 1000);
      }
    }, 500);
  };

  const handleManualInputCancel = () => {
    setShowManualInputDialog(false);
    setManualBarcode("");
    setManualQuantity("1");
    setProductSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const searchProducts = (query: string) => {
    if (!storeProducts) {
      setProductSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const searchQuery = query.toLowerCase().trim();
    
    // If no query, show all products
    const filtered = searchQuery.length === 0 
      ? storeProducts 
      : storeProducts.filter(product => {
          const nameMatch = product.name.toLowerCase().includes(searchQuery);
          const barcodeMatch = product.barcode?.toLowerCase().includes(searchQuery);
          const categoryMatch = product.category?.toLowerCase().includes(searchQuery);
          const brandMatch = product.brand?.toLowerCase().includes(searchQuery);
          
          return nameMatch || barcodeMatch || categoryMatch || brandMatch;
        });

    // Sort results: exact matches first, then partial matches
    const sorted = filtered.sort((a, b) => {
      const aExact = a.name.toLowerCase() === searchQuery || a.barcode?.toLowerCase() === searchQuery;
      const bExact = b.name.toLowerCase() === searchQuery || b.barcode?.toLowerCase() === searchQuery;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Then sort by name
      return a.name.localeCompare(b.name);
    });

    setProductSuggestions(sorted);
    setShowSuggestions(sorted.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  const handleBarcodeInputChange = (value: string) => {
    setManualBarcode(value);
    searchProducts(value);
  };

  const handleSuggestionSelect = (product: Product) => {
    setManualBarcode(product.barcode || '');
    setShowSuggestions(false);
    setProductSuggestions([]);
    setSelectedSuggestionIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || productSuggestions.length === 0) {
      if (e.key === 'Enter') {
        handleManualInput();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < productSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : productSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSuggestionSelect(productSuggestions[selectedSuggestionIndex]);
        } else {
          handleManualInput();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Debug function to check localStorage manually
  const debugLocalStorage = () => {
    if (!selectedStoreId) {
      console.log('🚫 No store selected');
      return;
    }
    
    const storageKey = `productQuantities_${selectedStoreId}`;
    const stored = localStorage.getItem(storageKey);
    
    console.log('🔍 DEBUG localStorage:');
    console.log('📍 Store ID:', selectedStoreId);
    console.log('🔑 Storage Key:', storageKey);
    console.log('💾 Stored Data:', stored);
    console.log('📊 Current productQuantities size:', productQuantities.size);
    console.log('🧠 Current ref size:', productQuantitiesRef.current.size);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('✅ Parsed successfully:', parsed.length, 'items');
        console.log('📋 Sample items:', parsed.slice(0, 3));
      } catch (e) {
        console.error('❌ Parse error:', e);
      }
    } else {
      console.log('❌ No data found in localStorage');
    }
    
    // Also log all localStorage keys related to this app
    const allKeys = Object.keys(localStorage).filter(key => key.startsWith('productQuantities_'));
    console.log('🗂️ All productQuantities keys:', allKeys);
  };

  // Add debug function to window for manual testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugInventoryStorage = debugLocalStorage;
      console.log('🛠️ Debug function available: window.debugInventoryStorage()');
    }
  }, [selectedStoreId, productQuantities]);
  
  const categories = useMemo(() => {
    if (!storeProducts) return [];
    const cats = new Set(storeProducts.map(p => p.category));
    return ["All", ...Array.from(cats)];
  }, [storeProducts]);

  // Calculate completion statistics based on selected category
  const completionStats = useMemo(() => {
    if (!storeProducts) return { completed: 0, incomplete: 0, total: 0 };
    
    // Filter products by selected category first
    const categoryProducts = selectedCategory === 'All' 
      ? storeProducts 
      : storeProducts.filter(p => p.category === selectedCategory);
    
    let completed = 0;
    let incomplete = 0;
    
    categoryProducts.forEach(product => {
      const quantity = productQuantities.get(product._id!) || { scanned: 0, total: product.computerInventory || 1 };
      if (quantity.scanned >= quantity.total) {
        completed++;
      } else {
        incomplete++;
      }
    });
    
    return {
      completed,
      incomplete, 
      total: categoryProducts.length
    };
  }, [storeProducts, productQuantities, forceUpdateCounter, selectedCategory]);

  // Calculate category statistics based on active tab
  const getCategoryStats = useMemo(() => {
    if (!storeProducts) return {};
    
    const stats: Record<string, { unchecked: number; total: number; completed: number }> = {};
    
    categories.forEach(category => {
      const categoryProducts = category === 'All' 
        ? storeProducts 
        : storeProducts.filter(p => p.category === category);
      
      // Calculate stats for each category
      let totalInCategory = categoryProducts.length;
      let completedInCategory = 0;
      let incompleteInCategory = 0;
      
      categoryProducts.forEach(p => {
        const quantity = productQuantities.get(p._id!) || { scanned: 0, total: p.computerInventory || 1 };
        const isCompleted = quantity.scanned >= quantity.total;
        if (isCompleted) {
          completedInCategory++;
        } else {
          incompleteInCategory++;
        }
      });
      
      // Set stats based on active tab
      if (activeTab === 'completed') {
        stats[category] = {
          unchecked: 0, // All items in completed tab are completed by definition
          total: completedInCategory, // Only show completed items count
          completed: completedInCategory
        };
      } else {
        stats[category] = {
          unchecked: incompleteInCategory, // Show incomplete items count
          total: incompleteInCategory, // Only show incomplete items count
          completed: completedInCategory
        };
      }
    });
    
    return stats;
  }, [categories, storeProducts, productQuantities, forceUpdateCounter, activeTab]);

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

    const currentTime = new Date().toISOString();
    const newCheck = {
      storeId: selectedStoreId,
      storeName: stores?.find(s => s._id === selectedStoreId)?.name || 'Unknown Store',
      employeeName: user.name,
      checkedItems: Array.from(fullyScannedIds),
      missingItems: incompleteItems.map(item => item._id!),
      productQuantities: Array.from(productQuantities.entries()),
      // Add upload and completion date information
      uploadInfo: uploadInfo,
      completionDate: currentTime,
      checkDuration: uploadInfo ? 
        Math.round((new Date(currentTime).getTime() - new Date(uploadInfo.uploadDate).getTime()) / (1000 * 60)) : 
        null, // Duration in minutes
    };

    try {
        const res = await fetch('/api/inventory-checks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCheck),
        });
        if (!res.ok) throw new Error('Failed to save inventory check');

        const result = await res.json();
        
        // Prepare completion message with upload and timing information
        let completionMessage = `狀態: ${result.status === 'Completed' ? '完成' : '短缺'}。結果已保存到歷史記錄。`;
        
        if (uploadInfo) {
          const checkDuration = Math.round((new Date(currentTime).getTime() - new Date(uploadInfo.uploadDate).getTime()) / (1000 * 60));
          completionMessage += `\n\n📁 原始文件: ${uploadInfo.fileName}`;
          completionMessage += `\n📊 檢查產品: ${uploadInfo.productCount} 個`;
          completionMessage += `\n🕐 檢查時長: ${checkDuration} 分鐘`;
          completionMessage += `\n⏰ 完成時間: ${formatDateTime(new Date(currentTime))}`;
        }
        
        toast({
            title: "庫存檢查完成 ✅",
            description: completionMessage,
            duration: 6000,
        });

        // Mark as completed - this allows user to switch stores
        setHasCompletedCheck(true);
        
        // Keep the current state - don't reset after completing check
        // Users can continue scanning or start a new check
        // localStorage is kept so users can resume if they refresh
        console.log('✅ Check completed successfully, keeping current state for continued use');

    } catch (error: any) {
        toast({ variant: "destructive", title: "錯誤", description: error.message });
    }
  };

  // Function to get camera information for debugging
  const getCameraInfo = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('Available cameras:', videoDevices);
      
      const deviceNames = videoDevices.map(device => 
        device.label || `Camera ${videoDevices.indexOf(device) + 1}`
      );
      
      // Get current camera info if available
      if (cameraStream) {
        const videoTrack = cameraStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        setCameraInfo({
          facing: settings.facingMode || 'unknown',
          width: settings.width || 0,
          height: settings.height || 0,
          devices: deviceNames
        });
      } else {
        setCameraInfo({
          facing: 'not active',
          width: 0,
          height: 0,
          devices: deviceNames
        });
      }
    } catch (error) {
      console.error('Error getting camera info:', error);
    }
  };

  // Auto-refresh camera info when stream changes
  useEffect(() => {
    if (cameraStream) {
      getCameraInfo();
    }
  }, [cameraStream]);

  // Close suggestions when dialog is closed, or show all products when opened
  useEffect(() => {
    if (!showManualInputDialog) {
      setShowSuggestions(false);
      setProductSuggestions([]);
      setSelectedSuggestionIndex(-1);
    } else if (showManualInputDialog && storeProducts && storeProducts.length > 0) {
      // Show all products when dialog opens
      const sorted = storeProducts.sort((a, b) => a.name.localeCompare(b.name));
      setProductSuggestions(sorted);
      setShowSuggestions(true);
      setSelectedSuggestionIndex(-1);
    }
  }, [showManualInputDialog, storeProducts]);

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

  // Helper function to get relative time
  const getRelativeTime = (dateString: string): string => {
    const now = new Date();
    const uploadDate = new Date(dateString);
    const diffMs = now.getTime() - uploadDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return '剛才';
    if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;
    if (diffHours < 24) return `${diffHours} 小時前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return formatDateTime(uploadDate);
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
                            <span className="hidden sm:inline">匯入 上傳盤點商品</span>
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
                    <span className="hidden sm:inline">{isInitializingCamera ? "啟動相機中..." : "手機掃描"}</span>
                    <span className="sm:hidden">{isInitializingCamera ? "啟動" : "掃描"}</span>
                </Button>
                <Button 
                    onClick={() => setShowManualInputDialog(true)} 
                    disabled={!isChecking}
                    size="sm"
                    variant="outline"
                    className="text-xs sm:text-sm h-8 sm:h-9"
                >
                    <Edit3 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">手動輸入</span>
                    <span className="sm:hidden">輸入</span>
                </Button>
                {isChecking && (
                    <>
                        <Button 
                            onClick={completeCheck}
                            size="sm"
                            className="text-xs sm:text-sm h-8 sm:h-9 bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">完成盤點</span>
                            <span className="sm:hidden">完成</span>
                        </Button>
                        {/* <Button 
                            onClick={handleEndCheck}
                            size="sm"
                            variant="outline"
                            className="text-xs sm:text-sm h-8 sm:h-9 text-red-600 border-red-300 hover:bg-red-50"
                        >
                            <X className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">結束檢查</span>
                            <span className="sm:hidden">結束</span>
                        </Button> */}
                    </>
                )}
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
        {/* Store Selection Badges */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-semibold">選店點</h3>
            <div className="text-xs bg-gray-50 px-2 py-1 rounded border w-fit">
              總共 {userStores.length} 個商店
            </div>
          </div>
          
          {/* Store Badges - Flex Wrap Layout */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {userStores.map(store => {
              const isSelected = selectedStoreId === store._id;
              
              // Check if this store has upload info in localStorage
              const storeUploadInfo = (() => {
                if (typeof window !== 'undefined') {
                  try {
                    const uploadStorageKey = `uploadInfo_${store._id}`;
                    const stored = localStorage.getItem(uploadStorageKey);
                    return stored ? JSON.parse(stored) : null;
                  } catch (e) {
                    return null;
                  }
                }
                return null;
              })();
              
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
                        : storeUploadInfo 
                          ? 'bg-green-50 hover:bg-green-100 text-green-700 border-green-300 hover:border-green-400'
                          : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300 hover:border-blue-400'
                      }
                      ${userStores.length <= 1 && isChecking && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {/* Store Icon */}
                    <Warehouse className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${
                      isSelected ? 'text-white' : 
                      storeUploadInfo ? 'text-green-600' : 'text-blue-600'
                    }`} />
                    
                    {/* Store Name */}
                    <span className="font-medium">
                      {store.name}
                    </span>
                    
                    {/* Upload Status Indicator */}
                    {storeUploadInfo && !isSelected && (
                      <Upload className="h-2 w-2 sm:h-3 sm:w-3 text-green-600" />
                    )}
                    
                    {/* Status Badge */}
                    <div className={`
                      px-1.5 py-0.5 sm:px-2 rounded-full text-[10px] sm:text-xs font-bold 
                      min-w-[16px] sm:min-w-[20px] text-center
                      ${isSelected 
                        ? 'bg-white/20 text-white' 
                        : storeUploadInfo 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }
                    `}>
                      {isSelected ? '已選' : storeUploadInfo ? '有數據' : '選擇'}
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
                  
                  {/* Upload Info Tooltip/Indicator */}
                  {storeUploadInfo && !isSelected && (
                    <div className="absolute -bottom-1 -right-1 z-10">
                      <div className="bg-green-500 text-white rounded-full p-0.5" title={`數據: ${storeUploadInfo.fileName} (${getRelativeTime(storeUploadInfo.uploadDate)})`}>
                        <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
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
            {/* Upload Information Banner */}
            {uploadInfo && (
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-900">產品清單已上傳</h4>
                      <div className="text-sm text-blue-700">
                        <div>📁 文件: <span className="font-mono bg-white px-2 py-0.5 rounded">{uploadInfo.fileName}</span></div>
                        <div>📊 產品數量: <span className="font-medium">{uploadInfo.productCount.toLocaleString()}</span> 個</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-1">
                    <div className="text-sm font-medium text-blue-800">
                      {getRelativeTime(uploadInfo.uploadDate)}
                    </div>
                    <div className="text-xs text-blue-600 font-mono">
                      {formatDateTime(new Date(uploadInfo.uploadDate))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Category Filter Tags */}
            <div className="space-y-3 mb-6">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-base sm:text-lg font-semibold">已商品分類篩選</h3>
                  {uploadInfo && (
                    <div className="text-xs text-muted-foreground">
                      最後更新: {getRelativeTime(uploadInfo.uploadDate)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {activeTab === 'incomplete' ? (
                      <>
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                        </span>
                        <span className="text-xs sm:text-sm">待完成 {getCategoryStats[selectedCategory]?.total || 0} 項</span>
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-3 w-3">
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-xs sm:text-sm">已完成 {getCategoryStats[selectedCategory]?.total || 0} 項</span>
                      </>
                    )}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded border inline-block w-fit ${
                    activeTab === 'incomplete' 
                      ? 'bg-orange-50 border-orange-200 text-orange-800' 
                      : 'bg-green-50 border-green-200 text-green-800'
                  }`}>
                    {activeTab === 'incomplete' 
                      ? `未檢查: ${getCategoryStats[selectedCategory]?.total || 0} 項` 
                      : `已檢查: ${getCategoryStats[selectedCategory]?.total || 0} 項`
                    }
                  </div>
                </div>
              </div>
              
              {/* Category Tags - Mobile Optimized */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {categories.map(category => {
                    const stats = getCategoryStats[category] || { unchecked: 0, total: 0, completed: 0 };
                    const isSelected = selectedCategory === category;
                    const hasItems = stats.total > 0;
                    // Show different colors based on tab and content
                    const showAsCompleted = activeTab === 'completed' && hasItems;
                    const showAsIncomplete = activeTab === 'incomplete' && hasItems;
                    
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
                              ? (activeTab === 'completed' 
                                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-md ring-1 ring-green-300'
                                  : 'bg-orange-600 hover:bg-orange-700 text-white shadow-md ring-1 ring-orange-300'
                                )
                              : showAsCompleted
                                ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300'
                                : showAsIncomplete
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
                                  showAsCompleted ? 'text-green-600' :
                                  showAsIncomplete ? 'text-orange-600' : 'text-gray-500'
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
                              : showAsCompleted
                                ? 'bg-green-200 text-green-800'
                                : showAsIncomplete
                                  ? 'bg-orange-200 text-orange-800'
                                  : 'bg-gray-200 text-gray-600'
                            }
                          `}>
                            {stats.total}
                          </div>
                        </Badge>
                        
                        {/* Status Indicator - Smaller on mobile */}
                        {showAsCompleted && !isSelected && (
                          <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 z-10">
                            <div className="bg-green-500 text-white rounded-full p-0.5">
                              <CheckCircle2 className="h-2 w-2 sm:h-3 sm:w-3" />
                            </div>
                          </div>
                        )}
                        
                        {showAsIncomplete && !isSelected && (
                          <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 z-10">
                            <div className="bg-orange-500 text-white rounded-full p-0.5">
                              <XCircle className="h-2 w-2 sm:h-3 sm:w-3" />
                            </div>
                          </div>
                        )}
                        
                        {/* Count Indicator - Show total */}
                        {hasItems && !isSelected && (
                          <div className="absolute -top-0.5 -left-0.5 sm:-top-1 sm:-left-1 z-10">
                            <div className={`text-white text-[7px] sm:text-[8px] rounded-full min-w-[16px] h-3 sm:min-w-[20px] sm:h-4 flex items-center justify-center font-bold px-1 ${
                              showAsCompleted ? 'bg-green-500' : 
                              showAsIncomplete ? 'bg-orange-500' : 'bg-gray-500'
                            }`}>
                              {stats.total}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                

              </div>
            </div>
            
            {/* Status Tabs */}
            <div className="mb-6 border-b border-gray-200">
              <div className="flex space-x-8">
                <button
                  onClick={() => handleTabChange('incomplete')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'incomplete'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    <span>未完成檢查</span>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
                      activeTab === 'incomplete'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {completionStats.incomplete}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => handleTabChange('completed')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'completed'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>已完成檢查</span>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
                      activeTab === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {completionStats.completed}
                    </div>
                  </div>
                </button>
              </div>
              
              {/* Progress Summary */}
              <div className="mt-3 mb-3 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-full bg-gray-200 rounded-full h-2 max-w-[200px]">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${completionStats.total > 0 ? (completionStats.completed / completionStats.total) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                  <span>
                    進度: {completionStats.completed}/{completionStats.total} 
                    ({completionStats.total > 0 ? Math.round((completionStats.completed / completionStats.total) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Empty State Message */}
            {storeProducts.filter(p => selectedCategory === 'All' || p.category === selectedCategory)
              .filter(p => {
                const quantity = productQuantities.get(p._id!) || { scanned: 0, total: p.computerInventory || 1 };
                const isCompleted = quantity.scanned >= quantity.total;
                return activeTab === 'completed' ? isCompleted : !isCompleted;
              }).length === 0 && (
              <div className="text-center py-8">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                  activeTab === 'completed' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-orange-100 text-orange-600'
                }`}>
                  {activeTab === 'completed' ? 
                    <CheckCircle2 className="h-8 w-8" /> : 
                    <XCircle className="h-8 w-8" />
                  }
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {activeTab === 'completed' ? '沒有已完成的產品' : '沒有待檢查的產品'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {selectedCategory === 'All' 
                    ? (activeTab === 'completed' 
                        ? '所有產品都還沒有完成檢查' 
                        : '所有產品都已經完成檢查了！'
                      )
                    : (activeTab === 'completed'
                        ? `類別「${selectedCategory}」中沒有已完成檢查的產品`
                        : `類別「${selectedCategory}」中沒有待檢查的產品`
                      )
                  }
                </p>
                {selectedCategory !== 'All' && (
                  <button
                    onClick={() => setSelectedCategory('All')}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    查看所有類別 →
                  </button>
                )}
              </div>
            )}

            {/* Products Table */}
            {storeProducts.filter(p => selectedCategory === 'All' || p.category === selectedCategory)
              .filter(p => {
                const quantity = productQuantities.get(p._id!) || { scanned: 0, total: p.computerInventory || 1 };
                const isCompleted = quantity.scanned >= quantity.total;
                return activeTab === 'completed' ? isCompleted : !isCompleted;
              }).length > 0 && (
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
                          {storeProducts
                            .filter(p => selectedCategory === 'All' || p.category === selectedCategory)
                            .filter(p => {
                              const quantity = productQuantities.get(p._id!) || { scanned: 0, total: p.computerInventory || 1 };
                              const isCompleted = quantity.scanned >= quantity.total;
                              return activeTab === 'completed' ? isCompleted : !isCompleted;
                            })
                            .map((product, index) => {
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
                                        <div className="flex items-center gap-1 whitespace-nowrap">
                                            <span className="text-xs font-mono text-muted-foreground">
                                                {product.barcode}
                                            </span>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleShowBarcode(product)}
                                                    className="px-1 py-1 h-6 w-6 flex-shrink-0"
                                                    title="查看條碼"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDownloadBarcode(product)}
                                                    className="px-1 py-1 h-6 w-6 flex-shrink-0"
                                                    title="下載條碼"
                                                >
                                                    <Download className="h-3 w-3" />
                                                </Button>
                                            </div>
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
            )}
          </div>
        )}
      </CardContent>
      {isChecking && (
        <CardFooter className="border-t px-6 py-4">
            <div className="flex w-full items-center justify-center">
                <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                    {/* <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Bot className="h-5 w-5 text-primary" />
                        <span>AI 助手已啟用</span>
                    </div> */}
                    </TooltipTrigger>
                    <TooltipContent>
                    <p>我們的AI將根據過往記錄交叉比對檢查結果，發現潛在差異。</p>
                    </TooltipContent>
                </Tooltip>
                </TooltipProvider>
            </div>
        </CardFooter>
      )}
    </Card>
    
    <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-lg">
                          <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                手機掃描
                    {isMobile && (
                        <Badge variant="secondary" className="text-xs">
                            行動裝置
                        </Badge>
                    )}
                </DialogTitle>
                <div className="text-sm text-muted-foreground">
                    將條碼對準相機中央，系統會自動識別
                </div>
                
                {/* Mobile Usage Tips */}
                {isMobile && !cameraStream && (
                    <div className="text-xs bg-blue-50 border border-blue-200 p-3 rounded">
                        <div className="font-medium text-blue-800 mb-1">📱 行動裝置使用提示:</div>
                        <ul className="text-blue-700 space-y-1">
                            <li>• 允許瀏覽器使用相機權限</li>
                            <li>• 確保使用後鏡頭 (camera sau)</li>
                            <li>• 保持條碼距離相機 10-20cm</li>
                            <li>• 確保光線充足且條碼清晰</li>
                            <li>• 如果不能掃描，可使用手動輸入</li>
                        </ul>
                    </div>
                )}
                
                {/* Camera Info Display */}
                {cameraInfo && (
                    <div className="text-xs bg-gray-50 p-2 rounded border">
                        <div className="grid grid-cols-2 gap-2">
                            <span>相機方向: <strong>{cameraInfo.facing === 'environment' ? '後鏡頭 ✅' : cameraInfo.facing === 'user' ? '前鏡頭 ⚠️' : cameraInfo.facing}</strong></span>
                            <span>解析度: <strong>{cameraInfo.width}x{cameraInfo.height}</strong></span>
                        </div>
                        {cameraInfo.devices.length > 0 && (
                            <div className="mt-1">
                                可用設備: <strong>{cameraInfo.devices.length}</strong> 個相機
                            </div>
                        )}
                        {isMobile && cameraInfo.facing !== 'environment' && (
                            <div className="mt-1 text-orange-600 font-medium">
                                ⚠️ 建議使用後鏡頭以獲得更好的掃描效果
                            </div>
                        )}
                    </div>
                )}
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
                        
                        {/* Debug buttons for mobile */}
                        {isMobile && (
                            <div className="mt-3 flex gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={startCamera}
                                    className="text-xs"
                                >
                                    重試相機
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={getCameraInfo}
                                    className="text-xs"
                                >
                                    檢查設備
                                </Button>
                            </div>
                        )}
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
                                    {isMobile && (
                                        <p className="text-xs text-gray-500 mt-1">行動裝置可能需要較長時間</p>
                                    )}
                                </div>
                            </div>
                        )}
                        {(isScanning || isScanningRef.current) && videoRef?.current?.srcObject && (
                            <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg">
                                <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                                <span className="font-medium">掃描中</span>
                            </div>
                        )}
                        
                        {/* Camera facing indicator for mobile */}
                        {isMobile && cameraInfo && videoRef?.current?.srcObject && (
                            <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                                {cameraInfo.facing === 'environment' ? '後鏡頭' : 
                                 cameraInfo.facing === 'user' ? '前鏡頭' : 
                                 cameraInfo.facing}
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
                        
                        {/* Additional mobile options */}
                        {isMobile && cameraStream && (
                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    size="sm"
                                    variant="outline"
                                    onClick={handleManualBarcodeInput}
                                    className="text-xs"
                                >
                                    手動輸入
                                </Button>
                                <Button 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        handleCloseScanner();
                                        setTimeout(() => handleOpenScanner(), 100);
                                    }}
                                    className="text-xs"
                                >
                                    重新啟動
                                </Button>
                            </div>
                        )}
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

    {/* Quantity Input Dialog */}
    <Dialog open={showQuantityDialog} onOpenChange={(open) => {
      if (!open) {
        handleQuantityCancel();
      }
    }}>
        <DialogContent className="sm:max-w-md max-w-[90vw]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    輸入掃描數量
                </DialogTitle>
                <DialogDescription>
                    {quantityInputProduct && (
                        <div className="space-y-1 text-sm">
                            <div><strong>產品名稱:</strong> {quantityInputProduct.name}</div>
                            <div><strong>條碼:</strong> {quantityInputProduct.barcode}</div>
                            <div><strong>庫存總數:</strong> {quantityInputProduct.computerInventory || 0} 個</div>
                            {(() => {
                              const currentQuantity = productQuantities.get(quantityInputProduct._id!) || { 
                                scanned: 0, 
                                total: quantityInputProduct.computerInventory || 1 
                              };
                              return (
                                <div><strong>還需掃描:</strong> {currentQuantity.total - currentQuantity.scanned} 個</div>
                              );
                            })()}
                        </div>
                    )}
                </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="quantity-input">
                        請輸入本次實際掃描的數量:
                    </Label>
                    <Input
                        id="quantity-input"
                        type="number"
                        min="1"
                        max={quantityInputProduct ? (() => {
                          const currentQuantity = productQuantities.get(quantityInputProduct._id!) || { 
                            scanned: 0, 
                            total: quantityInputProduct.computerInventory || 1 
                          };
                          return currentQuantity.total - currentQuantity.scanned;
                        })() : 1}
                        value={quantityInput}
                        onChange={(e) => setQuantityInput(e.target.value)}
                        placeholder="輸入數量"
                        className="text-center text-lg font-semibold"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleQuantitySubmit();
                          }
                        }}
                    />
                    <div className="text-xs text-muted-foreground text-center">
                        {quantityInputProduct && (() => {
                          const currentQuantity = productQuantities.get(quantityInputProduct._id!) || { 
                            scanned: 0, 
                            total: quantityInputProduct.computerInventory || 1 
                          };
                          return `範圍: 1 - ${currentQuantity.total - currentQuantity.scanned}`;
                        })()}
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <Button 
                        variant="outline"
                        onClick={handleQuantityCancel}
                        className="flex-1"
                    >
                        取消
                    </Button>
                    <Button 
                        onClick={handleQuantitySubmit}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                        確認
                    </Button>
                </div>
                
                <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded border">
                    💡 <strong>提示:</strong> 輸入數量後，系統會自動更新掃描進度，然後您可以繼續掃描其他產品或同一產品的剩餘數量。
                </div>
            </div>
        </DialogContent>
    </Dialog>

    {/* Manual Input Dialog */}
    <Dialog open={showManualInputDialog} onOpenChange={(open) => {
      if (!open) {
        handleManualInputCancel();
      }
    }}>
        <DialogContent className="sm:max-w-md max-w-[90vw]">
                         <DialogHeader>
                 <DialogTitle className="flex items-center gap-2">
                     <Edit3 className="h-5 w-5 text-blue-600" />
                     手動輸入條碼和數量
                 </DialogTitle>
                                 <DialogDescription>
                     當無法掃描條碼時，可以搜尋並選擇產品，然後輸入數量
                 </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
                                 <div className="space-y-2">
                     <Label htmlFor="manual-barcode">
                         產品條碼或名稱:
                     </Label>
                     <div className="relative">
                         <Input
                             id="manual-barcode"
                             type="text"
                             value={manualBarcode}
                             onChange={(e) => handleBarcodeInputChange(e.target.value)}
                             onKeyDown={handleKeyDown}
                             onBlur={() => {
                                 // Delay hiding suggestions to allow click on suggestion
                                 setTimeout(() => {
                                     setShowSuggestions(false);
                                     setSelectedSuggestionIndex(-1);
                                 }, 150);
                             }}
                             placeholder="搜尋條碼、產品名稱、類別或廠牌 (留空顯示全部)..."
                             className="font-mono"
                             autoFocus
                             autoComplete="off"
                         />
                         
                         {/* Suggestions Dropdown */}
                         {showSuggestions && productSuggestions.length > 0 && (
                             <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto">
                                 {productSuggestions.map((product, index) => {
                                     const currentQuantity = productQuantities.get(product._id!) || { 
                                         scanned: 0, 
                                         total: product.computerInventory || 1 
                                     };
                                     const isCompleted = currentQuantity.scanned >= currentQuantity.total;
                                     const CategoryIcon = categoryIcons[product.category] || categoryIcons.Default;
                                     
                                     return (
                                         <div
                                             key={product._id}
                                             className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-blue-50 ${
                                                 index === selectedSuggestionIndex ? 'bg-blue-100' : ''
                                             } ${isCompleted ? 'bg-green-50' : ''}`}
                                             onClick={() => handleSuggestionSelect(product)}
                                         >
                                             <div className="flex items-center justify-between">
                                                 <div className="flex-1 min-w-0">
                                                     <div className="flex items-center gap-2 mb-1">
                                                         <CategoryIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                                         <span className="text-sm font-medium truncate">
                                                             {product.name}
                                                         </span>
                                                         {isCompleted && (
                                                             <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                                         )}
                                                     </div>
                                                     <div className="flex items-center gap-2 text-xs text-gray-500">
                                                         <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                                                             {product.barcode}
                                                         </span>
                                                         <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                                                             {product.category}
                                                         </span>
                                                         {product.brand && (
                                                             <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                                                                 {product.brand}
                                                             </span>
                                                         )}
                                                     </div>
                                                 </div>
                                                 <div className="flex-shrink-0 ml-2">
                                                     <div className="text-right">
                                                         <div className={`text-xs font-medium ${isCompleted ? 'text-green-600' : 'text-blue-600'}`}>
                                                             {currentQuantity.scanned}/{currentQuantity.total}
                                                             {isCompleted && " ✅"}
                                                         </div>
                                                         <div className="text-xs text-gray-500">
                                                             庫存: {product.computerInventory || 0}
                                                         </div>
                                                         {!isCompleted && currentQuantity.scanned > 0 && (
                                                             <div className="text-xs text-orange-600">
                                                                 還需: {currentQuantity.total - currentQuantity.scanned}
                                                             </div>
                                                         )}
                                                     </div>
                                                 </div>
                                             </div>
                                         </div>
                                     );
                                 })}
                                 
                                 {/* Navigation hint */}
                                 <div className="p-2 bg-gray-50 border-t text-xs text-gray-500 text-center">
                                     <div className="mb-1">
                                         找到 {productSuggestions.length} 個產品
                                         {productSuggestions.length > 10 && <span className="ml-1">(可滾動查看更多)</span>}
                                     </div>
                                     <div>↑↓ 選擇 • Enter 確認 • Esc 關閉</div>
                                 </div>
                             </div>
                         )}
                         
                         {/* No results message */}
                         {showSuggestions && productSuggestions.length === 0 && manualBarcode.length > 0 && (
                             <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                                 <div className="text-sm text-gray-500 text-center">
                                     找不到匹配的產品
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
                
                <div className="space-y-2">
                    <Label htmlFor="manual-quantity">
                        檢查數量:
                    </Label>
                    <Input
                        id="manual-quantity"
                        type="number"
                        min="1"
                        value={manualQuantity}
                        onChange={(e) => setManualQuantity(e.target.value)}
                        placeholder="輸入數量"
                        className="text-center text-lg font-semibold"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleManualInput();
                          }
                        }}
                    />
                    <div className="text-xs text-muted-foreground text-center">
                        預設為 1，可根據實際檢查數量調整
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <Button 
                        variant="outline"
                        onClick={handleManualInputCancel}
                        className="flex-1"
                    >
                        取消
                    </Button>
                    <Button 
                        onClick={handleManualInput}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                        確認輸入
                    </Button>
                </div>
                
                                 <div className="text-xs text-orange-600 bg-orange-50 p-3 rounded border">
                     ⚠️ <strong>注意:</strong> 請確保選擇的產品正確無誤，數量不能超過剩餘未檢查數量。
                 </div>
                 
                 <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded border">
                     💡 <strong>搜尋提示:</strong>
                     <br />• 可以搜尋產品名稱、條碼、類別或廠牌
                     <br />• 留空搜尋框會顯示所有產品
                     <br />• 輸入時會自動顯示匹配的產品建議
                     <br />• 使用 ↑↓ 鍵選擇，Enter 確認，Esc 關閉建議
                     <br />• 綠色背景表示已完成檢查的產品
                     <br />• 可以多次輸入同一產品的不同數量
                 </div>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}

