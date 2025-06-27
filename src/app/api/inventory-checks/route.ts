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
    const userId = (decoded as any).id as string;

    await connectMongo();
    
    const user = await UserModel.findById(userId).lean() as any;
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    if (req.method === 'GET') {
        try {
            const { searchParams } = new URL(req.url);
            const storeId = searchParams.get('storeId');
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '10');

            let query: any = {};
            
            // Store filtering
            if ((user as any).role === 'employee') {
                query.storeId = { $in: (user as any).storeIds };
            } else if ((user as any).role === 'admin' && storeId && storeId !== 'all') {
                query.storeId = storeId;
            }

            // Date filtering
            if (startDate || endDate) {
                query.date = {};
                if (startDate) {
                    // Set start of day for startDate
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    query.date.$gte = start;
                }
                if (endDate) {
                    // Set end of day for endDate
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    query.date.$lte = end;
                }
            }

            // Get total count for pagination
            const total = await InventoryCheckModel.countDocuments(query);
            
            // Calculate pagination
            const totalPages = Math.ceil(total / limit);
            const skip = (page - 1) * limit;
            const hasNext = page < totalPages;
            const hasPrev = page > 1;

            const checks = await InventoryCheckModel.find(query)
                .populate('missingItems')
                .populate('checkedItems')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const sanitizedChecks = JSON.parse(JSON.stringify(checks));
            
            // Return paginated response
            const response = {
                checks: sanitizedChecks,
                total,
                totalPages,
                currentPage: page,
                hasNext,
                hasPrev
            };
            
            return NextResponse.json(response);

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
