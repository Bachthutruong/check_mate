
import { Types } from 'mongoose';

export type User = {
  _id?: string;
  name: string;
  username: string;
  password?: string;
  role: 'admin' | 'employee';
  storeIds: string[];
};

export type Product = {
  _id?: string;
  name: string;
  category: string;
  barcode: string;
  storeId: string;
};

export type Store = {
  _id?: string;
  name: string;
  employeeIds: string[];
};

export type InventoryCheck = {
  _id?: string;
  storeId: string;
  storeName: string;
  employeeName: string;
  date: Date;
  status: 'Completed' | 'Shortage';
  checkedItems: string[];
  missingItems: Product[];
};

// Raw data for seeding the database
export const initialUsers = [
  { id: 1, name: 'Admin User', username: 'admin', password: 'password', role: 'admin', storeIds: [1, 2, 3] },
  { id: 2, name: 'John Doe', username: 'john', password: 'password', role: 'employee', storeIds: [1] },
  { id: 3, name: 'Jane Smith', username: 'jane', password: 'password', role: 'employee', storeIds: [2] },
  { id: 4, name: 'Emily White', username: 'emily', password: 'password', role: 'employee', storeIds: [1, 3] },
];

export const initialStores = [
    { id: 1, name: 'Main Street Store', employeeIds: [2, 4] },
    { id: 2, name: 'Downtown Branch', employeeIds: [3] },
    { id: 3, name: 'Uptown Boutique', employeeIds: [4] },
];

export const initialProducts = [
    { id: 101, name: 'T-Shirt - Red', category: 'Apparel', barcode: '1234567890123', storeId: 1 },
    { id: 102, name: 'Jeans - Blue', category: 'Apparel', barcode: '1234567890124', storeId: 1 },
    { id: 103, name: 'Sneakers - White', category: 'Footwear', barcode: '1234567890125', storeId: 1 },
    { id: 104, name: 'Laptop Pro', category: 'Electronics', barcode: '1234567890126', storeId: 1 },
    { id: 105, name: 'Wireless Mouse', category: 'Electronics', barcode: '1234567890127', storeId: 1 },
    { id: 106, name: 'Designer Handbag', category: 'Accessories', barcode: '1234567890128', storeId: 1 },
    
    { id: 201, name: 'T-Shirt - Black', category: 'Apparel', barcode: '1234567890223', storeId: 2 },
    { id: 202, name: 'Summer Dress', category: 'Apparel', barcode: '1234567890224', storeId: 2 },
    { id: 203, name: 'Sandals', category: 'Footwear', barcode: '1234567890225', storeId: 2 },
    { id: 204, name: 'Gaming PC', category: 'Electronics', barcode: '1234567890226', storeId: 2 },

    { id: 301, name: 'Formal Shirt', category: 'Apparel', barcode: '1234567890323', storeId: 3 },
    { id: 302, name: 'Leather Boots', category: 'Footwear', barcode: '1234567890325', storeId: 3 },
    { id: 303, name: 'Smart Watch', category: 'Accessories', barcode: '1234567890326', storeId: 3 },
];

export const initialInventoryChecks = [
    {
        id: 'hist1',
        storeId: 1,
        storeName: 'Main Street Store',
        employeeName: 'John Doe',
        date: new Date('2024-05-20T10:00:00Z'),
        status: 'Completed',
        checkedItems: [101, 102, 103, 104, 105, 106],
        missingItems: []
    },
    {
        id: 'hist2',
        storeId: 2,
        storeName: 'Downtown Branch',
        employeeName: 'Jane Smith',
        date: new Date('2024-05-21T14:30:00Z'),
        status: 'Shortage',
        checkedItems: [201, 203],
        missingItems: [202, 204]
    }
];
