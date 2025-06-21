// In a real app, this data would be fetched from a database like MongoDB.
// For this example, we're using in-memory arrays.

export type User = {
  id: number;
  name: string;
  role: 'admin' | 'employee';
  storeIds: number[];
};

export type Product = {
  id: number;
  name: string;
  category: string;
  barcode: string;
  storeId: number;
};

export type Store = {
  id: number;
  name: string;
  employeeIds: number[];
};

export type InventoryCheck = {
  id: string;
  storeId: number;
  storeName: string;
  employeeName: string;
  date: Date;
  status: 'Completed' | 'Shortage';
  checkedItems: number[];
  missingItems: Product[];
};

export let users: User[] = [
  { id: 1, name: 'Admin User', role: 'admin', storeIds: [1, 2, 3] },
  { id: 2, name: 'John Doe', role: 'employee', storeIds: [1] },
  { id: 3, name: 'Jane Smith', role: 'employee', storeIds: [2] },
  { id: 4, name: 'Emily White', role: 'employee', storeIds: [1, 3] },
];

export let stores: Store[] = [
    { id: 1, name: 'Main Street Store', employeeIds: [2, 4] },
    { id: 2, name: 'Downtown Branch', employeeIds: [3] },
    { id: 3, name: 'Uptown Boutique', employeeIds: [4] },
];

export const products: Product[] = [
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

export let inventoryChecks: InventoryCheck[] = [
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
        missingItems: products.filter(p => [202, 204].includes(p.id))
    }
];

// Function to add a new check, simulating a DB write
export const addInventoryCheck = (newCheck: InventoryCheck) => {
  inventoryChecks.unshift(newCheck);
};
