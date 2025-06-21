
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import ProductModel from '@/models/Product';
import { verifyJwt } from '@/lib/auth';

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

        return NextResponse.json(sanitizedProducts);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Error fetching products' }, { status: 500 });
    }
}
