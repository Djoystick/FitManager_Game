'use client';

import { useContext, useEffect, useState, useTransition } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { SubNavTabs } from '@/components/ui/SubNavTabs';
import {
  getSocialFeedAction,
  createSocialPostAction,
  likeSocialPostAction,
  type SocialPost,
  type SocialCategory,
} from '@/app/actions/socialActions';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Send, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// HubSocialClient — WOOF social feed client component
// Used inside the HUB page (league/page.tsx) as the SOCIAL tab sub-section.
// ─────────────────────────────────────────────────────────────────────────────

const FEED_TABS: Array<{ id: SocialCategory; label: string }> = [
  { id: 'general',   label: 'GENERAL'    },
  { id: 'transfer',  label: 'TRANSFER'   },
  { id: 'my_team',   label: 'MY TEAM'    },
  { id: 'award',     label: 'AWARDS'     },
  { id: 'interview', label: 'INTERVIEWS' },
];

function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60)     return `${secs}s`;
  if (secs < 3600)   return `${Math.floor(secs / 60)}m`;
  if (secs < 86400)  return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function PostCard({ post, onLike }: { post: SocialPost; onLike: (id: string) => void }) {
  const isSystem = post.is_system_post;
  return (
    <motion.div
      className={`
        relative overflow-hidden rounded-2xl border p-3
        ${isSystem
          ? 'bg-[rgba(0,240,255,0.03)] border-cyan-800/30'
          : 'glass-card'
        }
      `}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      layout
    >
      {isSystem && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      )}

      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Avatar */}
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
          text-sm font-black uppercase
          ${isSystem
            ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400'
            : 'bg-violet-500/15 border border-violet-500/30 text-violet-300'
          }
        `}>
          {isSystem ? <Wifi size={14} /> : post.author_name[0]}
        </div>

        {/* Name + handle + time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-white uppercase tracking-wide truncate">
              {post.author_name}
            </span>
            {isSystem && (
              <span className="text-[7px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-full font-bold uppercase">
                BOT
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 font-mono">{post.author_handle}</span>
            <span className="text-[8px] text-gray-700">·</span>
            <span className="text-[9px] text-gray-600">{timeAgo(post.created_at)}</span>
          </div>
        </div>

        {/* Category chip */}
        <span className="flex-shrink-0 text-[7px] font-bold uppercase text-gray-600 tracking-wider">
          {post.category}
        </span>
      </div>

      {/* Content */}
      <p className="text-[11px] text-gray-300 leading-relaxed mb-2">
        {post.content}
      </p>

      {/* Footer: likes */}
      <div className="flex items-center gap-3 pt-1.5 border-t border-white/5">
        <button
          onClick={() => onLike(post.id)}
          className="flex items-center gap-1.5 text-gray-600 hover:text-rose-400 transition-colors active:scale-90"
        >
          <Heart size={12} />
          <span className="text-[9px] font-bold">{post.likes}</span>
        </button>
      </div>
    </motion.div>
  );
}

export function HubSocialClient() {
  const { isAuthenticated } = useContext(TelegramAuthContext);
  const [feedTab,   setFeedTab]   = useState<SocialCategory>('general');
  const [posts,     setPosts]     = useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft,     setDraft]     = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadFeed = async (cat: SocialCategory) => {
    setIsLoading(true);
    const res = await getSocialFeedAction(cat, 30, 0);
    if (res.success && res.data) setPosts(res.data);
    setIsLoading(false);
  };

  useEffect(() => { loadFeed(feedTab); }, [feedTab]);

  const handleLike = async (id: string) => {
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p));
    await likeSocialPostAction(id);
  };

  const handlePost = () => {
    if (!draft.trim()) return;
    startTransition(async () => {
      const res = await createSocialPostAction(draft.trim(), feedTab === 'general' ? 'general' : feedTab);
      if (res.success && res.data) {
        setPosts(prev => [res.data!, ...prev]);
        setDraft('');
        setShowCompose(false);
        toast.success('Posted!');
      } else {
        toast.error(res.error ?? 'Failed to post');
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Feed category SubNav */}
      <div className="flex overflow-x-auto scrollbar-none gap-1 px-3 pb-1">
        {FEED_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFeedTab(tab.id)}
            className={`
              flex-shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider
              border transition-all duration-200
              ${feedTab === tab.id
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'border-transparent text-gray-600 hover:text-gray-400'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Compose toggle */}
      {isAuthenticated && (
        <div className="px-3">
          <AnimatePresence>
            {showCompose ? (
              <motion.div
                key="compose"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="glass-card overflow-hidden"
              >
                <div className="p-3">
                  <div className="text-[9px] text-gray-600 uppercase tracking-widest font-bold mb-2">NEW POST</div>
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    maxLength={280}
                    rows={3}
                    placeholder="What's happening in the cyber stadium?"
                    className="w-full bg-black/40 border border-white/10 text-white text-xs
                               rounded-xl px-3 py-2 outline-none resize-none
                               focus:border-cyan-500/40 placeholder:text-gray-700 font-mono"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[8px] text-gray-700 font-mono">{draft.length}/280</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowCompose(false); setDraft(''); }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10
                                   text-gray-500 text-[9px] font-bold uppercase"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePost}
                        disabled={isPending || !draft.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                   bg-cyan-500/20 border border-cyan-500/40 text-cyan-300
                                   text-[9px] font-black uppercase tracking-wider
                                   hover:bg-cyan-500/30 disabled:opacity-40 transition-all"
                      >
                        <Send size={10} />
                        {isPending ? '...' : 'POST'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <button
                key="compose-btn"
                onClick={() => setShowCompose(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                           bg-white/[0.03] border border-white/[0.06] text-gray-600
                           text-[10px] uppercase tracking-wider font-bold
                           hover:border-cyan-500/30 hover:text-gray-400 transition-all"
              >
                <Send size={12} />
                Share something with the league...
              </button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Feed */}
      <div className="flex flex-col gap-2 px-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-gray-700 text-xs uppercase tracking-widest font-bold">
            No posts yet. Be the first to post!
          </div>
        ) : (
          posts.map(post => (
            <PostCard key={post.id} post={post} onLike={handleLike} />
          ))
        )}
      </div>
    </div>
  );
}
