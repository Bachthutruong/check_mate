
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import InventoryCheckModel from '@/models/InventoryCheck';
import ProductModel from '@/models/Product';
import { verifyJwt } from '@/lib/auth';
import UserModel from '@/models/User';

async function handler(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyJwt(token);
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const userId = decoded.id as string;

    await connectMongo();
    
    const user = await UserModel.findById(userId).lean();
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    if (req.method === 'GET') {
        try {
            const { searchParams } = new URL(req.url);
            const storeId = searchParams.get('storeId');

            let query: any = {};
            if (user.role === 'employee') {
                query.storeId = { $in: user.storeIds };
            } else if (user.role === 'admin' && storeId && storeId !== 'all') {
                query.storeId = storeId;
            }

            const checks = await InventoryCheckModel.find(query)
                .populate('missingItems')
                .sort({ date: -1 })
                .lean();

            const sanitizedChecks = JSON.parse(JSON.stringify(checks));
            return NextResponse.json(sanitizedChecks);

        } catch (error) {
            console.error(error);
            return NextResponse.json({ message: 'Error fetching inventory checks' }, { status: 500 });
        }
    }

    if (req.method === 'POST') {
        try {
            const body = await req.json();
            const { storeId, storeName, employeeName, checkedItems, missingItems } = body;

            const newCheck = new InventoryCheckModel({
                storeId,
                storeName,
                employeeName,
                date: new Date(),
                status: missingItems.length > 0 ? 'Shortage' : 'Completed',
                checkedItems,
                missingItems
            });

            await newCheck.save();
            return NextResponse.json(newCheck, { status: 201 });

        } catch (error) {
            console.error(error);
            return NextResponse.json({ message: 'Error creating inventory check' }, { status: 500 });
        }
    }

    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}

export { handler as GET, handler as POST };
