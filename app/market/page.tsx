'use client';

import { useEffect, useState, useTransition, useContext } from 'react';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { getMarketListingsAction, buyPlayerAction, cancelListingAction, getFreeAgentsAction, buyFreeAgentAction } from '@/app/actions/marketActions';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import toast from 'react-hot-toast';
import { RefreshCw, Filter, ShieldAlert } from 'lucide-react';
import { ScreenGuide } from '@/components/ui/ScreenGuide';
import { MarketWallet } from '@/components/market/MarketWallet';

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

export default function TransferMarketPage() {
  const { userId } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];

  const [activeTab, setActiveTab] = useState<'market' | 'my_lots' | 'free_agents'>('market');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [freeAgents, setFreeAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [tonBalance, setTonBalance] = useState<number>(0);

  // Filters
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'price_asc' | 'price_desc' | 'ovr_desc'>('price_asc');

  const fetchMarket = async () => {
    setIsLoading(true);
    try {
      const res = await getMarketListingsAction({ 
        position: positionFilter !== 'ALL' ? positionFilter : undefined 
      });
      if (res.success && res.data) {
        let sorted = [...res.data] as any[];
        if (sortOrder === 'price_asc') sorted.sort((a, b) => a.price_ton - b.price_ton);
        if (sortOrder === 'price_desc') sorted.sort((a, b) => b.price_ton - a.price_ton);
        if (sortOrder === 'ovr_desc') sorted.sort((a, b) => (b.player?.ovr || 0) - (a.player?.ovr || 0));
        
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
      if (res.success && res.data) {
        setFreeAgents(res.data);
      } else {
        toast.error(res.error || 'Failed to fetch free agents');
      }
    } catch (e) {
      console.error("Free agents fetch error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBalance = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/user/me?userId=${userId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user) {
          setTonBalance(json.user.balance_ton || 0);
        }
      }
    } catch (e) {
      console.error('Failed to fetch balance', e);
    }
  };

  useEffect(() => {
    if (userId) {
      if (activeTab === 'free_agents') {
        if (freeAgents.length === 0) fetchFreeAgents();
      } else {
        fetchMarket();
      }
      fetchBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionFilter, sortOrder, userId, activeTab]);

  useEffect(() => {
    const handleBalanceUpdate = () => fetchBalance();
    window.addEventListener('balanceUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('balanceUpdated', handleBalanceUpdate);
  }, []);

  const handleBuy = (listing: MarketListing) => {
    if (tonBalance < listing.price_ton) {
      toast.error('Insufficient TON');
      return;
    }

    const msg = t.buy_confirm.replace('{name}', listing.player.name).replace('{price}', listing.price_ton.toString());
    if (!confirm(msg)) return;
    
    startTransition(async () => {
      const res = await buyPlayerAction(listing.id);
      if (res.success) {
        toast.success(t.buy_success.replace('{name}', listing.player.name));
        // Trigger balance update for global header
        fetchBalance();
        window.dispatchEvent(new Event('balanceUpdated'));
        fetchMarket();
      } else {
        toast.error(res.error || t.buy_error);
      }
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
        // Remove bought agent from the list
        setFreeAgents(prev => prev.filter(a => a.token !== agent.token));
      } else {
        toast.error(res.error || 'Failed to sign free agent');
      }
    });
  };

  const handleCancel = (listingId: string) => {
    if (!confirm(t.cancel_confirm)) return;
    
    startTransition(async () => {
      const res = await cancelListingAction(listingId);
      if (res.success) {
        toast.success(t.cancel_success);
        fetchMarket();
      } else {
        toast.error(res.error || t.cancel_error);
      }
    });
  };

  const displayListings = activeTab === 'market' 
    ? listings.filter(l => l.seller.id !== userId) 
    : listings.filter(l => l.seller.id === userId);

  return (
    <div className="flex flex-col flex-1 p-4 gap-4 min-h-screen bg-space-dark text-white pb-24">
      <ScreenGuide 
        key="market"
        screenName="market"
        title={t.market_title}
        content={t.market_desc}
      />
      {/* HEADER */}
      <header className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black uppercase tracking-tighter mt-1">
            Web3 <span className="text-neon-cyan">Market</span>
          </h1>
          <button 
            onClick={activeTab === 'free_agents' ? fetchFreeAgents : fetchMarket}
            disabled={isLoading || isPending}
            className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-neon-cyan hover:border-neon-cyan transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${(isLoading || isPending) ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">
          {activeTab === 'free_agents' ? 'Procedural Scouting Pool' : t.p2p_transfers}
        </p>
      </header>

      {/* WALLET */}
      <MarketWallet 
        balance={tonBalance} 
        userId={userId || ''} 
        language={language}
        onBalanceUpdate={fetchBalance}
      />

      {/* TABS */}
      <div className="flex bg-black/40 border border-gray-800 p-1 rounded-lg">
        <button 
          onClick={() => setActiveTab('market')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${activeTab === 'market' ? 'bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-gray-400 hover:text-white'}`}
        >
          {t.tab_market}
        </button>
        <button 
          onClick={() => setActiveTab('free_agents')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${activeTab === 'free_agents' ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'text-gray-400 hover:text-white'}`}
        >
          Free Agents
        </button>
        <button 
          onClick={() => setActiveTab('my_lots')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${activeTab === 'my_lots' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'text-gray-400 hover:text-white'}`}
        >
          {t.tab_my_lots}
        </button>
      </div>

      {/* FILTERS (Only visible on Market tab) */}
      {activeTab === 'market' && (
        <div className="flex flex-col gap-2 p-3 bg-gray-900/50 rounded-xl border border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">
            <Filter className="w-3 h-3" /> {t.filters}
          </div>
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
            {['ALL', 'FWD', 'MID', 'DEF', 'GK'].map(pos => (
              <button 
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`px-3 py-1 text-[10px] rounded-full font-black uppercase tracking-widest shrink-0 transition-all ${
                  positionFilter === pos ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 mt-1">
            {[
              { id: 'price_asc', label: t.price_asc },
              { id: 'price_desc', label: t.price_desc },
              { id: 'ovr_desc', label: t.ovr_desc }
            ].map(sort => (
              <button 
                key={sort.id}
                onClick={() => setSortOrder(sort.id as any)}
                className={`px-3 py-1 text-[10px] rounded border font-bold uppercase tracking-widest shrink-0 transition-all ${
                  sortOrder === sort.id ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10' : 'border-gray-700 text-gray-500 hover:text-gray-300'
                }`}
              >
                {sort.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LISTINGS FEED */}
      {isLoading ? (
        <CyberLoader fullScreen={false} />
      ) : activeTab === 'free_agents' ? (
        freeAgents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-xl p-8 mt-4">
            <ShieldAlert className="w-12 h-12 text-gray-600 mb-4" />
            <span className="text-sm font-black text-gray-500 uppercase tracking-widest text-center">No Free Agents</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-10 mt-2">
            {freeAgents.map((agent) => (
              <div key={agent.token} className="bg-black/80 border border-yellow-500/30 p-3 rounded-xl flex flex-col gap-2 shadow-lg relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="flex justify-between items-start z-10">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-gray-800 bg-yellow-500 px-1.5 rounded">{agent.position}</span>
                      <h3 className="text-base font-bold text-yellow-500 uppercase tracking-wider">{agent.name}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                      <span>{t.age_label}: {agent.age}</span>
                    </div>
                    
                    {agent.traits && agent.traits.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {agent.traits.map((tr: string) => (
                          <span key={tr} className="text-[8px] bg-purple-900/30 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-sm uppercase font-bold tracking-widest">
                            {tr}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end z-10">
                    <span className="text-[9px] text-yellow-500/70 uppercase font-bold tracking-widest">OVR</span>
                    <span className="text-2xl font-black text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)] leading-none">{agent.ovr}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-2 border-t border-gray-800/60 pt-3 z-10">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Sign-on Bonus</span>
                    <span className="text-base font-black text-white flex items-center gap-1.5 mt-0.5">
                      <span className="text-yellow-400 text-sm">🟡</span> 
                      <span className="font-orbitron tracking-wider">{agent.priceFc.toLocaleString()}</span>
                      <span className="text-xs text-yellow-500">FC</span>
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => handleBuyFreeAgent(agent)}
                    disabled={isPending}
                    className="px-5 py-2.5 rounded border border-yellow-500/50 font-black uppercase text-[10px] tracking-widest transition-all bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black shadow-[0_0_10px_rgba(234,179,8,0.1)] disabled:opacity-50"
                  >
                    SIGN AGENT
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : displayListings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-xl p-8 mt-4">
          <ShieldAlert className="w-12 h-12 text-gray-600 mb-4" />
          <span className="text-sm font-black text-gray-500 uppercase tracking-widest text-center">{t.no_lots}</span>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-2 text-center">
            {activeTab === 'market' ? t.no_lots_desc_market : t.no_lots_desc_my}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-10 mt-2">
          {displayListings.map((listing) => (
            <div key={listing.id} className="bg-black/80 border border-gray-800 p-3 rounded-xl flex flex-col gap-2 shadow-lg relative overflow-hidden">
              
              {/* OVR BADGE BACKGROUND GLOW */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-neon-cyan/5 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-start z-10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-gray-500 bg-gray-900 px-1.5 rounded">{listing.player.position}</span>
                    <h3 className="text-base font-bold text-white uppercase tracking-wider">{listing.player.name}</h3>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                    <span>{t.age_label}: {listing.player.age}</span>
                    <span>{t.seasons_played}: {listing.player.seasons_played}</span>
                  </div>
                  
                  {listing.player.traits && listing.player.traits.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {listing.player.traits.map(t => (
                        <span key={t} className="text-[8px] bg-purple-900/30 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-sm uppercase font-bold tracking-widest">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-end z-10">
                  <span className="text-[9px] text-neon-cyan/70 uppercase font-bold tracking-widest">OVR</span>
                  <span className="text-2xl font-black text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.6)] leading-none">{listing.player.ovr}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2 border-t border-gray-800/60 pt-3 z-10">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">{t.lot_price}</span>
                  <span className="text-base font-black text-white flex items-center gap-1.5 mt-0.5">
                    <span className="text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] text-sm">💎</span> 
                    <span className="font-orbitron tracking-wider">{listing.price_ton}</span>
                    <span className="text-xs text-blue-500">TON</span>
                  </span>
                </div>
                
                {activeTab === 'market' ? (
                  <button 
                    onClick={() => handleBuy(listing)}
                    disabled={isPending}
                    className="px-5 py-2.5 rounded border border-neon-cyan/50 font-black uppercase text-[10px] tracking-widest transition-all bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan hover:text-black shadow-[0_0_10px_rgba(0,240,255,0.1)] disabled:opacity-50"
                  >
                    {t.buy_button}
                  </button>
                ) : (
                  <button 
                    onClick={() => handleCancel(listing.id)}
                    disabled={isPending}
                    className="px-4 py-2 rounded border border-red-500/50 font-black uppercase text-[10px] tracking-widest transition-all bg-red-900/20 text-red-400 hover:bg-red-600 hover:text-white disabled:opacity-50"
                  >
                    {t.cancel_button}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
