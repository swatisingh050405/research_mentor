import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading Session...</div>;

  // Agar user nahi hai, toh login page par bhejo
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}