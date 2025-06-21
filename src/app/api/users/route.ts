
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import { seedDatabase } from '@/lib/seed';
import UserModel from '@/models/User';
import StoreModel from '@/models/Store';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
    await connectMongo();
    try {
        const userCount = await UserModel.countDocuments();
        if (userCount === 0) {
            await seedDatabase();
        }
        // .select('-password') is the default due to schema, but being explicit is fine
        const users = await UserModel.find({}).select('-password').lean(); 
        return NextResponse.json(JSON.parse(JSON.stringify(users)));
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ message: 'Error fetching users' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    await connectMongo();
    try {
        const body = await req.json();
        const { name, username, password, role, storeIds } = body;

        if (!name || !username || !password || !role) {
            return NextResponse.json({ message: 'Name, username, password, and role are required' }, { status: 400 });
        }

        const existingUser = await UserModel.findOne({ username });
        if (existingUser) {
            return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new UserModel({
            name,
            username,
            password: hashedPassword,
            role,
            storeIds: storeIds || []
        });
        
        await newUser.save();

        if (newUser.storeIds && newUser.storeIds.length > 0) {
            await StoreModel.updateMany(
                { _id: { $in: newUser.storeIds } },
                { $push: { employeeIds: newUser._id } }
            );
        }
        
        const userObject = newUser.toObject();
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
