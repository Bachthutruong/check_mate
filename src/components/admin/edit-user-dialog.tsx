"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Store } from "@/lib/data";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface EditUserForm {
  name: string;
  username: string;
  password?: string;
  role: 'admin' | 'employee';
  storeIds: string[];
}

interface User {
  _id: string;
  name: string;
  username: string;
  role: 'admin' | 'employee';
  storeIds: string[];
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
  user: User | null;
}

export function EditUserDialog({ open, onOpenChange, onUserUpdated, user }: EditUserDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  
  const { data: stores } = useSWR<Store[]>('/api/stores', fetcher);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<EditUserForm>();

  const selectedRole = watch('role');

  // Reset form when user or dialog opens
  useEffect(() => {
    if (user && open) {
      setValue('name', user.name);
      setValue('username', user.username);
      setValue('role', user.role);
      setValue('password', ''); // Clear password field for edit
      setSelectedStores(user.storeIds || []);
    }
  }, [user, open, setValue]);

  // Clean up when dialog closes
  useEffect(() => {
    if (!open) {
      reset();
      setSelectedStores([]);
      setIsLoading(false);
    }
  }, [open, reset]);

  const onSubmit = async (data: EditUserForm) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Only send password if it's filled
      const updateData: any = {
        name: data.name,
        username: data.username,
        role: data.role,
        storeIds: selectedRole === 'employee' ? selectedStores : []
      };

      // Only include password if it's provided
      if (data.password && data.password.trim() !== '') {
        updateData.password = data.password;
      }

      const response = await fetch(`/api/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      const updatedUser = await response.json();
      
      // Clear loading state immediately
      setIsLoading(false);
      
      toast({
        title: "用戶更新成功",
        description: `用戶 ${updatedUser.name} 已更新。`,
      });

      // Small delay to ensure toast shows, then notify parent
      setTimeout(() => {
        onUserUpdated();
      }, 100);
      
    } catch (error: any) {
      setIsLoading(false); // Ensure loading is cleared on error
      toast({
        variant: "destructive",
        title: "更新失敗",
        description: error.message,
      });
    }
  };

  const handleStoreToggle = (storeId: string, checked: boolean) => {
    if (checked) {
      setSelectedStores(prev => [...prev, storeId]);
    } else {
      setSelectedStores(prev => prev.filter(id => id !== storeId));
    }
  };

  const handleCancel = () => {
    setIsLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>編輯用戶</DialogTitle>
          <DialogDescription>
            修改用戶信息。密碼留空則保持不變。
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">姓名 *</Label>
            <Input
              id="edit-name"
              {...register("name", { required: "姓名是必填項" })}
              placeholder="輸入用戶姓名"
              disabled={isLoading}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-username">用戶名 *</Label>
            <Input
              id="edit-username"
              {...register("username", { required: "用戶名是必填項" })}
              placeholder="輸入用戶名"
              disabled={isLoading}
            />
            {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password">密碼</Label>
            <Input
              id="edit-password"
              type="password"
              {...register("password")}
              placeholder="留空保持原密碼不變"
              disabled={isLoading}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">角色</Label>
            <Select
              value={selectedRole}
              onValueChange={(value: 'admin' | 'employee') => setValue('role', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">員工</SelectItem>
                <SelectItem value="admin">管理員</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedRole === 'employee' && stores && (
            <div className="space-y-2">
              <Label>分配商店</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {stores.map((store) => (
                  <div key={store._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-store-${store._id}`}
                      checked={selectedStores.includes(store._id!)}
                      onCheckedChange={(checked) => 
                        handleStoreToggle(store._id!, checked as boolean)
                      }
                      disabled={isLoading}
                    />
                    <Label 
                      htmlFor={`edit-store-${store._id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {store.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "更新中..." : "更新用戶"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 