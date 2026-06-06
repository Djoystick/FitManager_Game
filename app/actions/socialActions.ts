'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// ─────────────────────────────────────────────────────────────────────────────
// socialActions.ts — WOOF social feed CRUD
// ─────────────────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('tg_user_id')?.value ?? null;
}

export type SocialCategory = 'general' | 'transfer' | 'my_team' | 'award' | 'interview';

export interface SocialPost {
  id: string;
  author_name: string;
  author_handle: string;
  author_team_id: string | null;
  category: SocialCategory;
  content: string;
  likes: number;
  is_system_post: boolean;
  created_at: string;
}

/**
 * Fetch paginated social feed for a category.
 * 'general' returns all categories.
 */
export async function getSocialFeedAction(
  category: SocialCategory = 'general',
  limit = 20,
  offset = 0
): Promise<{ success: boolean; data?: SocialPost[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_social_feed', {
      p_category: category,
      p_limit:    limit,
      p_offset:   offset,
    });

    if (error) throw error;

    return { success: true, data: (data ?? []) as SocialPost[] };
  } catch (err: any) {
    // Fallback to direct query if RPC not yet deployed
    try {
      let query = supabaseAdmin
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (category !== 'general') {
        query = query.eq('category', category);
      }

      const { data: fallback } = await query;
      return { success: true, data: (fallback ?? []) as SocialPost[] };
    } catch {
      return { success: false, error: err.message ?? 'Failed to fetch feed' };
    }
  }
}

/**
 * Post to the WOOF feed as the authenticated user's team.
 */
export async function createSocialPostAction(
  content: string,
  category: SocialCategory = 'general'
): Promise<{ success: boolean; data?: SocialPost; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    if (!content.trim()) return { success: false, error: 'Content cannot be empty' };
    if (content.length > 280) return { success: false, error: 'Max 280 characters' };

    // Get user's team for author info
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('user_id', userId)
      .single();

    const { data: tgUser } = await supabaseAdmin
      .from('users')
      .select('telegram_id')
      .eq('id', userId)
      .single();

    const authorName   = team?.name ?? 'Manager';
    const authorHandle = `@${tgUser?.telegram_id ?? userId.slice(0, 8)}`;

    const { data, error } = await supabaseAdmin
      .from('social_posts')
      .insert({
        author_team_id: team?.id ?? null,
        author_name:   authorName,
        author_handle: authorHandle,
        category,
        content: content.trim(),
        is_system_post: false,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/league');
    return { success: true, data: data as SocialPost };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to post' };
  }
}

/**
 * Like a social post (increments counter, no duplicate guard for now).
 */
export async function likeSocialPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.rpc('increment', {
      table_name:  'social_posts',
      column_name: 'likes',
      row_id:      postId,
    });

    // Fallback if increment RPC not available
    if (error) {
      const { data: post } = await supabaseAdmin
        .from('social_posts').select('likes').eq('id', postId).single();
      if (post) {
        await supabaseAdmin
          .from('social_posts')
          .update({ likes: (post.likes ?? 0) + 1 })
          .eq('id', postId);
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
