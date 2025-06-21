"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "admin") {
        router.replace("/dashboard/history");
      } else {
        router.replace("/dashboard/inventory");
      }
    }
  }, [user, isLoading, router]);

  return (
     <div className="flex h-full w-full items-center justify-center">
      <p>Loading your dashboard...</p>
    </div>
  );
}
