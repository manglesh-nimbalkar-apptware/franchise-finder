import React from 'react';
import { MapPin } from 'lucide-react';

type LayoutProps = {
  children: React.ReactNode;
};

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center">
          <div className="flex items-center">
            <div className="bg-blue-500 p-2 rounded-lg">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <h1 className="ml-3 text-2xl font-bold text-gray-900">Franchise Finder</h1>
          </div>
          <p className="ml-4 text-sm text-gray-500">Find franchise locations anywhere</p>
        </div>
      </header>
      <main className="py-6">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-center text-gray-500">© 2025 Franchise Finder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};