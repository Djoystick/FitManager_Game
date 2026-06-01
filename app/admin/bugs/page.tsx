import { createClient } from '@supabase/supabase-js';
import BugViewerClient from './BugViewerClient';

export const revalidate = 0; // Disable caching

export default async function AdminBugsPage() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch bugs
  const { data: bugs, error } = await supabaseAdmin
    .from('bug_reports')
    .select('*, users(telegram_id)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return <div className="p-4 bg-red-900/50 text-red-200 rounded-lg">Failed to load bugs: {error.message}</div>;
  }

  return <BugViewerClient initialBugs={bugs || []} />;
}
