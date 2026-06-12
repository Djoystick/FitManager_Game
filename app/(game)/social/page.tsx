'use client';

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { Newspaper, Bell, ArrowLeft, CheckCheck } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import type { PersonalNotification } from '@/lib/types';
import { resolveBilingual } from '@/lib/types';

interface NewsItem {
  id: string;
  title: string;
  body: string;
  author: string;
  created_at: string;
}

type Tab = 'notifications' | 'news';

const TYPE_ICONS: Record<string, string> = {
  transfer: '💰',
  injury: '🚑',
  challenge: '⚔️',
  system: '📢',
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
  const [loading, setLoading] = useState(true);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [notifRes, newsRes] = await Promise.all([
          fetch('/api/social/personal-notifications', { cache: 'no-store' }),
          supabase.from('social_feed').select('*').order('created_at', { ascending: false }).limit(20),
        ]);
        if (notifRes.ok) {
          const json = await notifRes.json();
          setNotifications(json.notifications ?? []);
        }
        if (!newsRes.error && newsRes.data) {
          setNews(newsRes.data);
        }
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
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setTab('notifications')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
              tab === 'notifications'
                ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'
            }`}
          >
            <Bell size={12} />
            {t.notifications || 'Уведомления'}
            {unreadCount > 0 && (
              <span className="ml-1 min-w-[14px] h-[14px] rounded-full bg-cyan-400 text-[#05060f] text-[7px] font-black flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('news')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
              tab === 'news'
                ? 'bg-yellow-500/15 border border-yellow-500/30 text-yellow-300'
                : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'
            }`}
          >
            <Newspaper size={12} />
            {t.feed_news || 'Новости'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : tab === 'notifications' ? (
          <NotificationsTab
            notifications={notifications}
            onMarkAllRead={markAllRead}
            unreadCount={unreadCount}
            language={language}
          />
        ) : (
          <NewsTab news={news} language={language} />
        )}
      </div>
    </div>
  );
}

function NotificationsTab({
  notifications,
  onMarkAllRead,
  unreadCount,
  language,
}: {
  notifications: PersonalNotification[];
  onMarkAllRead: () => void;
  unreadCount: number;
  language: string;
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
        <button
          onClick={onMarkAllRead}
          className="self-end flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] text-cyan-400 font-bold uppercase tracking-wider hover:bg-cyan-500/10 transition-colors mb-1"
        >
          <CheckCheck size={10} />
          {language === 'ru' ? 'Отметить все как прочитанные' : 'Mark all as read'}
        </button>
      )}
      {notifications.map((n) => {
        const icon = TYPE_ICONS[n.type] ?? '📢';
        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
              n.is_read
                ? 'bg-white/[0.02] border-white/5 opacity-50'
                : 'bg-cyan-500/5 border-cyan-500/20'
            }`}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/40 border border-white/8 flex-shrink-0 text-lg">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black text-white uppercase tracking-wide">{n.title}</span>
                {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
              </div>
              <p className="text-[10px] text-gray-400 leading-snug">{resolveBilingual(n.message, language)}</p>
            </div>
            <span className="text-[8px] text-gray-700 font-mono flex-shrink-0 pt-0.5">
              {getTimeAgo(n.created_at, language)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
        <div
          key={item.id}
          className="glass-card-cyan p-4 relative overflow-hidden flex flex-col gap-2"
        >
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Newspaper size={40} />
          </div>
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider bg-cyan-500/10 px-2 py-0.5 rounded-sm">
              {item.author}
            </span>
            <span className="text-[9px] text-gray-500 font-mono">
              {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>
          <h4 className="text-sm font-black font-orbitron text-white leading-tight">
            {item.title}
          </h4>
          <p className="text-[11px] text-gray-400 line-clamp-4 leading-relaxed mt-1">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}
