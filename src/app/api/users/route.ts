
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import { seedDatabase } from '@/lib/seed';
import UserModel from '@/models/User';
import StoreModel from '@/models/Store';
import bcrypt from 'bcryptjs';

async function handler(req: NextRequest) {
    await connectMongo();

    // Auto-seed if empty
    const userCount = await UserModel.countDocuments();
    if (userCount === 0) {
        try {
            await seedDatabase();
        } catch (seedError) {
            console.error("Seeding failed:", seedError);
            return NextResponse.json({ message: 'Database seeding failed' }, { status: 500 });
        }
    }

    if (req.method === 'GET') {
        try {
            const users = await UserModel.find({}).select('-password').lean();
            // Convert ObjectIds to strings for serialization
            const sanitizedUsers = JSON.parse(JSON.stringify(users));
            return NextResponse.json(sanitizedUsers);
        } catch (error) {
            console.error(error);
            return NextResponse.json({ message: 'Error fetching users' }, { status: 500 });
        }
    }

    if (req.method === 'POST') {
        try {
            const { name, username, password, role, storeIds } = await req.json();
            
            if (!name || !username || !password || !role) {
                return NextResponse.json({ message: 'Name, username, password and role are required' }, { status: 400 });
            }

            const existingUser = await UserModel.findOne({ username });
            if (existingUser) {
                return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = new UserModel({ 
                name, 
                username, // Ensure username is saved
                password: hashedPassword, // Ensure password is saved
                role, 
                storeIds: storeIds || [] 
            });
            await newUser.save();

            // Add user to specified stores
            if (storeIds && storeIds.length > 0) {
                await StoreModel.updateMany(
                    { _id: { $in: storeIds } },
                    { $push: { employeeIds: newUser._id } }
                );
            }
            
            // Exclude password from the returned object
            const { password: _, ...sanitizedUser } = newUser.toObject();
            return NextResponse.json(JSON.parse(JSON.stringify(sanitizedUser)), { status: 201 });
        } catch (error) {
            console.error(error);
            return NextResponse.json({ message: 'Error creating user' }, { status: 500 });
        }
    }

    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}

export { handler as GET, handler as POST };
