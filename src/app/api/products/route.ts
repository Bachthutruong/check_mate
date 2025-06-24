import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import ProductModel from '@/models/Product';
import { verifyJwt } from '@/lib/auth';
import UserModel from '@/models/User';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyJwt(token);
    if (!decoded) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        await connectMongo();
        const { searchParams } = new URL(req.url);
        const storeId = searchParams.get('storeId');

        if (!storeId) {
            return NextResponse.json({ message: 'Store ID is required' }, { status: 400 });
        }

        const products = await ProductModel.find({ storeId }).lean();
        const sanitizedProducts = JSON.parse(JSON.stringify(products));

        console.log('GET /api/products - Found products:', products.length);
        console.log('Sample product from DB:', products[0]);
        console.log('Sanitized sample:', sanitizedProducts[0]);

        return NextResponse.json(sanitizedProducts);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Error fetching products' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyJwt(token);
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = (decoded as any).id as string;

    try {
        await connectMongo();
        
        const user = await UserModel.findById(userId).lean();
        if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

        const body = await req.json();
        const { products, replaceAll, storeId } = body;

        if (!products || !Array.isArray(products)) {
            return NextResponse.json({ message: 'Products array is required' }, { status: 400 });
        }

        // If replaceAll is true, delete all existing products for the store first
        if (replaceAll && storeId) {
            console.log('Deleting existing products for store:', storeId);
            const deleteResult = await ProductModel.deleteMany({ storeId: storeId });
            console.log('Deleted products count:', deleteResult.deletedCount);
        }

        const createdProducts = [];
        const updatedProducts = [];
        const errors = [];

        for (const productData of products) {
            try {
                console.log('API received product data:', productData);
                
                // Ensure numeric fields are properly converted
                const processedProductData = {
                    ...productData,
                    cost: Number(productData.cost) || 0,
                    computerInventory: Number(productData.computerInventory) || 0,
                    actualInventory: Number(productData.actualInventory) || 0,
                    differenceQuantity: Number(productData.differenceQuantity) || 0,
                    differenceAmount: Number(productData.differenceAmount) || 0,
                };
                
                console.log('Processed product data:', processedProductData);

                if (!replaceAll) {
                    // Check if product with same barcode and storeId already exists
                    const existingProduct = await ProductModel.findOne({
                        barcode: processedProductData.barcode,
                        storeId: processedProductData.storeId
                    });

                    if (existingProduct) {
                        // Update existing product
                        const updatedProduct = await ProductModel.findByIdAndUpdate(
                            existingProduct._id,
                            {
                                ...processedProductData,
                                // Keep the original _id and creation date
                            },
                            { new: true, runValidators: true }
                        );
                        updatedProducts.push(updatedProduct);
                        continue;
                    }
                }

                // Create new product (either replaceAll is true or product doesn't exist)
                const newProduct = new ProductModel(processedProductData);
                console.log('Creating new product with data:', processedProductData);
                console.log('Mongoose model fields:', Object.keys(newProduct.toObject()));
                
                const savedProduct = await newProduct.save();
                console.log('Successfully saved product:', savedProduct.toObject());
                createdProducts.push(savedProduct);
                
            } catch (error: any) {
                console.error('Error processing product:', productData, error);
                errors.push({
                    product: productData,
                    error: error.message
                });
            }
        }

        return NextResponse.json({
            message: 'Products processed successfully',
            created: createdProducts.length,
            updated: updatedProducts.length,
            errors: errors.length,
            createdProducts: JSON.parse(JSON.stringify(createdProducts)),
            updatedProducts: JSON.parse(JSON.stringify(updatedProducts)),
            errorDetails: errors
        }, { status: 201 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Error creating products' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyJwt(token);
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectMongo();
        
        const { searchParams } = new URL(req.url);
        const clearAll = searchParams.get('clearAll');
        
        if (clearAll === 'true') {
            // DANGER: This will delete ALL products
            const result = await ProductModel.deleteMany({});
            console.log('Cleared all products:', result.deletedCount);
            return NextResponse.json({ 
                message: 'All products cleared', 
                deletedCount: result.deletedCount 
            });
        }
        
        return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
        
    } catch (error) {
        console.error('Error clearing products:', error);
        return NextResponse.json({ message: 'Error clearing products' }, { status: 500 });
    }
}
