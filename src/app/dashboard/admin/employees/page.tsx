import { EmployeeManager } from "@/components/admin/employee-manager";

export default function ManageEmployeesPage() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Manage Employees</h1>
            </div>
            <EmployeeManager />
        </div>
    );
}
