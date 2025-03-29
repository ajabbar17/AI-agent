import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

const LOCAL_STORAGE_KEY = "user_data";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch the current user
  const { data: currentUser, error: userError } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/user");
        if (!res.ok) {
          if (res.status === 401) {
            return null;
          }
          throw new Error("Failed to fetch user");
        }
        const data = await res.json();
        return data;
      } catch (error) {
        console.error("Error fetching user:", error);
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Update user state when currentUser changes
  useEffect(() => {
    if (userError) {
      console.error("Error fetching user:", userError);
      setUser(null);
    } else {
      setUser(currentUser);
    }
    setLoading(false);
  }, [currentUser, userError]);

  // Only redirect to /auth if we're not loading and there's no user
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (!loading && !user && currentPath !== '/auth') {
      setLocation('/auth');
    }
  }, [loading, user, setLocation]);

  const signUp = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/register", { username, password });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to sign up");
    }
    const data = await res.json();
    setUser(data);
    queryClient.setQueryData(["/api/user"], data);
    setLocation("/");
    toast({
      title: "Success",
      description: "Account created successfully",
    });
  };

  const signIn = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/login", { username, password });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Invalid credentials");
    }
    const data = await res.json();
    setUser(data);
    queryClient.setQueryData(["/api/user"], data);
    setLocation("/");
  };

  const logOut = async () => {
    const res = await apiRequest("POST", "/api/logout");
    if (!res.ok) throw new Error("Failed to log out");
    setUser(null);
    queryClient.setQueryData(["/api/user"], null);
    setLocation("/auth");
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    logOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}