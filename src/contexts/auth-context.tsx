"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, users } from '@/lib/data';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  login: (userId: number) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Simulate checking for a logged-in user in session storage
    try {
      const storedUser = sessionStorage.getItem('checkmate-user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from session storage", error);
      sessionStorage.removeItem('checkmate-user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (userId: number) => {
    const userToLogin = users.find(u => u.id === userId);
    if (userToLogin) {
      setUser(userToLogin);
      sessionStorage.setItem('checkmate-user', JSON.stringify(userToLogin));
      if (userToLogin.role === 'admin') {
        router.push('/dashboard/history');
      } else {
        router.push('/dashboard/inventory');
      }
    } else {
        console.error("User not found");
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('checkmate-user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
