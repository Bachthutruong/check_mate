import { InventoryCheckClient } from "@/components/inventory/inventory-check-client";

export default function InventoryPage() {
  return (
    <div className="space-y-4">
        {/* <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Inventory Check</h1>
        </div> */}
        <InventoryCheckClient />
    </div>
  );
}
