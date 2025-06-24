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
  brand?: string;
  barcode: string;
  cost?: number;
  computerInventory?: number;
  actualInventory?: number;
  differenceQuantity?: number;
  differenceAmount?: number;
  notes?: string;
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
    { id: 1, name: '【使用】天水店', employeeIds: [2, 4] },
    { id: 2, name: '【使用】明成店', employeeIds: [3] },
    { id: 3, name: '【使用】實年店', employeeIds: [4] },
];

export const initialProducts = [
    { 
        id: 101, 
        name: '大蟲-專案手機攝站', 
        category: '專案手機攝站', 
        brand: '大蟲',
        barcode: 'EEE03002000', 
        cost: 0,
        computerInventory: 0,
        actualInventory: -1,
        differenceQuantity: 0,
        differenceAmount: 0,
        notes: '',
        storeId: 1 
    },
    { 
        id: 102, 
        name: '威登-專案手機攝站', 
        category: '專案手機攝站', 
        brand: '威登',
        barcode: 'EEE03009000', 
        cost: 0,
        computerInventory: 0,
        actualInventory: -795,
        differenceQuantity: 0,
        differenceAmount: 0,
        notes: '',
        storeId: 1 
    },
    { 
        id: 103, 
        name: '光纖實類', 
        category: '實類', 
        brand: 'TS實類',
        barcode: '02C030E000', 
        cost: 0,
        computerInventory: 0,
        actualInventory: -16,
        differenceQuantity: 0,
        differenceAmount: 0,
        notes: '',
        storeId: 1 
    },
    { 
        id: 104, 
        name: '威登-攝重類', 
        category: '攝重類', 
        brand: '威登',
        barcode: 'DD003009001', 
        cost: 0,
        computerInventory: 0,
        actualInventory: -181,
        differenceQuantity: 0,
        differenceAmount: 0,
        notes: '',
        storeId: 1 
    },
    { 
        id: 105, 
        name: '威登攝约', 
        category: '攝约頻', 
        brand: '威登',
        barcode: '01B03009001', 
        cost: 0,
        computerInventory: 0,
        actualInventory: -1009,
        differenceQuantity: 0,
        differenceAmount: 0,
        notes: '',
        storeId: 1 
    },
    { 
        id: 201, 
        name: '台吾大- Catch 99 (6)', 
        category: 'Catch99(6)', 
        brand: 'Catch 99 (6)',
        barcode: 'BBBB001001', 
        cost: 0,
        computerInventory: 0,
        actualInventory: 0,
        differenceQuantity: 0,
        differenceAmount: 0,
        notes: '',
        storeId: 2 
    },
    { 
        id: 202, 
        name: 'SAMSUNG-C5180皇', 
        category: '行動電話類', 
        brand: 'SAMSUNG',
        barcode: '001000IL045', 
        cost: 2000,
        computerInventory: 2000,
        actualInventory: -2,
        differenceQuantity: 0,
        differenceAmount: 0,
        notes: '',
        storeId: 2 
    },
    { 
        id: 203, 
        name: 'PHS-PG1910(皇)', 
        category: '序號行動電話', 
        brand: 'PHS',
        barcode: '11B0001G004', 
        cost: 4600,
        computerInventory: 4600,
        actualInventory: -1,
        differenceQuantity: 0,
        differenceAmount: 0,
        notes: '',
        storeId: 2 
    },
];

export const initialInventoryChecks = [
    {
        id: 'hist1',
        storeId: 1,
        storeName: '【使用】天水店',
        employeeName: 'John Doe',
        date: new Date('2024-05-20T10:00:00Z'),
        status: 'Completed',
        checkedItems: [101, 102, 103, 104, 105],
        missingItems: []
    },
    {
        id: 'hist2',
        storeId: 2,
        storeName: '【使用】明成店',
        employeeName: 'Jane Smith',
        date: new Date('2024-05-21T14:30:00Z'),
        status: 'Shortage',
        checkedItems: [201, 203],
        missingItems: [202]
    }
];
