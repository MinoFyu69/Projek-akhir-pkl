// src/components/staf/StafLayout.js
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, BookOpen, Users, Library, Menu, X, LogOut, Settings, Bookmark } from 'lucide-react';

const StafLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/staf/dashboard' },
    { id: 'buku', label: 'Manajemen Buku', icon: BookOpen, path: '/staf/buku' },
    { id: 'genre', label: 'Manajemen Genre', icon: Users, path: '/staf/genre' },
    { id: 'tags', label: 'Manajemen Tags', icon: Users, path: '/staf/tags' },
    { id: 'katalog', label: 'Katalog Buku', icon: Library, path: '/staf/katalog' },
    { id: 'peminjaman', label: 'Peminjaman', icon: Bookmark, path: '/staf/peminjaman' },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks
    
    if (!confirm('Apakah Anda yakin ingin logout?')) {
      return;
    }

    setIsLoggingOut(true);

    try {
      // Call logout API to clear server-side cookie
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('✅ Logout berhasil');
        // Redirect to login page
        router.push('/login');
        // Optional: Refresh to clear any cached data
        router.refresh();
      } else {
        console.error('❌ Logout gagal');
        alert('Gagal logout. Silakan coba lagi.');
        setIsLoggingOut(false);
      }
    } catch (error) {
      console.error('❌ Error during logout:', error);
      alert('Terjadi kesalahan saat logout.');
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-blue-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b border-blue-800">
          {sidebarOpen && <h1 className="text-xl font-bold">Perpustakaan Staf</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-blue-800">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.id}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-700 text-white' : 'hover:bg-blue-800 text-blue-100'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-800 space-y-2">
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-800 w-full text-left transition-colors">
            <Settings size={20} />
            {sidebarOpen && <span>Pengaturan</span>}
          </button>
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-800 w-full text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default StafLayout;