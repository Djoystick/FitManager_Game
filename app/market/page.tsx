'use client';

import { useEffect, useState, useTransition, useContext } from 'react';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { getMarketListingsAction, buyPlayerAction, cancelListingAction, getFreeAgentsAction, buyFreeAgentAction } from '@/app/actions/marketActions';
import { getIncomingOffers, getOutgoingOffers, acceptOffer, rejectOffer } from '@/app/actions/transferOfferActions';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import toast from 'react-hot-toast';
import { RefreshCw, Filter, ShieldAlert, TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { ScreenGuide } from '@/components/ui/ScreenGuide';
import { MarketWallet } from '@/components/market/MarketWallet';
import { motion } from 'framer-motion';
import { usePageTour } from '@/components/providers/PageTourProvider';
import { useRouter } from 'next/navigation';
import { SubNavTabs } from '@/components/ui/SubNavTabs';

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

const TICKER_ITEMS = [
  { sym: 'FWD', change: +2.4 }, { sym: 'MID', change: -0.8 }, { sym: 'GK', change: +1.1 },
  { sym: 'DEF', change: +0.3 }, { sym: 'CAM', change: -1.5 }, { sym: 'LWF', change: +3.2 },
  { sym: 'CDM', change: -0.4 }, { sym: 'CB',  change: +0.9 }, { sym: 'ST',  change: +2.1 },
  { sym: 'RB',  change: -0.2 }, { sym: 'LB',  change: +0.7 }, { sym: 'CF',  change: +1.8 },
];

function TickerStrip() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="overflow-hidden border-y border-white/5 bg-white/[0.02] py-1.5 backdrop-blur-sm">
      <div className="ticker-track">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 px-4 flex-shrink-0">
            <span className="text-[9px] font-black font-orbitron text-gray-500 uppercase">{item.sym}</span>
            <div className={`flex items-center gap-0.5 ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {item.change >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
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
  const getRarityStyle = (ovr: number) => {
    if (ovr >= 90) return { text: 'text-fuchsia-300', border: 'border-fuchsia-500/50', bg: 'bg-fuchsia-500/10', glow: 'shadow-[0_0_15px_rgba(217,70,239,0.3)]', textGlow: '0 0 12px rgba(217,70,239,0.6)' };
    if (ovr >= 80) return { text: 'text-amber-300', border: 'border-amber-500/50', bg: 'bg-amber-500/10', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]', textGlow: '0 0 12px rgba(245,158,11,0.5)' };
    if (ovr >= 65) return { text: 'text-cyan-300', border: 'border-cyan-500/50', bg: 'bg-cyan-500/10', glow: 'shadow-[0_0_12px_rgba(0,240,255,0.25)]', textGlow: '0 0 10px rgba(0,240,255,0.5)' };
    return { text: 'text-gray-400', border: 'border-white/10', bg: 'bg-white/5', glow: '', textGlow: 'none' };
  };
  const s = getRarityStyle(ovr);
  return (
    <div className={`flex flex-col items-center border rounded-xl px-2.5 py-1.5 backdrop-blur-md ${s.border} ${s.bg} ${s.glow}`}>
      <span className="text-[8px] uppercase tracking-widest font-bold text-gray-500">OVR</span>
      <span className={`text-xl font-black font-orbitron leading-none ${s.text}`} style={{ textShadow: s.textGlow }}>{ovr}</span>
    </div>
  );
}

export default function TransferMarketPage() {
  const { userId } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const { startTour, hasSeenTour, areAllToursSkipped } = usePageTour();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'market' | 'my_lots' | 'free_agents' | 'incoming_offers' | 'outgoing_offers'>('market');

  const triggerTour = () => {
    if (areAllToursSkipped()) return;
    startTour('market', [
      { targetId: 'market-filters', title: 'Трансферный Рынок', description: 'Здесь ты можешь покупать и продавать игроков за криптовалюту (TON).' },
      { targetId: 'market-wallet', title: 'Кошелек', description: 'Твой привязанный кошелек и баланс отображаются здесь.' }
    ]);
  };

  useEffect(() => {
    const handleStartTour = () => triggerTour();
    window.addEventListener('startPageTour', handleStartTour);
    if (!hasSeenTour('market')) {
      const timer = setTimeout(triggerTour, 500);
      return () => { clearTimeout(timer); window.removeEventListener('startPageTour', handleStartTour); };
    }
    return () => window.removeEventListener('startPageTour', handleStartTour);
  }, [hasSeenTour, areAllToursSkipped, startTour]);

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [freeAgents, setFreeAgents] = useState<any[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<any[]>([]);
  const [outgoingOffers, setOutgoingOffers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [tonBalance, setTonBalance] = useState<number>(0);
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'price_asc' | 'price_desc' | 'ovr_desc'>('price_asc');

  const fetchMarket = async () => {
    setIsLoading(true);
    try {
      const res = await getMarketListingsAction({ position: positionFilter !== 'ALL' ? positionFilter : undefined });
      if (res.success && res.data) {
        const sorted = [...res.data] as any[];
        if (sortOrder === 'price_asc') sorted.sort((a, b) => a.price_ton - b.price_ton);
        if (sortOrder === 'price_desc') sorted.sort((a, b) => b.price_ton - a.price_ton);
        if (sortOrder === 'ovr_desc') sorted.sort((a, b) => (b.player?.ovr || 0) - (a.player?.ovr || 0));
        setListings(sorted as MarketListing[]);
      } else { toast.error(res.error || 'Failed to fetch market'); }
    } catch (error) { console.error("Market fetch error", error); } finally { setIsLoading(false); }
  };

  const fetchFreeAgents = async () => {
    setIsLoading(true);
    try { const res = await getFreeAgentsAction(); if (res.success && res.data) setFreeAgents(res.data); else toast.error(res.error || 'Failed to fetch free agents'); }
    catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const fetchIncomingOffers = async () => {
    setIsLoading(true);
    try { const res = await getIncomingOffers(); if (res.success && res.data) setIncomingOffers(res.data); else toast.error(res.error || 'Failed to fetch incoming offers'); }
    catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const fetchOutgoingOffers = async () => {
    setIsLoading(true);
    try { const res = await getOutgoingOffers(); if (res.success && res.data) setOutgoingOffers(res.data); else toast.error(res.error || 'Failed to fetch outgoing offers'); }
    catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const fetchBalance = async () => {
    if (!userId) return;
    try { const res = await fetch(`/api/user/me?userId=${userId}`); if (res.ok) { const json = await res.json(); if (json.success && json.user) setTonBalance(json.user.balance_ton || 0); } }
    catch (e) { console.error('Failed to fetch balance', e); }
  };

  useEffect(() => {
    if (userId) {
      setTimeout(() => {
        if (activeTab === 'free_agents') { if (freeAgents.length === 0) fetchFreeAgents(); }
        else if (activeTab === 'incoming_offers') fetchIncomingOffers();
        else if (activeTab === 'outgoing_offers') fetchOutgoingOffers();
        else fetchMarket();
        fetchBalance();
      }, 0);
    }
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
      if (res.success) { toast.success(t.buy_success.replace('{name}', listing.player.name)); fetchBalance(); window.dispatchEvent(new Event('balanceUpdated')); fetchMarket(); }
      else { const errMsg = (language === 'ru' && (res as any).errorRu) ? (res as any).errorRu : (res.error || t.buy_error); toast.error(errMsg); }
    });
  };

  const handleBuyFreeAgent = (agent: any) => {
    const msg = (t.market_sign_confirm || 'Sign {name} for {price} FC?').replace('{name}', agent.name).replace('{price}', String(agent.priceFc));
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await buyFreeAgentAction(agent.token);
      if (res.success) { toast.success((t.market_signed || 'Signed {name}!').replace('{name}', agent.name)); fetchBalance(); window.dispatchEvent(new Event('balanceUpdated')); setFreeAgents(prev => prev.filter(a => a.token !== agent.token)); }
      else { toast.error(res.error || (t.market_failed_sign || 'Failed to sign free agent')); }
    });
  };

  const handleCancel = (listingId: string) => {
    if (!confirm(t.cancel_confirm)) return;
    startTransition(async () => {
      const res = await cancelListingAction(listingId);
      if (res.success) { toast.success(t.cancel_success); fetchMarket(); } else toast.error(res.error || t.cancel_error);
    });
  };

  const displayListings = activeTab === 'market' ? listings.filter(l => l.seller.id !== userId) : listings.filter(l => l.seller.id === userId);

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pb-24 relative" style={{ background: '#0a0a0f' }}>
      <ScreenGuide key="market" screenName="market" title={t.market_title} content={t.market_desc} />

      {/* Background — Premium Dark Glassmorphism */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,240,255,0.12)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(52,211,153,0.08)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_20%_80%,rgba(0,240,255,0.05)_0%,transparent_70%)]" />
      </div>

      {/* HEADER — Glassmorphism */}
      <header className="relative z-10 px-3 pt-3 pb-0">
        <div className="relative overflow-hidden p-3 rounded-2xl border border-white/10 backdrop-blur-xl"
             style={{
               background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
               boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
             }}>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-cyan-500/25 bg-cyan-500/10"
                   style={{ boxShadow: '0 0 15px rgba(0,240,255,0.15)' }}>
                <ArrowLeftRight className="text-cyan-400" size={18} />
              </div>
              <div>
                <h1 className="text-sm font-black font-orbitron text-white uppercase tracking-widest">
                  {t.market_transfer_market || 'Transfer Market'}
                </h1>
                <p className="text-[8px] text-cyan-400/50 uppercase tracking-wider mt-0.5">
                  {activeTab === 'free_agents' ? (t.market_scout_pool || 'Scout Pool') : t.p2p_transfers}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (activeTab === 'free_agents') fetchFreeAgents();
                else if (activeTab === 'incoming_offers') fetchIncomingOffers();
                else if (activeTab === 'outgoing_offers') fetchOutgoingOffers();
                else fetchMarket();
              }}
              disabled={isLoading || isPending}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 border border-white/10 bg-white/5
                         hover:text-cyan-300 hover:border-cyan-500/30 hover:bg-white/8 transition-all duration-300 active:scale-90"
            >
              <RefreshCw className={`w-4 h-4 ${(isLoading || isPending) ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* TICKER STRIP */}
      <div className="relative z-10 my-2">
        <TickerStrip />
      </div>

      <div className="relative z-10 px-3 flex flex-col gap-3">
        {/* WALLET */}
        <div id="market-wallet">
          <MarketWallet balance={tonBalance} userId={userId || ''} language={language} onBalanceUpdate={fetchBalance} />
        </div>

        {/* TABS — Glassmorphism */}
        <SubNavTabs
          tabs={[
            { id: 'market', label: t.tab_market },
            { id: 'free_agents', label: t.market_free_agents || 'FREE AGENTS' },
            { id: 'my_lots', label: t.tab_my_lots },
            { id: 'incoming_offers', label: 'IN OFFERS' },
            { id: 'outgoing_offers', label: 'OUT OFFERS' }
          ]}
          active={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          accent="cyan"
        />

        {/* FILTERS — Glassmorphism */}
        {activeTab === 'market' && (
          <div className="p-3 rounded-2xl border border-white/10 backdrop-blur-xl" id="market-filters"
               style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent rounded-2xl" />
            <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2">
              <Filter className="w-3 h-3" /> {t.filters}
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1.5">
              {['ALL', 'FWD', 'MID', 'DEF', 'GK'].map(pos => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(pos)}
                  className={`px-3 py-1.5 text-[9px] rounded-xl font-black uppercase tracking-wider flex-shrink-0 transition-all duration-300 border active:scale-95 ${
                    positionFilter === pos
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                      : 'bg-white/5 text-gray-500 border-white/10 hover:text-white hover:bg-white/8 hover:border-white/20'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {[
                { id: 'price_asc', label: t.price_asc },
                { id: 'price_desc', label: t.price_desc },
                { id: 'ovr_desc', label: t.ovr_desc }
              ].map(sort => (
                <button
                  key={sort.id}
                  onClick={() => setSortOrder(sort.id as any)}
                  className={`px-3 py-1.5 text-[9px] rounded-xl border font-bold uppercase tracking-wider flex-shrink-0 transition-all duration-300 active:scale-95 ${
                    sortOrder === sort.id
                      ? 'border-violet-500/40 text-violet-300 bg-violet-500/10 shadow-[0_0_10px_rgba(147,51,234,0.15)]'
                      : 'border-white/10 text-gray-600 hover:text-white hover:bg-white/8'
                  }`}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LISTINGS */}
        {isLoading ? (
          <CyberLoader fullScreen={false} />
        ) : activeTab === 'incoming_offers' ? (
          incomingOffers.length === 0 ? (
            <EmptyState icon={<ShieldAlert className="w-10 h-10 text-gray-700" />} text="No Incoming Offers" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {incomingOffers.map((offer, i) => (
                <motion.div key={offer.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="relative overflow-hidden p-3 rounded-2xl border border-white/10 backdrop-blur-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <div className="text-sm font-bold text-white mb-1">From: {offer.sender.name}</div>
                  <div className="text-sm text-cyan-300 mb-1">Target: {offer.target_player.name} (OVR {offer.target_player.ovr})</div>
                  <div className="text-xs text-amber-400 mb-1">Offered FC: {offer.offered_fc}</div>
                  {offer.offered_player && <div className="text-xs text-blue-300 mb-2">Offered Player: {offer.offered_player.name} (OVR {offer.offered_player.ovr})</div>}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { startTransition(async () => { const res = await acceptOffer(offer.id); if (res.success) { toast.success('Offer accepted'); fetchIncomingOffers(); fetchBalance(); } else toast.error(res.error || 'Failed'); }); }}
                      disabled={isPending} className="px-4 py-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-500/25 transition-all duration-300 active:scale-95 disabled:opacity-50">ACCEPT</button>
                    <button onClick={() => { startTransition(async () => { const res = await rejectOffer(offer.id); if (res.success) { toast.success('Offer rejected'); fetchIncomingOffers(); } else toast.error(res.error || 'Failed'); }); }}
                      disabled={isPending} className="px-4 py-2 bg-red-500/15 text-red-300 border border-red-500/40 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-500/25 transition-all duration-300 active:scale-95 disabled:opacity-50">REJECT</button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : activeTab === 'outgoing_offers' ? (
          outgoingOffers.length === 0 ? (
            <EmptyState icon={<ShieldAlert className="w-10 h-10 text-gray-700" />} text="No Outgoing Offers" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {outgoingOffers.map((offer, i) => (
                <motion.div key={offer.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="relative overflow-hidden p-3 rounded-2xl border border-white/10 backdrop-blur-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <div className="text-sm font-bold text-white mb-1">To: {offer.receiver.name}</div>
                  <div className="text-sm text-cyan-300 mb-1">Target: {offer.target_player.name} (OVR {offer.target_player.ovr})</div>
                  <div className="text-xs text-amber-400 mb-1">Offered FC: {offer.offered_fc}</div>
                  {offer.offered_player && <div className="text-xs text-blue-300 mb-1">Offered Player: {offer.offered_player.name} (OVR {offer.offered_player.ovr})</div>}
                  <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Status: {offer.status}</div>
                </motion.div>
              ))}
            </div>
          )
        ) : activeTab === 'free_agents' ? (
          freeAgents.length === 0 ? (
            <EmptyState icon={<ShieldAlert className="w-10 h-10 text-gray-700" />} text={t.market_no_free_agents || 'No Free Agents'} />
          ) : (
            <div className="flex flex-col gap-2.5">
              {freeAgents.map((agent, i) => (
                <motion.div key={agent.token} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="relative overflow-hidden p-3 rounded-2xl border border-amber-500/20 backdrop-blur-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md uppercase">{agent.position}</span>
                        <h3 className="text-sm font-black text-white uppercase truncate">{agent.name}</h3>
                      </div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                        {t.market_age?.replace('{age}', String(agent.age)) || `Age ${agent.age}`}
                      </div>
                      {agent.traits?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {agent.traits.map((tr: string) => (
                            <span key={tr} className="text-[7px] bg-violet-500/10 text-violet-300 border border-violet-500/25 px-1.5 py-0.5 rounded-md uppercase font-bold">{tr}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <OVRBadge ovr={agent.ovr} />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-400 text-sm">🟡</span>
                      <span className="text-sm font-black text-white font-orbitron">{agent.priceFc.toLocaleString()}</span>
                      <span className="text-[9px] text-amber-400/60 font-bold">FC</span>
                    </div>
                    <button onClick={() => handleBuyFreeAgent(agent)} disabled={isPending}
                      className="px-4 py-2 rounded-xl border border-amber-500/40 font-black uppercase text-[9px] tracking-widest
                                 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 
                                 transition-all duration-300 active:scale-95 disabled:opacity-50"
                      style={{ boxShadow: '0 0 15px rgba(245,158,11,0.1)' }}>
                      {t.market_sign || 'SIGN'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : displayListings.length === 0 ? (
          <EmptyState icon={<ShieldAlert className="w-10 h-10 text-gray-700" />} text={t.no_lots} sub={activeTab === 'market' ? t.no_lots_desc_market : t.no_lots_desc_my} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {displayListings.map((listing, i) => {
              const getRarity = (ovr: number) => {
                if (ovr >= 90) return { border: 'border-fuchsia-500/25', glow: 'shadow-[0_0_20px_rgba(217,70,239,0.1)]' };
                if (ovr >= 80) return { border: 'border-amber-500/25', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.1)]' };
                if (ovr >= 65) return { border: 'border-cyan-500/20', glow: 'shadow-[0_0_15px_rgba(0,240,255,0.08)]' };
                return { border: 'border-white/10', glow: '' };
              };
              const r = getRarity(listing.player.ovr);
              return (
                <motion.div key={listing.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={`relative overflow-hidden p-3 rounded-2xl border backdrop-blur-xl transition-all duration-300 hover:scale-[1.01] ${r.border} ${r.glow}`}
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black text-gray-400 bg-white/8 border border-white/10 px-1.5 py-0.5 rounded-md uppercase">{listing.player.position}</span>
                        <h3 className="text-sm font-black text-white uppercase truncate">{listing.player.name}</h3>
                      </div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 flex gap-3">
                        <span>{t.market_age?.replace('{age}', String(listing.player.age)) || `Age ${listing.player.age}`}</span>
                        <span>{t.market_seasons?.replace('{count}', String(listing.player.seasons_played)) || `S${listing.player.seasons_played}`}</span>
                      </div>
                      {listing.player.traits?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {listing.player.traits.map(tr => (
                            <span key={tr} className="text-[7px] bg-violet-500/10 text-violet-300 border border-violet-500/25 px-1.5 py-0.5 rounded-md uppercase font-bold">{tr}</span>
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
                      <span className="text-[9px] text-blue-400/60 font-bold">TON</span>
                    </div>
                    {activeTab === 'market' ? (
                      <button onClick={() => handleBuy(listing)} disabled={isPending}
                        className="px-4 py-2 rounded-xl border border-cyan-500/40 font-black uppercase text-[9px] tracking-widest
                                   bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/60 
                                   transition-all duration-300 active:scale-95 disabled:opacity-50"
                        style={{ boxShadow: '0 0 15px rgba(0,240,255,0.1)' }}>
                        {t.buy_button}
                      </button>
                    ) : (
                      <button onClick={() => handleCancel(listing.id)} disabled={isPending}
                        className="px-4 py-2 rounded-xl border border-red-500/30 font-black uppercase text-[9px] tracking-widest
                                   bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-400/50 
                                   transition-all duration-300 active:scale-95 disabled:opacity-50">
                        {t.cancel_button}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 mt-2 rounded-2xl border border-white/10 backdrop-blur-xl"
         style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-2xl" />
      <div className="mb-4 opacity-40">{icon}</div>
      <span className="text-sm font-black text-gray-500 uppercase tracking-widest text-center">{text}</span>
      {sub && <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-2 text-center max-w-[200px]">{sub}</p>}
    </div>
  );
}
