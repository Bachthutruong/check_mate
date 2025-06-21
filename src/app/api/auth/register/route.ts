
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import UserModel from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
    await connectMongo();

    try {
        const { name, username, password } = await req.json();

        if (!name || !username || !password) {
            return NextResponse.json({ message: 'Name, username, and password are required' }, { status: 400 });
        }

        const existingUser = await UserModel.findOne({ username }).lean();
        if (existingUser) {
            return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Use UserModel.create for a more direct and reliable save operation.
        const savedUser = await UserModel.create({
            name,
            username,
            password: hashedPassword,
            role: 'admin',
            storeIds: []
        });
        
        const userObject = savedUser.toObject();
        delete userObject.password;

        return NextResponse.json(userObject, { status: 201 });

    } catch (error: any) {
        console.error("Registration error:", error);
        if (error.name === 'ValidationError') {
            return NextResponse.json({ message: 'Validation error', errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error creating account' }, { status: 500 });
    }
}
