import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthUser {
  id: number;
  username: string;
  name: string | null;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isPending: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json() as Promise<AuthUser>;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", { username, password });
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, password, name }: { username: string; password: string; name?: string }) => {
      const res = await apiRequest("POST", "/api/register", { username, password, name });
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear();
      setError(null);
    },
  });

  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  const register = async (username: string, password: string, name?: string) => {
    await registerMutation.mutateAsync({ username, password, name });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isPending: loginMutation.isPending || registerMutation.isPending || logoutMutation.isPending,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
