"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Shield, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { CreateUserDialog } from "./create-user-dialog";
import { EditUserDialog } from "./edit-user-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import React from "react";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const { toast } = useToast();

  const { data: users, isLoading: usersLoading, mutate: mutateUsers } = useSWR<User[]>('/api/users', fetcher);
  const { data: stores, isLoading: storesLoading } = useSWR<Store[]>('/api/stores', fetcher);

  const handleUserCreated = async () => {
    try {
      await mutateUsers(); // Wait for users to refresh
    } catch (error) {
      console.error('Error refreshing users:', error);
    }
  };

  const handleUserUpdated = async () => {
    try {
      // First close the dialog and clear state immediately
      setEditDialogOpen(false);
      setSelectedUser(null);
      
      // Then refresh the data
      await mutateUsers();
    } catch (error) {
      console.error('Error refreshing users:', error);
      // Even if refresh fails, ensure dialog is closed
      setEditDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    try {
      const response = await fetch(`/api/users/${user._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      toast({
        title: "用戶刪除成功",
        description: `用戶 ${user.name} 已被刪除。`,
      });

      await mutateUsers();
      setUserToDelete(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "刪除失敗",
        description: error.message,
      });
      setUserToDelete(null); // Ensure dialog closes even on error
    }
  };

  const getUserStores = (user: User) => {
    if (!stores || user.storeIds.length === 0) return [];
    return stores.filter(store => user.storeIds.includes(store._id));
  };

  const handleEditDialogClose = (open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setSelectedUser(null);
    }
  };

  const forceCloseAllDialogs = () => {
    setEditDialogOpen(false);
    setCreateDialogOpen(false);
    setSelectedUser(null);
    setUserToDelete(null);
  };

  // Emergency cleanup effect
  React.useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        forceCloseAllDialogs();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

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
            <div className="flex items-center gap-2">
              {/* Debug: Force close all dialogs button (only show if any dialog is open) */}
              {(editDialogOpen || createDialogOpen || userToDelete) && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={forceCloseAllDialogs}
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                >
                  強制關閉對話框
                </Button>
              )}
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                創建新用戶
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="w-full">
            <div className="rounded-md border overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ maxWidth: '90vw' }}>
              <Table className="w-full table-fixed min-w-[850px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px] text-xs">姓名</TableHead>
                    <TableHead className="w-[130px] text-xs">用戶名</TableHead>
                    <TableHead className="w-[100px] text-xs">角色</TableHead>
                    <TableHead className="w-[280px] text-xs">分配商店</TableHead>
                    <TableHead className="w-[80px] text-xs">狀態</TableHead>
                    <TableHead className="w-[90px] text-right text-xs">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users && users.length > 0 ? (
                    users.map((user) => {
                      const userStores = getUserStores(user);
                      
                      return (
                        <TableRow key={user._id} className="[&>td]:py-3">
                          <TableCell className="font-medium">
                            <div className="text-xs font-medium" title={user.name}>
                              {user.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded whitespace-nowrap">
                              {user.username}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs whitespace-nowrap w-fit">
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
                            <div className="max-w-[260px]">
                              {user.role === 'admin' ? (
                                <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
                                  全部商店
                                </Badge>
                              ) : userStores.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {userStores.map((store) => (
                                    <Badge 
                                      key={store._id} 
                                      variant="outline" 
                                      className="text-[10px] whitespace-nowrap"
                                    >
                                      {store.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
                                  無分配商店
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs text-green-600 border-green-600 whitespace-nowrap w-fit">
                              啟用
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-7 w-7 p-0">
                                  <span className="sr-only">打開菜單</span>
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => handleEditUser(user)}
                                  className="cursor-pointer text-xs"
                                >
                                  <Edit className="mr-2 h-3 w-3" />
                                  編輯
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setUserToDelete(user)}
                                  className="cursor-pointer text-xs text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-3 w-3" />
                                  刪除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-8 w-8 text-muted-foreground" />
                          <span className="text-muted-foreground text-sm">尚未創建任何用戶</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={handleUserCreated}
      />

      {/* Edit User Dialog */}
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        onUserUpdated={handleUserUpdated}
        user={selectedUser}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要刪除用戶 "{userToDelete?.name}" 嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => userToDelete && handleDeleteUser(userToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 