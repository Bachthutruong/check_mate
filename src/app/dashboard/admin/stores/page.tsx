import { StoreManager } from "@/components/admin/store-manager";

export default function ManageStoresPage() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Manage Stores</h1>
            </div>
            <StoreManager />
        </div>
    );
}
