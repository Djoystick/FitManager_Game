'use client';

import React, { useEffect, useState } from 'react';
import { Newspaper, ChevronRight, Activity } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface NewsItem {
  id: string;
  title: string;
  body: string;
  author: string;
  created_at: string;
}

export function SocialFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const { data, error } = await supabase
          .from('social_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        if (!error && data) {
          setNews(data);
        }
      } catch (err) {
        console.error('Failed to load social feed', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [supabase]);

  if (loading) {
    return (
      <div className="glass-card-cyan p-4 animate-pulse flex items-center justify-center min-h-[100px]">
        <Activity className="animate-spin text-cyan-500" size={24} />
      </div>
    );
  }

  if (news.length === 0) {
    return null; // Don't show if empty
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <Newspaper className="text-cyan-400" size={16} />
        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/70">
          News Feed
        </h3>
      </div>
      
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 scrollbar-hide">
        {news.map((item) => (
          <div 
            key={item.id}
            className="snap-center shrink-0 w-[85%] glass-card-cyan p-4 relative overflow-hidden flex flex-col gap-2"
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
            
            <p className="text-[11px] text-gray-400 line-clamp-3 leading-relaxed mt-1">
              {item.body}
            </p>
            
            <button className="text-[10px] font-bold text-cyan-300 mt-2 flex items-center gap-1 hover:text-cyan-200 transition-colors w-fit">
              Читать полностью <ChevronRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
