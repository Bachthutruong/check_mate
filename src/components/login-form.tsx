
"use client";

import * as React from "react";
import useSWR from 'swr';
import { useAuth } from "@/contexts/auth-context";
import { User } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function LoginForm() {
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const { login, user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { data: users, error, isLoading: usersLoading } = useSWR<User[]>('/api/users', fetcher);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserId) {
      await login(selectedUserId);
    } else {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Please select a user to continue.",
      });
    }
  };
  
  React.useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const isLoading = isAuthLoading || usersLoading;

  return (
    <form onSubmit={handleLogin}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="user-select">Select User</Label>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : error ? (
              <div className="text-destructive">Failed to load users. Please refresh.</div>
            ) : (
              <Select onValueChange={setSelectedUserId} value={selectedUserId}>
                <SelectTrigger id="user-select" className="w-full">
                  <SelectValue placeholder="Select a user to sign in..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user._id} value={String(user._id)}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading || !selectedUserId}>
            {isAuthLoading ? 'Signing In...' : 'Sign In'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
