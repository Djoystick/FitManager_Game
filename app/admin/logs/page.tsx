import { createClient } from '@supabase/supabase-js';
import LogViewerClient from './LogViewerClient';

export const revalidate = 0; // Disable caching for admin page

export default async function AdminLogsPage() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch last 200 logs
  const { data: logs, error } = await supabaseAdmin
    .from('system_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return <div className="p-4 bg-red-900/50 text-red-200 rounded-lg">Failed to load logs: {error.message}</div>;
  }

  return <LogViewerClient initialLogs={logs || []} />;
}
