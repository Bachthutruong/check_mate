
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import { seedDatabase } from '@/lib/seed';
import UserModel from '@/models/User';
import StoreModel from '@/models/Store';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    await connectMongo();
    try {
        const userCount = await UserModel.countDocuments();
        if (userCount === 0) {
            await seedDatabase();
        }
        // Explicitly exclude password
        const users = await UserModel.find({}).select('-password').lean(); 
        return NextResponse.json(JSON.parse(JSON.stringify(users)));
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ message: 'Error fetching users' }, { status: 500 });
    }
}

// This POST handler is now for internal use by admins creating other users (employees).
// It auto-generates username and password.
export async function POST(req: NextRequest) {
    await connectMongo();
    try {
        const body = await req.json();
        const { name, role, storeIds } = body;

        if (!name || !role) {
            return NextResponse.json({ message: 'Name and role are required' }, { status: 400 });
        }

        // Auto-generate username from name to ensure uniqueness
        let username = name.toLowerCase().replace(/\s+/g, '.') + Math.floor(Math.random() * 1000);
        let existingUser = await UserModel.findOne({ username }).lean();
        while (existingUser) {
            username = name.toLowerCase().replace(/\s+/g, '.') + Math.floor(Math.random() * 1000);
            existingUser = await UserModel.findOne({ username }).lean();
        }
        
        // Auto-generate a secure random password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        console.log(`Creating user '${name}' with username '${username}' and temp password '${tempPassword}'`);

        const newUser = await UserModel.create({
            name,
            username,
            password: hashedPassword,
            role,
            storeIds: storeIds || []
        });
        
        if (newUser.storeIds && newUser.storeIds.length > 0) {
            await StoreModel.updateMany(
                { _id: { $in: newUser.storeIds } },
                { $push: { employeeIds: newUser._id } }
            );
        }
        
        const userObject = newUser.toObject();
        // Do not return password, even the temporary one
        delete userObject.password;

        return NextResponse.json(JSON.parse(JSON.stringify(userObject)), { status: 201 });
    } catch (error: any) {
        console.error("Error creating user:", error);
        if (error.name === 'ValidationError') {
             return NextResponse.json({ message: 'Validation error', errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error creating user' }, { status: 500 });
    }
}
