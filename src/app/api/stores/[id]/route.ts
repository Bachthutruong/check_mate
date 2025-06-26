import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import StoreModel from '@/models/Store';
import UserModel from '@/models/User';
import mongoose from 'mongoose';

export async function GET(req: NextRequest, { params: { id } }: { params: { id: string } }) {
    await connectMongo();

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

    try {
        const store = await StoreModel.findById(id).lean();
        if (!store) {
            return NextResponse.json({ message: 'Store not found' }, { status: 404 });
        }
        return NextResponse.json(JSON.parse(JSON.stringify(store)));
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Error fetching store' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params: { id } }: { params: { id: string } }) {
    await connectMongo();

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

    try {
        const { name } = await req.json();
        if (!name) {
            return NextResponse.json({ message: 'Name is required' }, { status: 400 });
        }

        // Check if another store with this name already exists (excluding current store)
        const existingStore = await StoreModel.findOne({ 
            name: name.trim(), 
            _id: { $ne: id } 
        });
        
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

        const updatedStore = await StoreModel.findByIdAndUpdate(
            id, 
            { name: name.trim() }, 
            { new: true }
        ).lean();
        
        if (!updatedStore) {
            return NextResponse.json({ message: 'Store not found' }, { status: 404 });
        }
        
        return NextResponse.json(JSON.parse(JSON.stringify(updatedStore)));
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
            message: 'Error updating store',
            error: error.message || 'Unknown error occurred'
        }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params: { id } }: { params: { id: string } }) {
    await connectMongo();

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

    try {
        const deletedStore = await StoreModel.findByIdAndDelete(id);
        if (!deletedStore) {
            return NextResponse.json({ message: 'Store not found' }, { status: 404 });
        }
        // Remove store from all users
        await UserModel.updateMany(
            { storeIds: id },
            { $pull: { storeIds: id } }
        );

        return NextResponse.json({ message: 'Store deleted' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Error deleting store' }, { status: 500 });
    }
}

