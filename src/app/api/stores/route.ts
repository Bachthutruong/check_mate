
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import { seedDatabase } from '@/lib/seed';
import StoreModel from '@/models/Store';

async function handler(req: NextRequest) {
    await connectMongo();
    
    // Auto-seed if empty
    const count = await StoreModel.countDocuments();
    if (count === 0) {
        await seedDatabase();
    }

    if (req.method === 'GET') {
        try {
            const stores = await StoreModel.find({}).populate('employeeIds').lean();
            const sanitizedStores = JSON.parse(JSON.stringify(stores));
            return NextResponse.json(sanitizedStores);
        } catch (error) {
            console.error(error);
            return NextResponse.json({ message: 'Error fetching stores' }, { status: 500 });
        }
    }

    if (req.method === 'POST') {
        try {
            const { name } = await req.json();
            if (!name) {
                return NextResponse.json({ message: 'Name is required' }, { status: 400 });
            }
            const newStore = new StoreModel({ name, employeeIds: [] });
            await newStore.save();
            const sanitizedStore = JSON.parse(JSON.stringify(newStore));
            return NextResponse.json(sanitizedStore, { status: 201 });
        } catch (error) {
            console.error(error);
            return NextResponse.json({ message: 'Error creating store' }, { status: 500 });
        }
    }

    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}

export { handler as GET, handler as POST };
