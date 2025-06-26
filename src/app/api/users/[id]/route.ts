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
        const { name, username, password, role, storeIds } = await req.json();
        
        // Check if username is already taken by another user
        if (username) {
            const existingUser = await UserModel.findOne({ username, _id: { $ne: id } });
            if (existingUser) {
                return NextResponse.json({ message: 'Username already exists' }, { status: 400 });
            }
        }
        
        const updateData: any = { name, role, storeIds };
        if (username) {
            updateData.username = username;
        }
        
        // Only update password if provided
        if (password && password.trim() !== '') {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }
        
        const updatedUser = await UserModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).lean();

        if (!updatedUser) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        // Also update stores
        await StoreModel.updateMany({ employeeIds: id }, { $pull: { employeeIds: id } });
        await StoreModel.updateMany({ _id: { $in: storeIds } }, { $addToSet: { employeeIds: id } });

        const sanitizedUser = JSON.parse(JSON.stringify(updatedUser));
        // Remove password from response
        delete sanitizedUser.password;
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

