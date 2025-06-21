
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import StoreModel from '@/models/Store';
import UserModel from '@/models/User';
import mongoose from 'mongoose';


async function handler(req: NextRequest, { params }: { params: { id: string } }) {
    await connectMongo();
    const id = params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

    if (req.method === 'PUT') {
        try {
            const { name } = await req.json();
            if (!name) {
                return NextResponse.json({ message: 'Name is required' }, { status: 400 });
            }
            const updatedStore = await StoreModel.findByIdAndUpdate(id, { name }, { new: true }).lean();
            if (!updatedStore) {
                return NextResponse.json({ message: 'Store not found' }, { status: 404 });
            }
            return NextResponse.json(JSON.parse(JSON.stringify(updatedStore)));
        } catch (error) {
            console.error(error);
            return NextResponse.json({ message: 'Error updating store' }, { status: 500 });
        }
    }

    if (req.method === 'DELETE') {
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

    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}


export { handler as PUT, handler as DELETE };

