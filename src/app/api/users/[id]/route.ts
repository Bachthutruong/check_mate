
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import UserModel from '@/models/User';
import StoreModel from '@/models/Store';
import mongoose from 'mongoose';

async function handler(req: NextRequest, { params }: { params: { id: string } }) {
    await connectMongo();
    const id = params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

    if (req.method === 'PUT') {
        try {
            const { name, role, storeIds } = await req.json();
            const updatedUser = await UserModel.findByIdAndUpdate(
                id,
                { name, role, storeIds },
                { new: true }
            ).lean();

            if (!updatedUser) {
                return NextResponse.json({ message: 'User not found' }, { status: 404 });
            }

            // Also update stores
            await StoreModel.updateMany({ employeeIds: id }, { $pull: { employeeIds: id } });
            await StoreModel.updateMany({ _id: { $in: storeIds } }, { $addToSet: { employeeIds: id } });

            const sanitizedUser = JSON.parse(JSON.stringify(updatedUser));
            return NextResponse.json(sanitizedUser);

        } catch (error) {
            console.error(error);
            return NextResponse.json({ message: 'Error updating user' }, { status: 500 });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const deletedUser = await UserModel.findByIdAndDelete(id);
            if (!deletedUser) {
                return NextResponse.json({ message: 'User not found' }, { status: 404 });
            }
            // Remove user from all stores
            await StoreModel.updateMany(
                { employeeIds: id },
                { $pull: { employeeIds: id } }
            );
            return NextResponse.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error(error);
            return NextResponse.json({ message: 'Error deleting user' }, { status: 500 });
        }
    }

    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}

export { handler as PUT, handler as DELETE };

