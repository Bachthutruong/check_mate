"use client";

import { useAuth } from "@/contexts/auth-context";
import { EmployeesManagement } from "@/components/admin/employees-management";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

export default function ManageEmployeesPage() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">員工管理</h1>
                <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                        您沒有權限訪問此頁面。只有管理員可以管理員工帳戶。
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">員工管理</h1>
            </div>
            <EmployeesManagement />
        </div>
    );
}
