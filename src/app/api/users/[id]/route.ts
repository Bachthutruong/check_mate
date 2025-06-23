import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import UserModel from '@/models/User';
import StoreModel from '@/models/Store';
import mongoose from 'mongoose';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    await connectMongo();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    await connectMongo();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }

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

