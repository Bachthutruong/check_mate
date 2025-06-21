
import mongoose from 'mongoose';
import UserModel from '@/models/User';
import StoreModel from '@/models/Store';
import ProductModel from '@/models/Product';
import InventoryCheckModel from '@/models/InventoryCheck';
import { initialUsers, initialStores, initialProducts, initialInventoryChecks } from './data';

export const seedDatabase = async () => {
    console.log('Seeding database...');
    try {
        await UserModel.deleteMany({});
        await StoreModel.deleteMany({});
        await ProductModel.deleteMany({});
        await InventoryCheckModel.deleteMany({});
        
        console.log('Cleared existing data.');

        const tempIdToMongoId: { [key: string]: mongoose.Types.ObjectId } = {};

        const createdStores = await StoreModel.insertMany(initialStores.map(s => ({name: s.name, employeeIds: []})));
        createdStores.forEach((store, index) => {
            tempIdToMongoId[`store_${initialStores[index].id}`] = store._id;
        });
        console.log('Seeded stores.');

        const usersToCreate = initialUsers.map(user => ({
            name: user.name,
            role: user.role,
            storeIds: user.storeIds.map(id => tempIdToMongoId[`store_${id}`])
        }));
        const createdUsers = await UserModel.insertMany(usersToCreate);
        createdUsers.forEach((user, index) => {
            tempIdToMongoId[`user_${initialUsers[index].id}`] = user._id;
        });
        console.log('Seeded users.');
        
        // Update stores with employeeIds
        for (const storeData of initialStores) {
            const storeMongoId = tempIdToMongoId[`store_${storeData.id}`];
            const employeeMongoIds = storeData.employeeIds.map(empId => tempIdToMongoId[`user_${empId}`]);
            await StoreModel.findByIdAndUpdate(storeMongoId, { $set: { employeeIds: employeeMongoIds } });
        }
        console.log('Updated stores with employee IDs.');


        const productsToCreate = initialProducts.map(p => ({
            ...p,
            storeId: tempIdToMongoId[`store_${p.storeId}`]
        }));
        const createdProducts = await ProductModel.insertMany(productsToCreate);
        createdProducts.forEach((prod, index) => {
            tempIdToMongoId[`product_${initialProducts[index].id}`] = prod._id;
        });
        console.log('Seeded products.');
        
        const checksToCreate = initialInventoryChecks.map(c => ({
            ...c,
            storeId: tempIdToMongoId[`store_${c.storeId}`],
            checkedItems: c.checkedItems.map(id => tempIdToMongoId[`product_${id}`]),
            missingItems: c.missingItems.map(id => tempIdToMongoId[`product_${id}`]),
        }));

        await InventoryCheckModel.insertMany(checksToCreate);
        console.log('Seeded inventory checks.');
        
        console.log('Database seeded successfully.');

    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    }
};
