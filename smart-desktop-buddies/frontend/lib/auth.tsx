"use client"

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import { api } from './api';

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkAuth();
  }, [pathname]);

  const checkAuth = async () => {
    console.log('=== Auth Check ===');
    console.log('Current path:', pathname);
    
    const token = Cookies.get('token');
    const refreshToken = Cookies.get('refreshToken');
    const storedUser = Cookies.get('user');
    
    console.log('Token exists:', !!token);
    console.log('Refresh token exists:', !!refreshToken);
    console.log('Stored user exists:', !!storedUser);

    if (!token && !refreshToken) {
      console.log('No tokens found');
      setUser(null);
      setLoading(false);
      // Allow access to auth-related pages without tokens
      const publicPaths = ['/', '/register', '/forgot-password', '/reset-password', '/verify-email'];
      if (!publicPaths.includes(pathname)) {
        router.push('/');
      }
      return;
    }

    try {
      if (!token && refreshToken) {
        console.log('Attempting token refresh');
        const response = await api.refreshToken(refreshToken);
        Cookies.set('token', response.access, { expires: 1/24 }); // 1 hour
      }

      const userData = await api.getProfile();
      console.log('Profile fetched successfully:', userData);
      
      setUser(userData);
      Cookies.set('user', JSON.stringify(userData), { expires: 1 }); // 1 day
      
      if (pathname === '/' || pathname === '/register') {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      Cookies.remove('token');
      Cookies.remove('refreshToken');
      Cookies.remove('user');
      
      // Allow access to auth-related pages without tokens
      const publicPaths = ['/', '/register', '/forgot-password', '/reset-password', '/verify-email'];
      if (!publicPaths.includes(pathname)) {
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login({ email, password });
      
      // Store tokens in cookies
      Cookies.set('token', response.access, { expires: 1/24 }); // 1 hour
      Cookies.set('refreshToken', response.refresh, { expires: 1 }); // 1 day
      Cookies.set('user', JSON.stringify(response.user), { expires: 1 }); // 1 day
      
      setUser(response.user);
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await api.register({ username, email, password });
      
      // Registration successful but email not verified yet
      // Don't set tokens or redirect - user needs to verify email first
      // Return response so caller can show verification message
      return response;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    Cookies.remove('token');
    Cookies.remove('refreshToken');
    Cookies.remove('user');
    router.push('/');
  };

  const updateUser = (updatedUser: User | null) => {
    setUser(updatedUser)
    if (updatedUser) {
      Cookies.set('user', JSON.stringify(updatedUser), { expires: 1 })
    } else {
      Cookies.remove('user')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser: updateUser, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 