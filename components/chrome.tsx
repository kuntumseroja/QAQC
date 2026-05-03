'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import Header from '@/components/header';

export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Auth screens render standalone — no sidebar / no header
  const standalone = pathname === '/login';
  if (standalone) {
    return <div className="h-full">{children}</div>;
  }
  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[#f4f4f4]">{children}</main>
      </div>
    </div>
  );
}
