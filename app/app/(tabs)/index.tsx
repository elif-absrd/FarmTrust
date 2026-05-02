import React from 'react';
import { useAuth } from '@/context/AuthContext';
import Dashboard from '@/pages/Dashboard';
import AdminDashboard from '@/pages/AdminDashboard';

export default function IndexRoute() {
  const { user } = useAuth();

  if (user?.role === 'ADMIN') {
    return <AdminDashboard mode="claims" initialTab="claims" />;
  }

  return <Dashboard />;
}
