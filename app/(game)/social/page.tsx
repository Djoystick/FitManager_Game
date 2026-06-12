'use client';

import React, { useContext, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Newspaper, Bell, ArrowLeft, CheckCheck, Search, Users, Swords, UserPlus, UserCheck, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import type { PersonalNotification } from '@/lib/types';
import { resolveBilingual } from '@/lib/types';
import { searchTeams, sendFriendRequest, getFriendsList, getPendingFriendRequests, respondToFriendRequest } from '@/app/actions/friendsActions';
import { issueChallenge, getPendingChallenges, resolvePvPChallenge, getChallengeHistory } from '@/app/actions/pvpActions';

interface NewsItem {
  id: string;
  title: string;
  body: string;
  author: string;
  created_at: string;
}

type Tab = 'notifications' | 'friends' | 'search' | 'news';

interface TeamResult {
  team_id: string;
  team_name: string;
  logo_url: string | null;
  user_id: string;
  manager_level: number;
}

interface FriendItem {
  friendship_id: string;
  user_id: string;
  team_name: string;
  logo_url: string | null;
  manager_level: number;
}

interface PendingRequest {
  request_id: string;
  user_id: string;
  team_name: string;
  logo_url: string | null;
  created_at: string;
}

interface PendingChallenge {
  challenge_id: string;
  challenger_id: string;
  challenger_name: string;
  challenger_logo: string | null;
  created_at: string;
  expires_at: string;
}

interface ChallengeHistoryItem {
  challenge_id: string;
  opponent_name: string;
  opponent_logo: string | null;
  result: 'win' | 'loss' | 'draw';
  score: string;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  transfer: '💰',
  injury: '🚑',
  challenge: '⚔️',
  system: '📢',
  friend_request: '👋',
};

function getTimeAgo(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'ru' ? 'только что' : 'just now';
  if (mins < 60) return `${mins}${lang === 'ru' ? 'м' : 'm'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${lang === 'ru' ? 'ч' : 'h'}`;
  const days = Math.floor(hrs / 24);
  return `${days}${lang === 'ru' ? 'д' : 'd'}`;
}

export default function SocialPage() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict] || dict['en'];
  const [tab, setTab] = useState<Tab>('notifications');
  const [notifications, setNotifications] = useState<PersonalNotification[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingChallenges, setPendingChallenges] = useState<PendingChallenge[]>([]);
  const [challengeHistory, setChallengeHistory] = useState<ChallengeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/social/personal-notifications', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications ?? []);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const [friendsRes, requestsRes, challengesRes, historyRes] = await Promise.all([
        getFriendsList(),
        getPendingFriendRequests(),
        getPendingChallenges(),
        getChallengeHistory(),
      ]);
      if (friendsRes.success && friendsRes.data) setFriends(friendsRes.data);
      if (requestsRes.success && requestsRes.data) setPendingRequests(requestsRes.data);
      if (challengesRes.success && challengesRes.data) setPendingChallenges(challengesRes.data);
      if (historyRes.success && historyRes.data) setChallengeHistory(historyRes.data as ChallengeHistoryItem[]);
    } catch (err) {
      console.error('Fetch friends error:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const newsRes = await supabase.from('social_feed').select('*').order('created_at', { ascending: false }).limit(20);
        if (!newsRes.error && newsRes.data) {
          setNews(newsRes.data);
        }
        await Promise.all([fetchNotifications(), fetchFriends()]);
      } catch (err) {
        console.error('Social page fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId]);

  const markAllRead = async () => {
    await fetch('/api/social/personal-notifications', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#05060f] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#05060f]/95 backdrop-blur-xl border-b border-white/5 px-4 pt-[85px] pb-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-sm font-black font-orbitron text-white uppercase tracking-widest">
            {language === 'ru' ? 'Сообщество' : 'Social Hub'}
          </h1>
          <div className="w-8" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-hide">
          <TabButton active={tab === 'notifications'} onClick={() => setTab('notifications')} color="cyan" icon={<Bell size={11} />} label={t.notifications || 'Alerts'} badge={unreadCount} />
          <TabButton active={tab === 'friends'} onClick={() => setTab('friends')} color="emerald" icon={<Users size={11} />} label={language === 'ru' ? 'Друзья' : 'Friends'} badge={pendingRequests.length + pendingChallenges.length} />
          <TabButton active={tab === 'search'} onClick={() => setTab('search')} color="violet" icon={<Search size={11} />} label={language === 'ru' ? 'Поиск' : 'Search'} />
          <TabButton active={tab === 'news'} onClick={() => setTab('news')} color="yellow" icon={<Newspaper size={11} />} label={t.feed_news || 'News'} />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : tab === 'notifications' ? (
          <NotificationsTab notifications={notifications} onMarkAllRead={markAllRead} unreadCount={unreadCount} language={language} />
        ) : tab === 'friends' ? (
          <FriendsTab
            friends={friends}
            pendingRequests={pendingRequests}
            pendingChallenges={pendingChallenges}
            challengeHistory={challengeHistory}
            language={language}
            onRefresh={fetchFriends}
          />
        ) : tab === 'search' ? (
          <SearchTab language={language} />
        ) : (
          <NewsTab news={news} language={language} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB BUTTON
// ============================================================
function TabButton({ active, onClick, color, icon, label, badge }: {
  active: boolean; onClick: () => void; color: string; icon: React.ReactNode; label: string; badge?: number;
}) {
  const colorMap: Record<string, string> = {
    cyan: active ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' : '',
    emerald: active ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : '',
    violet: active ? 'bg-violet-500/15 border-violet-500/30 text-violet-300' : '',
    yellow: active ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300' : '',
  };
  const badgeColor: Record<string, string> = {
    cyan: 'bg-cyan-400 text-[#05060f]',
    emerald: 'bg-emerald-400 text-[#05060f]',
    violet: 'bg-violet-400 text-[#05060f]',
    yellow: 'bg-yellow-400 text-[#05060f]',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
        active
          ? `${colorMap[color]} border`
          : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`ml-0.5 min-w-[12px] h-[12px] rounded-full ${badgeColor[color]} text-[6px] font-black flex items-center justify-center`}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ============================================================
// NOTIFICATIONS TAB
// ============================================================
function NotificationsTab({ notifications, onMarkAllRead, unreadCount, language }: {
  notifications: PersonalNotification[]; onMarkAllRead: () => void; unreadCount: number; language: string;
}) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Bell size={32} className="text-gray-700" />
        <p className="text-[11px] text-gray-600">
          {language === 'ru' ? 'Пока нет уведомлений' : 'No notifications yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {unreadCount > 0 && (
        <button onClick={onMarkAllRead} className="self-end flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] text-cyan-400 font-bold uppercase tracking-wider hover:bg-cyan-500/10 transition-colors mb-1">
          <CheckCheck size={10} />
          {language === 'ru' ? 'Отметить все' : 'Mark all read'}
        </button>
      )}
      {notifications.map((n) => {
        const icon = TYPE_ICONS[n.type] ?? '📢';
        return (
          <div key={n.id} className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${n.is_read ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-cyan-500/5 border-cyan-500/20'}`}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/40 border border-white/8 flex-shrink-0 text-lg">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black text-white uppercase tracking-wide">{n.title}</span>
                {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
              </div>
              <p className="text-[10px] text-gray-400 leading-snug">{resolveBilingual(n.message, language)}</p>
            </div>
            <span className="text-[8px] text-gray-700 font-mono flex-shrink-0 pt-0.5">{getTimeAgo(n.created_at, language)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// FRIENDS TAB
// ============================================================
function FriendsTab({ friends, pendingRequests, pendingChallenges, challengeHistory, language, onRefresh }: {
  friends: FriendItem[]; pendingRequests: PendingRequest[]; pendingChallenges: PendingChallenge[];
  challengeHistory: ChallengeHistoryItem[]; language: string; onRefresh: () => void;
}) {
  const [subTab, setSubTab] = useState<'list' | 'requests' | 'history'>('list');

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-1.5">
        <button onClick={() => setSubTab('list')} className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${subTab === 'list' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-white/5 border border-white/10 text-gray-500'}`}>
          {language === 'ru' ? 'Друзья' : 'Friends'} ({friends.length})
        </button>
        <button onClick={() => setSubTab('requests')} className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${subTab === 'requests' ? 'bg-yellow-500/15 border border-yellow-500/30 text-yellow-300' : 'bg-white/5 border border-white/10 text-gray-500'}`}>
          {language === 'ru' ? 'Запросы' : 'Requests'} ({pendingRequests.length})
        </button>
        <button onClick={() => setSubTab('history')} className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${subTab === 'history' ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300' : 'bg-white/5 border border-white/10 text-gray-500'}`}>
          {language === 'ru' ? 'История' : 'History'}
        </button>
      </div>

      {/* Pending Challenges */}
      {pendingChallenges.length > 0 && subTab === 'list' && (
        <div className="flex flex-col gap-2">
          <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-wider">
            {language === 'ru' ? 'Входящие вызовы' : 'Incoming Challenges'}
          </span>
          {pendingChallenges.map((ch) => (
            <ChallengeCard key={ch.challenge_id} challenge={ch} language={language} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      {/* Friends List */}
      {subTab === 'list' && (
        <div className="flex flex-col gap-2">
          {friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Users size={28} className="text-gray-700" />
              <p className="text-[11px] text-gray-600">
                {language === 'ru' ? 'Пока нет друзей. Найдите менеджеров во вкладке Search!' : 'No friends yet. Find managers in the Search tab!'}
              </p>
            </div>
          ) : (
            friends.map((f) => (
              <div key={f.user_id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg flex-shrink-0">
                  {f.logo_url ? <img src={f.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" /> : '⚽'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-white truncate">{f.team_name}</p>
                  <p className="text-[8px] text-gray-500">LVL {f.manager_level}</p>
                </div>
                <button
                  onClick={async () => {
                    const res = await issueChallenge(f.user_id);
                    if (res.success) {
                      alert(language === 'ru' ? 'Вызов отправлен!' : 'Challenge sent!');
                    } else {
                      alert(res.error || 'Failed');
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[9px] font-bold uppercase tracking-wider hover:bg-violet-500/25 transition-colors flex items-center gap-1"
                >
                  <Swords size={10} />
                  {language === 'ru' ? 'Вызвать' : 'Challenge'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pending Requests */}
      {subTab === 'requests' && (
        <div className="flex flex-col gap-2">
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <UserCheck size={28} className="text-gray-700" />
              <p className="text-[11px] text-gray-600">
                {language === 'ru' ? 'Нет входящих запросов' : 'No pending requests'}
              </p>
            </div>
          ) : (
            pendingRequests.map((r) => (
              <div key={r.request_id} className="flex items-center gap-3 p-3 rounded-2xl bg-yellow-500/5 border border-yellow-500/15">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-lg flex-shrink-0">
                  {r.logo_url ? <img src={r.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" /> : '👋'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-white truncate">{r.team_name}</p>
                  <p className="text-[8px] text-gray-500">{getTimeAgo(r.created_at, language)}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={async () => {
                      await respondToFriendRequest(r.request_id, true);
                      onRefresh();
                    }}
                    className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold hover:bg-emerald-500/30 transition-colors"
                  >
                    ✓
                  </button>
                  <button
                    onClick={async () => {
                      await respondToFriendRequest(r.request_id, false);
                      onRefresh();
                    }}
                    className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[9px] font-bold hover:bg-red-500/30 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Challenge History */}
      {subTab === 'history' && (
        <div className="flex flex-col gap-2">
          {challengeHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Swords size={28} className="text-gray-700" />
              <p className="text-[11px] text-gray-600">
                {language === 'ru' ? 'Пока нет истории вызовов' : 'No challenge history yet'}
              </p>
            </div>
          ) : (
            challengeHistory.map((ch) => {
              const resultColor = ch.result === 'win' ? 'text-emerald-400' : ch.result === 'loss' ? 'text-red-400' : 'text-yellow-400';
              const resultLabel = ch.result === 'win' ? (language === 'ru' ? 'Победа' : 'Win') : ch.result === 'loss' ? (language === 'ru' ? 'Поражение' : 'Loss') : (language === 'ru' ? 'Ничья' : 'Draw');
              return (
                <div key={ch.challenge_id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-lg flex-shrink-0">
                    {ch.opponent_logo ? <img src={ch.opponent_logo} alt="" className="w-8 h-8 rounded-lg object-cover" /> : '⚔️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">vs {ch.opponent_name}</p>
                    <p className="text-[8px] text-gray-500">{ch.score} · {getTimeAgo(ch.created_at, language)}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase ${resultColor}`}>{resultLabel}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHALLENGE CARD (for incoming challenges)
// ============================================================
function ChallengeCard({ challenge, language, onRefresh }: {
  challenge: PendingChallenge; language: string; onRefresh: () => void;
}) {
  const [resolving, setResolving] = useState(false);

  const handleResolve = async (accept: boolean) => {
    setResolving(true);
    try {
      const res = await resolvePvPChallenge(challenge.challenge_id, accept);
      if (res.success && res.result) {
        const msg = language === 'ru'
          ? `Результат: ${res.result.homeScore}:${res.result.awayScore}`
          : `Result: ${res.result.homeScore}:${res.result.awayScore}`;
        alert(msg);
      } else if (!res.success && res.error) {
        alert(res.error);
      }
      onRefresh();
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-violet-500/5 border border-violet-500/20">
      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-lg flex-shrink-0">
        {challenge.challenger_logo ? <img src={challenge.challenger_logo} alt="" className="w-8 h-8 rounded-lg object-cover" /> : '⚔️'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-white truncate">{challenge.challenger_name}</p>
        <p className="text-[8px] text-gray-500">{language === 'ru' ? 'вызывает вас на бой' : 'challenges you'} · {getTimeAgo(challenge.created_at, language)}</p>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => handleResolve(true)}
          disabled={resolving}
          className="px-2.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
        >
          {language === 'ru' ? 'Принять' : 'Accept'}
        </button>
        <button
          onClick={() => handleResolve(false)}
          disabled={resolving}
          className="px-2.5 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[9px] font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
        >
          {language === 'ru' ? 'Отклонить' : 'Decline'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SEARCH TAB
// ============================================================
function SearchTab({ language }: { language: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TeamResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await searchTeams(query);
      if (res.success && res.data) {
        setResults(res.data);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (targetUserId: string) => {
    const res = await sendFriendRequest(targetUserId);
    if (res.success) {
      setSent(prev => new Set(prev).add(targetUserId));
    } else {
      alert(res.error || 'Failed');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={language === 'ru' ? 'Найти команду...' : 'Search teams...'}
          className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={searching || query.trim().length < 2}
          className="px-3 py-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[10px] font-bold uppercase tracking-wider hover:bg-violet-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <Search size={12} />
          {searching ? '...' : (language === 'ru' ? 'Найти' : 'Search')}
        </button>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-2">
        {results.length === 0 && !searching && query.length >= 2 && (
          <p className="text-center text-[11px] text-gray-600 py-8">
            {language === 'ru' ? 'Команды не найдены' : 'No teams found'}
          </p>
        )}
        {results.map((team) => (
          <div key={team.team_id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-lg flex-shrink-0">
              {team.logo_url ? <img src={team.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" /> : '⚽'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{team.team_name}</p>
              <p className="text-[8px] text-gray-500">LVL {team.manager_level}</p>
            </div>
            <button
              onClick={() => handleAddFriend(team.user_id)}
              disabled={sent.has(team.user_id)}
              className="px-2.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {sent.has(team.user_id) ? (
                <><UserCheck size={10} /> {language === 'ru' ? 'Отправлено' : 'Sent'}</>
              ) : (
                <><UserPlus size={10} /> {language === 'ru' ? 'В друзья' : 'Add Friend'}</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// NEWS TAB
// ============================================================
function NewsTab({ news, language }: { news: NewsItem[]; language: string }) {
  if (news.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Newspaper size={32} className="text-gray-700" />
        <p className="text-[11px] text-gray-600">
          {language === 'ru' ? 'Пока нет новостей' : 'No news yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {news.map((item) => (
        <div key={item.id} className="glass-card-cyan p-4 relative overflow-hidden flex flex-col gap-2">
          <div className="absolute top-0 right-0 p-2 opacity-10"><Newspaper size={40} /></div>
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider bg-cyan-500/10 px-2 py-0.5 rounded-sm">{item.author}</span>
            <span className="text-[9px] text-gray-500 font-mono">{new Date(item.created_at).toLocaleDateString()}</span>
          </div>
          <h4 className="text-sm font-black font-orbitron text-white leading-tight">{item.title}</h4>
          <p className="text-[11px] text-gray-400 line-clamp-4 leading-relaxed mt-1">{item.body}</p>
        </div>
      ))}
    </div>
  );
}
