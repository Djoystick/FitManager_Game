import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ShieldAlert, Bug, Terminal, Home } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const userId = (await verifySession());
  
  if (!userId) {
    redirect('/');
  }

  // Fetch real telegram ID from DB
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabaseAdmin.from('users').select('telegram_id').eq('id', userId).single();

  if (!user || !user.telegram_id) {
    redirect('/');
  }

  // Check if userId is an admin
  const adminIds = process.env.ADMIN_TG_IDS?.split(',') || [];
  if (!adminIds.includes(user.telegram_id)) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <header className="bg-gray-900 border-b border-red-500/30 p-4 sticky top-0 z-10 flex justify-between items-center shadow-[0_0_20px_rgba(220,38,38,0.2)]">
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-red-500" size={28} />
          <h1 className="text-2xl font-black font-russo tracking-widest text-red-500">ADMIN CENTER</h1>
        </div>
        <nav className="flex gap-4">
          <Link href="/admin/logs" className="flex items-center gap-2 hover:text-red-400 transition-colors bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
            <Terminal size={18} /> System Logs
          </Link>
          <Link href="/admin/bugs" className="flex items-center gap-2 hover:text-red-400 transition-colors bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
            <Bug size={18} /> Bug Reports
          </Link>
          <Link href="/" className="flex items-center gap-2 hover:text-blue-400 transition-colors bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
            <Home size={18} /> Exit Admin
          </Link>
        </nav>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
