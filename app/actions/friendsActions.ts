'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// SEARCH: Find teams by name
// ============================================================
export async function searchTeams(query: string) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    if (!query || query.trim().length < 2) {
      return { success: true, data: [] };
    }

    const { data: teams, error } = await supabaseAdmin
      .from('teams')
      .select('id, name, logo_url, user_id')
      .ilike('name', `%${query.trim()}%`)
      .neq('user_id', userId)
      .limit(20);

    if (error) throw error;

    // Enrich with manager level
    const userIds = teams?.map(t => t.user_id).filter(Boolean) || [];
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, manager_level')
      .in('id', userIds);

    const levelMap: Record<string, number> = {};
    users?.forEach(u => { levelMap[u.id] = u.manager_level ?? 1; });

    const enriched = teams?.map(t => ({
      team_id: t.id,
      team_name: t.name,
      logo_url: t.logo_url,
      user_id: t.user_id,
      manager_level: levelMap[t.user_id] ?? 1,
    })) || [];

    return { success: true, data: enriched };
  } catch (err: any) {
    return { success: false, error: err.message || 'Search failed' };
  }
}

// ============================================================
// FRIEND REQUEST: Send a friend request
// ============================================================
export async function sendFriendRequest(targetUserId: string) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    if (userId === targetUserId) {
      return { success: false, error: 'Cannot send friend request to yourself' };
    }

    // Check if friendship already exists (in either direction)
    const { data: existing } = await supabaseAdmin
      .from('friendships')
      .select('id, status')
      .or(`and(user_a_id.eq.${userId},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${userId})`)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'accepted') {
        return { success: false, error: 'Already friends' };
      }
      if (existing.status === 'pending') {
        return { success: false, error: 'Friend request already pending' };
      }
      // If blocked or declined, delete and recreate
      await supabaseAdmin.from('friendships').delete().eq('id', existing.id);
    }

    // Ensure user_a_id < user_b_id for consistent unique constraint
    const [a, b] = userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];

    const { error } = await supabaseAdmin.from('friendships').insert({
      user_a_id: a,
      user_b_id: b,
      status: 'pending',
    });

    if (error) throw error;

    // Get sender's team name for notification
    const { data: senderTeam } = await supabaseAdmin
      .from('teams').select('name').eq('user_id', userId).maybeSingle();
    const senderName = senderTeam?.name ?? 'Someone';

    await supabaseAdmin.from('personal_notifications').insert({
      user_id: targetUserId,
      type: 'challenge',
      title: 'Friend request',
      message: JSON.stringify({
        en: `${senderName} sent you a friend request.`,
        ru: `${senderName} отправил вам заявку в друзья.`,
      }),
    });

    await supabaseAdmin.rpc('increment_quest_progress', { p_user_id: userId, p_type: 'social_action', p_amount: 1 });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send friend request' };
  }
}

// ============================================================
// RESPOND: Accept or decline a friend request
// ============================================================
export async function respondToFriendRequest(requestId: string, accept: boolean) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    // Verify ownership
    const { data: request } = await supabaseAdmin
      .from('friendships')
      .select('id, user_a_id, user_b_id')
      .eq('id', requestId)
      .maybeSingle();

    if (!request) return { success: false, error: 'Request not found' };
    if (request.user_a_id !== userId && request.user_b_id !== userId) {
      return { success: false, error: 'Not authorized' };
    }

    if (accept) {
      const { error } = await supabaseAdmin
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);
      if (error) throw error;

      // Notify the requester
      const requesterId = request.user_a_id === userId ? request.user_b_id : request.user_a_id;
      const { data: acceptorTeam } = await supabaseAdmin
        .from('teams').select('name').eq('user_id', userId).maybeSingle();
      const acceptorName = acceptorTeam?.name ?? 'Someone';

      await supabaseAdmin.from('personal_notifications').insert({
        user_id: requesterId,
        type: 'system',
        title: 'Friend request accepted',
        message: JSON.stringify({
          en: `${acceptorName} accepted your friend request.`,
          ru: `${acceptorName} принял вашу заявку в друзья.`,
        }),
      });
    } else {
      const { error } = await supabaseAdmin
        .from('friendships')
        .delete()
        .eq('id', requestId);
      if (error) throw error;
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to respond' };
  }
}

// ============================================================
// FRIENDS LIST: Get all accepted friends
// ============================================================
export async function getFriendsList() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: friendships, error } = await supabaseAdmin
      .from('friendships')
      .select('id, user_a_id, user_b_id, status, created_at')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .eq('status', 'accepted');

    if (error) throw error;
    if (!friendships || friendships.length === 0) {
      return { success: true, data: [] };
    }

    // Get friend IDs (the other user in each friendship)
    const friendIds = friendships.map(f =>
      f.user_a_id === userId ? f.user_b_id : f.user_a_id
    );

    // Fetch friend details
    const { data: friendUsers } = await supabaseAdmin
      .from('users')
      .select('id, manager_level')
      .in('id', friendIds);

    const { data: friendTeams } = await supabaseAdmin
      .from('teams')
      .select('user_id, name, logo_url')
      .in('user_id', friendIds);

    const teamMap: Record<string, { name: string; logo_url: string | null }> = {};
    friendTeams?.forEach(t => {
      teamMap[t.user_id] = { name: t.name, logo_url: t.logo_url };
    });
    const levelMap: Record<string, number> = {};
    friendUsers?.forEach(u => { levelMap[u.id] = u.manager_level ?? 1; });

    const friends = friendIds.map(fid => ({
      friendship_id: friendships.find(f =>
        f.user_a_id === fid || f.user_b_id === fid
      )?.id,
      user_id: fid,
      team_name: teamMap[fid]?.name ?? 'Unknown',
      logo_url: teamMap[fid]?.logo_url ?? null,
      manager_level: levelMap[fid] ?? 1,
    }));

    return { success: true, data: friends };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load friends' };
  }
}

// ============================================================
// PENDING REQUESTS: Get incoming friend requests
// ============================================================
export async function getPendingFriendRequests() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    // Requests where I am user_b (the receiver)
    const { data: requests, error } = await supabaseAdmin
      .from('friendships')
      .select('id, user_a_id, user_b_id, created_at')
      .eq('user_b_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    if (!requests || requests.length === 0) {
      return { success: true, data: [] };
    }

    const senderIds = requests.map(r => r.user_a_id);
    const { data: senderTeams } = await supabaseAdmin
      .from('teams')
      .select('user_id, name, logo_url')
      .in('user_id', senderIds);

    const teamMap: Record<string, { name: string; logo_url: string | null }> = {};
    senderTeams?.forEach(t => {
      teamMap[t.user_id] = { name: t.name, logo_url: t.logo_url };
    });

    const enriched = requests.map(r => ({
      request_id: r.id,
      user_id: r.user_a_id,
      team_name: teamMap[r.user_a_id]?.name ?? 'Unknown',
      logo_url: teamMap[r.user_a_id]?.logo_url ?? null,
      created_at: r.created_at,
    }));

    return { success: true, data: enriched };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load requests' };
  }
}
