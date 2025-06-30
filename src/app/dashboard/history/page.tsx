import { HistoryView } from "@/components/inventory/history-view";

export default function HistoryPage() {
  return (
    <div className="space-y-4">
      {/* <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Inventory History</h1>
      </div> */}
      <HistoryView />
    </div>
  );
}
