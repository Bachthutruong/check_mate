
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import useSWR, { SWRConfig } from 'swr';
import { User } from '@/lib/data';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  login: (userId: string) => Promise<void>;
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

  const login = async (userId: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Login failed");
      }
      const loggedInUser = await res.json();
      await mutate(loggedInUser, false); // Update SWR cache without re-fetching
      if (loggedInUser.role === 'admin') {
        router.push('/dashboard/history');
      } else {
        router.push('/dashboard/inventory');
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({ variant: "destructive", title: "Login Failed", description: error.message });
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
// Add useToast to the context file since it's used here now
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";
const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;
type Action =
  | { type: ActionType["ADD_TOAST"]; toast: ToasterToast }
  | { type: ActionType["UPDATE_TOAST"]; toast: Partial<ToasterToast> }
  | { type: ActionType["DISMISS_TOAST"]; toastId?: ToasterToast["id"] }
  | { type: ActionType["REMOVE_TOAST"]; toastId?: ToasterToast["id"] };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) return;
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: "REMOVE_TOAST", toastId: toastId });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case "UPDATE_TOAST":
      return { ...state, toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)) };
    case "DISMISS_TOAST": {
      const { toastId } = action;
      if (toastId) addToRemoveQueue(toastId);
      else state.toasts.forEach((toast) => addToRemoveQueue(toast.id));
      return { ...state, toasts: state.toasts.map((t) => (t.id === toastId || toastId === undefined ? { ...t, open: false } : t)) };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) return { ...state, toasts: [] };
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) };
  }
};

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

type Toast = Omit<ToasterToast, "id">;
function toast({ ...props }: Toast) {
  const id = genId();
  const update = (props: ToasterToast) => dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });
  dispatch({
    type: "ADD_TOAST",
    toast: { ...props, id, open: true, onOpenChange: (open) => { if (!open) dismiss() } },
  });
  return { id: id, dismiss, update };
}
