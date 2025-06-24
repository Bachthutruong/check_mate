import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import { seedDatabase } from '@/lib/seed';
import UserModel from '@/models/User';
import StoreModel from '@/models/Store';
import { verifyJwt } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyJwt(token);
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = (decoded as any).id as string;

    await connectMongo();
    try {
        // Verify user exists and has admin role
        const currentUser = await UserModel.findById(userId).select('role').lean() as { role: string } | null;
        if (!currentUser || currentUser.role !== 'admin') {
            return NextResponse.json({ message: 'Forbidden - Admin access required' }, { status: 403 });
        }

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
// Admin can specify username, name and password, or auto-generate them.
export async function POST(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyJwt(token);
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = (decoded as any).id as string;

    await connectMongo();
    try {
        // Verify user exists and has admin role
        const currentUser = await UserModel.findById(userId).select('role').lean() as { role: string } | null;
        if (!currentUser || currentUser.role !== 'admin') {
            return NextResponse.json({ message: 'Forbidden - Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        
        const name = body.name;
        const role = body.role || 'employee'; // Default to employee
        const storeIds = body.storeIds;
        let username = body.username;
        let password = body.password;

        if (!name) {
            return NextResponse.json({ message: 'Name is required' }, { status: 400 });
        }

        // Generate username if not provided
        if (!username) {
            username = name.toLowerCase().replace(/\s+/g, '.') + Math.floor(Math.random() * 1000);
            let existingUser = await UserModel.findOne({ username }).lean();
            while (existingUser) {
                username = name.toLowerCase().replace(/\s+/g, '.') + Math.floor(Math.random() * 1000);
                existingUser = await UserModel.findOne({ username }).lean();
            }
        } else {
            // Check if username already exists
            const existingUser = await UserModel.findOne({ username }).lean();
            if (existingUser) {
                return NextResponse.json({ message: 'Username already exists' }, { status: 400 });
            }
        }

        // Generate password if not provided
        if (!password) {
            password = crypto.randomBytes(8).toString('hex');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log(`Creating user '${name}' with username '${username}' and password '${password}'`);

        // Use UserModel.create for a more direct and reliable save operation.
        const newUser = await UserModel.create({
            name: name,
            username: username,
            password: hashedPassword,
            role: role,
            storeIds: storeIds || []
        });

        if (newUser.storeIds && newUser.storeIds.length > 0) {
            await StoreModel.updateMany(
                { _id: { $in: newUser.storeIds } },
                { $push: { employeeIds: newUser._id } }
            );
        }
        
        const userObject = newUser.toObject();
        // Return the plain password for admin to share with new user
        const responseUser = {
            ...userObject,
            tempPassword: password // Include plain password in response for admin
        };
        delete responseUser.password; // Remove hashed password

        return NextResponse.json(responseUser, { status: 201 });
    } catch (error: any) {
        console.error("Error creating user:", error);
        if (error.name === 'ValidationError') {
             return NextResponse.json({ message: 'Validation error', errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error creating user' }, { status: 500 });
    }
}
