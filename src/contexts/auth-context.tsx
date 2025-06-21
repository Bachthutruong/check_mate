
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import useSWR, { SWRConfig } from 'swr';
import { User } from '@/lib/data';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  login: (credentials: {username: string, password: string}) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  mutateUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const fetcher = (url: string) => fetch(url).then(res => {
  if (res.status === 204 || res.status === 401) return null;
  if (!res.ok) throw new Error('An error occurred while fetching the data.');
  return res.json();
});

function AuthProviderContent({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: user, error, isLoading, mutate } = useSWR<User | null>('/api/auth/user', fetcher);
  const { toast } = useToast();

  const login = async (credentials: {username: string, password: string}) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        const errorData = await res.json();
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: errorData.message || "An unknown error occurred.",
        });
        return;
      }

      const loggedInUser = await res.json();
      await mutate(loggedInUser, false); // Update SWR cache without re-fetching
      
      if (loggedInUser.role === 'admin') {
        router.push('/dashboard/history');
      } else {
        router.push('/dashboard/inventory');
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "A network error occurred. Please try again.",
      });
    }
  };

  const logout = async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        await mutate(null, false); // Clear user data from cache
        router.push('/login');
    } catch (error) {
        console.error("Logout failed:", error);
        toast({ variant: "destructive", title: "Logout Failed", description: "An error occurred during logout." });
    }
  };
  
  return (
    <AuthContext.Provider value={{ user: user || null, login, logout, isLoading, mutateUser: mutate }}>
      {children}
    </AuthContext.Provider>
  );
}


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  return (
      <SWRConfig value={{ fetcher }}>
          <AuthProviderContent>{children}</AuthProviderContent>
      </SWRConfig>
  );
};


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
