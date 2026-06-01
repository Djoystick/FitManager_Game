'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendTelegramMessage(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminIds = process.env.ADMIN_TG_IDS?.split(',') || [];
  
  if (!token || adminIds.length === 0) return;

  for (const adminId of adminIds) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: adminId.trim(), 
          text: message, 
          parse_mode: 'HTML' 
        })
      });
    } catch (err) {
      console.error('[Logger] Failed to send Telegram alert:', err);
    }
  }
}

export type LogLevel = 'info' | 'warning' | 'error' | 'critical';

export async function captureLog(level: LogLevel, source: string, message: string, metadata: any = {}) {
  try {
    // 1. Insert into DB
    const { error } = await supabaseAdmin.from('system_logs').insert({
      level,
      source,
      message,
      metadata
    });

    if (error) {
      console.error('[Logger] Failed to insert log to DB:', error);
    }

    // 2. Alert if critical
    if (level === 'critical') {
      const alertMsg = `🚨 <b>CRITICAL ERROR</b> 🚨\n\n<b>Source:</b> ${source}\n<b>Message:</b> ${message}\n\n<pre>${JSON.stringify(metadata, null, 2)}</pre>`;
      await sendTelegramMessage(alertMsg);
    }
  } catch (err) {
    console.error('[Logger] Critical failure inside captureLog:', err);
  }
}

import { cookies } from 'next/headers';

export async function submitBugReport(userIdParam: string | null, description: string, metadata: any = {}) {
  try {
    let userId = userIdParam;
    if (!userId) {
      const cookieStore = await cookies();
      userId = cookieStore.get('tg_user_id')?.value || null;
    }

    const { error } = await supabaseAdmin.from('bug_reports').insert({
      user_id: userId,
      description,
      metadata,
      status: 'open'
    });

    if (error) {
      console.error('[Logger] Failed to insert bug report:', error);
      return { success: false, error: 'DB Error' };
    }

    const alertMsg = `🐛 <b>NEW BUG REPORT</b> 🐛\n\n<b>User:</b> ${userId || 'Unknown'}\n<b>Description:</b> ${description}`;
    await sendTelegramMessage(alertMsg);

    return { success: true };
  } catch (err) {
    console.error('[Logger] Failed to submit bug report:', err);
    return { success: false, error: 'Server Error' };
  }
}

export async function resolveLog(logId: string, isBugReport: boolean = false) {
  try {
    const table = isBugReport ? 'bug_reports' : 'system_logs';
    const updateData = isBugReport ? { status: 'resolved' } : { resolved: true };
    const { error } = await supabaseAdmin.from(table).update(updateData).eq('id', logId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateAdminNote(logId: string, note: string, isBugReport: boolean = false) {
  try {
    const table = isBugReport ? 'bug_reports' : 'system_logs';
    const { error } = await supabaseAdmin.from(table).update({ admin_notes: note }).eq('id', logId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
