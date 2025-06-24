"use client";

import { useState } from "react";
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

interface CreateUserForm {
  name: string;
  username: string;
  password: string;
  role: 'admin' | 'employee';
  storeIds: string[];
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) {
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
  } = useForm<CreateUserForm>({
    defaultValues: {
      role: 'employee'
    }
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: CreateUserForm) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          storeIds: selectedRole === 'employee' ? selectedStores : []
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      const newUser = await response.json();
      
      toast({
        title: "用戶創建成功",
        description: `用戶 ${newUser.name} 已創建。${newUser.tempPassword ? `臨時密碼: ${newUser.tempPassword}` : ''}`,
      });

      reset();
      setSelectedStores([]);
      onUserCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "創建失敗",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStoreToggle = (storeId: string, checked: boolean) => {
    if (checked) {
      setSelectedStores(prev => [...prev, storeId]);
    } else {
      setSelectedStores(prev => prev.filter(id => id !== storeId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>創建新用戶</DialogTitle>
          <DialogDescription>
            填寫用戶信息創建新帳戶。如果留空用戶名或密碼，系統將自動生成。
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">姓名 *</Label>
            <Input
              id="name"
              {...register("name", { required: "姓名是必填項" })}
              placeholder="輸入用戶姓名"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">用戶名</Label>
            <Input
              id="username"
              {...register("username")}
              placeholder="留空自動生成"
            />
            {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密碼</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              placeholder="留空自動生成"
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">角色</Label>
            <Select
              value={selectedRole}
              onValueChange={(value: 'admin' | 'employee') => setValue('role', value)}
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
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {stores.map((store) => (
                  <div key={store._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={store._id}
                      checked={selectedStores.includes(store._id!)}
                      onCheckedChange={(checked) => 
                        handleStoreToggle(store._id!, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={store._id} 
                      className="text-sm font-normal cursor-pointer"
                    >
                      {store.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "創建中..." : "創建用戶"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 