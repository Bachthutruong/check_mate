"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Shield } from "lucide-react";
import { CreateUserDialog } from "./create-user-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface User {
  _id: string;
  name: string;
  username: string;
  role: 'admin' | 'employee';
  storeIds: string[];
}

interface Store {
  _id: string;
  name: string;
}

export function EmployeesManagement() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: users, isLoading: usersLoading, mutate: mutateUsers } = useSWR<User[]>('/api/users', fetcher);
  const { data: stores, isLoading: storesLoading } = useSWR<Store[]>('/api/stores', fetcher);

  const handleUserCreated = () => {
    mutateUsers(); // Refresh users list
  };

  const getStoreNames = (storeIds: string[]) => {
    if (!stores || storeIds.length === 0) return '無分配商店';
    
    const storeNames = storeIds
      .map(id => stores.find(store => store._id === id)?.name)
      .filter(Boolean);
    
    return storeNames.length > 0 ? storeNames.join(', ') : '無分配商店';
  };

  if (usersLoading || storesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                員工管理
              </CardTitle>
              <CardDescription>
                管理系統用戶和員工帳戶
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              創建新用戶
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">姓名</TableHead>
                  <TableHead className="w-[150px]">用戶名</TableHead>
                  <TableHead className="w-[100px]">角色</TableHead>
                  <TableHead className="w-[200px]">分配商店</TableHead>
                  <TableHead className="w-[80px]">狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users && users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {user.username}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? (
                            <>
                              <Shield className="mr-1 h-3 w-3" />
                              管理員
                            </>
                          ) : (
                            <>
                              <Users className="mr-1 h-3 w-3" />
                              員工
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.role === 'admin' ? (
                            <span className="text-muted-foreground">全部商店</span>
                          ) : (
                            <span title={getStoreNames(user.storeIds)}>
                              {getStoreNames(user.storeIds).length > 30 
                                ? `${getStoreNames(user.storeIds).substring(0, 30)}...` 
                                : getStoreNames(user.storeIds)
                              }
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          啟用
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <span className="text-muted-foreground">尚未創建任何用戶</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={handleUserCreated}
      />
    </div>
  );
} 