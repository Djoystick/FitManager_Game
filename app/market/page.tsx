'use client';

import { useEffect, useState, useTransition, useContext } from 'react';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { getMarketListingsAction, buyPlayerAction, cancelListingAction, getFreeAgentsAction, buyFreeAgentAction } from '@/app/actions/marketActions';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import toast from 'react-hot-toast';
import { RefreshCw, Filter, ShieldAlert, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ScreenGuide } from '@/components/ui/ScreenGuide';
import { MarketWallet } from '@/components/market/MarketWallet';
import { motion } from 'framer-motion';

interface MarketListing {
  id: string;
  price_ton: number;
  created_at: string;
  seller: { id: string };
  player: {
    id: string;
    name: string;
    age: number;
    ovr: number;
    position: string;
    traits: string[];
    seasons_played: number;
  };
}

// Decorative ticker items
const TICKER_ITEMS = [
  { sym: 'FWD', change: +2.4 }, { sym: 'MID', change: -0.8 }, { sym: 'GK', change: +1.1 },
  { sym: 'DEF', change: +0.3 }, { sym: 'CAM', change: -1.5 }, { sym: 'LWF', change: +3.2 },
  { sym: 'CDM', change: -0.4 }, { sym: 'CB',  change: +0.9 }, { sym: 'ST',  change: +2.1 },
  { sym: 'RB',  change: -0.2 }, { sym: 'LB',  change: +0.7 }, { sym: 'CF',  change: +1.8 },
];

function TickerStrip() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]; // doubled for seamless loop
  return (
    <div className="overflow-hidden border-y border-white/5 bg-black/30 py-1">
      <div className="ticker-track">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 px-4 flex-shrink-0">
            <span className="text-[9px] font-black font-orbitron text-gray-400 uppercase">{item.sym}</span>
            <div className={`flex items-center gap-0.5 ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {item.change >= 0
                ? <TrendingUp size={8} />
                : <TrendingDown size={8} />
              }
              <span className="text-[8px] font-bold">{item.change > 0 ? '+' : ''}{item.change}%</span>
            </div>
            <div className="w-px h-3 bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function OVRBadge({ ovr }: { ovr: number }) {
  const color = ovr >= 80 ? 'text-violet-300 border-violet-500/50 bg-violet-500/10 shadow-[0_0_8px_rgba(147,51,234,0.3)]'
              : ovr >= 70 ? 'text-cyan-300 border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
              : ovr >= 60 ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
              : 'text-gray-400 border-gray-600/40 bg-gray-500/10';
  return (
    <div className={`flex flex-col items-center border rounded-xl px-2.5 py-1.5 ${color}`}>
      <span className="text-[8px] uppercase tracking-widest font-bold">OVR</span>
      <span className="text-xl font-black font-orbitron leading-none">{ovr}</span>
    </div>
  );
}

export default function TransferMarketPage() {
  const { userId } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];

  const [activeTab,       setActiveTab]      = useState<'market' | 'my_lots' | 'free_agents'>('market');
  const [listings,        setListings]       = useState<MarketListing[]>([]);
  const [freeAgents,      setFreeAgents]     = useState<any[]>([]);
  const [isLoading,       setIsLoading]      = useState(true);
  const [isPending,       startTransition]   = useTransition();
  const [tonBalance,      setTonBalance]     = useState<number>(0);
  const [positionFilter,  setPositionFilter] = useState<string>('ALL');
  const [sortOrder,       setSortOrder]      = useState<'price_asc' | 'price_desc' | 'ovr_desc'>('price_asc');

  const fetchMarket = async () => {
    setIsLoading(true);
    try {
      const res = await getMarketListingsAction({ position: positionFilter !== 'ALL' ? positionFilter : undefined });
      if (res.success && res.data) {
        const sorted = [...res.data] as any[];
        if (sortOrder === 'price_asc')  sorted.sort((a, b) => a.price_ton - b.price_ton);
        if (sortOrder === 'price_desc') sorted.sort((a, b) => b.price_ton - a.price_ton);
        if (sortOrder === 'ovr_desc')   sorted.sort((a, b) => (b.player?.ovr || 0) - (a.player?.ovr || 0));
        setListings(sorted as MarketListing[]);
      } else {
        toast.error(res.error || 'Failed to fetch market');
      }
    } catch (error) {
      console.error("Market fetch error", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFreeAgents = async () => {
    setIsLoading(true);
    try {
      const res = await getFreeAgentsAction();
      if (res.success && res.data) setFreeAgents(res.data);
      else toast.error(res.error || 'Failed to fetch free agents');
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const fetchBalance = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/user/me?userId=${userId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user) setTonBalance(json.user.balance_ton || 0);
      }
    } catch (e) { console.error('Failed to fetch balance', e); }
  };

  useEffect(() => {
    if (userId) {
      setTimeout(() => {
        if (activeTab === 'free_agents') {
          if (freeAgents.length === 0) fetchFreeAgents();
        } else {
          fetchMarket();
        }
        fetchBalance();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionFilter, sortOrder, userId, activeTab]);

  useEffect(() => {
    const handleBalanceUpdate = () => fetchBalance();
    window.addEventListener('balanceUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('balanceUpdated', handleBalanceUpdate);
  }, []);

  const handleBuy = (listing: MarketListing) => {
    if (tonBalance < listing.price_ton) { toast.error('Insufficient TON'); return; }
    const msg = t.buy_confirm.replace('{name}', listing.player.name).replace('{price}', listing.price_ton.toString());
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await buyPlayerAction(listing.id);
      if (res.success) {
        toast.success(t.buy_success.replace('{name}', listing.player.name));
        fetchBalance();
        window.dispatchEvent(new Event('balanceUpdated'));
        fetchMarket();
      } else { toast.error(res.error || t.buy_error); }
    });
  };

  const handleBuyFreeAgent = (agent: any) => {
    const msg = `Sign ${agent.name} for ${agent.priceFc} FC?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await buyFreeAgentAction(agent.token);
      if (res.success) {
        toast.success(`Signed ${agent.name}!`);
        fetchBalance();
        window.dispatchEvent(new Event('balanceUpdated'));
        setFreeAgents(prev => prev.filter(a => a.token !== agent.token));
      } else { toast.error(res.error || 'Failed to sign free agent'); }
    });
  };

  const handleCancel = (listingId: string) => {
    if (!confirm(t.cancel_confirm)) return;
    startTransition(async () => {
      const res = await cancelListingAction(listingId);
      if (res.success) { toast.success(t.cancel_success); fetchMarket(); }
      else toast.error(res.error || t.cancel_error);
    });
  };

  const displayListings = activeTab === 'market'
    ? listings.filter(l => l.seller.id !== userId)
    : listings.filter(l => l.seller.id === userId);

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pb-24" style={{ background: '#05060f' }}>
      <ScreenGuide key="market" screenName="market" title={t.market_title} content={t.market_desc} />

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none bg-grid-cyan opacity-60" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_30%_at_50%_0%,rgba(0,240,255,0.07)_0%,transparent_100%)]" />

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="relative z-10 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-black font-orbitron uppercase tracking-tight">
              WEB3 <span className="text-cyan-300 neon-text-cyan">MARKET</span>
            </h1>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
              {activeTab === 'free_agents' ? 'Procedural Scouting Pool' : t.p2p_transfers}
            </p>
          </div>
          <button
            onClick={activeTab === 'free_agents' ? fetchFreeAgents : fetchMarket}
            disabled={isLoading || isPending}
            className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-gray-400
                       hover:text-cyan-300 hover:border-cyan-500/40 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${(isLoading || isPending) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* ── TICKER STRIP ───────────────────────────────────────────── */}
      <div className="relative z-10 my-2">
        <TickerStrip />
      </div>

      <div className="relative z-10 px-4 flex flex-col gap-3">
        {/* ── WALLET ─────────────────────────────────────────────── */}
        <MarketWallet balance={tonBalance} userId={userId || ''} language={language} onBalanceUpdate={fetchBalance} />

        {/* ── TABS ───────────────────────────────────────────────── */}
        <div className="glass-card flex p-1 gap-0.5">
          {[
            { id: 'market',      label: t.tab_market,   active: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
            { id: 'free_agents', label: 'Free Agents',  active: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
            { id: 'my_lots',     label: t.tab_my_lots,  active: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all duration-200 border ${
                activeTab === tab.id
                  ? `${tab.active} shadow-sm`
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── FILTERS ────────────────────────────────────────────── */}
        {activeTab === 'market' && (
          <div className="glass-card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[9px] text-gray-600 uppercase tracking-widest font-bold">
              <Filter className="w-3 h-3" /> {t.filters}
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {['ALL', 'FWD', 'MID', 'DEF', 'GK'].map(pos => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(pos)}
                  className={`px-3 py-1 text-[9px] rounded-full font-black uppercase tracking-wider flex-shrink-0 transition-all border ${
                    positionFilter === pos
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                      : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {[
                { id: 'price_asc',  label: t.price_asc  },
                { id: 'price_desc', label: t.price_desc },
                { id: 'ovr_desc',   label: t.ovr_desc   }
              ].map(sort => (
                <button
                  key={sort.id}
                  onClick={() => setSortOrder(sort.id as any)}
                  className={`px-3 py-1 text-[9px] rounded-lg border font-bold uppercase tracking-wider flex-shrink-0 transition-all ${
                    sortOrder === sort.id
                      ? 'border-violet-500/50 text-violet-300 bg-violet-500/10'
                      : 'border-white/10 text-gray-600 hover:text-gray-300'
                  }`}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── LISTINGS ───────────────────────────────────────────── */}
        {isLoading ? (
          <CyberLoader fullScreen={false} />
        ) : activeTab === 'free_agents' ? (
          freeAgents.length === 0 ? (
            <EmptyState icon={<ShieldAlert className="w-10 h-10 text-gray-700" />} text="No Free Agents" />
          ) : (
            <div className="flex flex-col gap-2">
              {freeAgents.map((agent, i) => (
                <motion.div
                  key={agent.token}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card relative overflow-hidden p-3"
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-yellow-500/8 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black text-black bg-yellow-500 px-1.5 py-0.5 rounded-md uppercase">
                          {agent.position}
                        </span>
                        <h3 className="text-sm font-black text-yellow-300 uppercase truncate">{agent.name}</h3>
                      </div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                        Age {agent.age}
                      </div>
                      {agent.traits?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {agent.traits.map((tr: string) => (
                            <span key={tr} className="text-[7px] bg-violet-900/30 text-violet-400 border border-violet-500/30
                                                       px-1.5 py-0.5 rounded-sm uppercase font-bold">{tr}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <OVRBadge ovr={agent.ovr} />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-yellow-400 text-sm">🟡</span>
                      <span className="text-sm font-black text-white font-orbitron">{agent.priceFc.toLocaleString()}</span>
                      <span className="text-[9px] text-yellow-500 font-bold">FC</span>
                    </div>
                    <button
                      onClick={() => handleBuyFreeAgent(agent)}
                      disabled={isPending}
                      className="px-4 py-2 rounded-lg border border-yellow-500/50 font-black uppercase text-[9px] tracking-widest
                                 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all disabled:opacity-50"
                    >
                      SIGN
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : displayListings.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert className="w-10 h-10 text-gray-700" />}
            text={t.no_lots}
            sub={activeTab === 'market' ? t.no_lots_desc_market : t.no_lots_desc_my}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {displayListings.map((listing, i) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card relative overflow-hidden p-3"
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                <div className="absolute -top-8 -right-8 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black text-gray-500 bg-white/10 px-1.5 py-0.5 rounded-md uppercase">
                        {listing.player.position}
                      </span>
                      <h3 className="text-sm font-black text-white uppercase truncate">{listing.player.name}</h3>
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 flex gap-3">
                      <span>Age {listing.player.age}</span>
                      <span>S{listing.player.seasons_played}</span>
                    </div>
                    {listing.player.traits?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {listing.player.traits.map(tr => (
                          <span key={tr} className="text-[7px] bg-violet-900/30 text-violet-400 border border-violet-500/30
                                                     px-1.5 py-0.5 rounded-sm uppercase font-bold">{tr}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <OVRBadge ovr={listing.player.ovr} />
                </div>
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-400 text-sm">💎</span>
                    <span className="text-sm font-black text-white font-orbitron">{listing.price_ton}</span>
                    <span className="text-[9px] text-blue-400 font-bold">TON</span>
                  </div>
                  {activeTab === 'market' ? (
                    <button
                      onClick={() => handleBuy(listing)}
                      disabled={isPending}
                      className="px-4 py-2 rounded-lg border border-cyan-500/50 font-black uppercase text-[9px] tracking-widest
                                 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500 hover:text-black transition-all disabled:opacity-50"
                    >
                      {t.buy_button}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCancel(listing.id)}
                      disabled={isPending}
                      className="px-4 py-2 rounded-lg border border-red-500/40 font-black uppercase text-[9px] tracking-widest
                                 bg-red-900/15 text-red-400 hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                    >
                      {t.cancel_button}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center glass-card p-10 mt-2">
      <div className="mb-4 opacity-50">{icon}</div>
      <span className="text-sm font-black text-gray-500 uppercase tracking-widest text-center">{text}</span>
      {sub && <p className="text-gray-700 text-[10px] uppercase tracking-widest mt-2 text-center max-w-[200px]">{sub}</p>}
    </div>
  );
}
