
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

            // Check if store with this name already exists
            const existingStore = await StoreModel.findOne({ name: name.trim() });
            if (existingStore) {
                return NextResponse.json({ 
                    message: 'Store with this name already exists',
                    error: 'DUPLICATE_STORE_NAME',
                    existingStore: {
                        _id: existingStore._id,
                        name: existingStore.name
                    }
                }, { status: 409 });
            }

            const newStore = new StoreModel({ name: name.trim(), employeeIds: [] });
            await newStore.save();
            const sanitizedStore = JSON.parse(JSON.stringify(newStore));
            return NextResponse.json(sanitizedStore, { status: 201 });
        } catch (error: any) {
            console.error(error);
            
            // Handle MongoDB duplicate key error specifically
            if (error.code === 11000) {
                return NextResponse.json({ 
                    message: 'Store with this name already exists',
                    error: 'DUPLICATE_STORE_NAME',
                    details: 'A store with this name is already registered in the system'
                }, { status: 409 });
            }
            
            return NextResponse.json({ 
                message: 'Error creating store',
                error: error.message || 'Unknown error occurred'
            }, { status: 500 });
        }
    }

    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}

export { handler as GET, handler as POST };
