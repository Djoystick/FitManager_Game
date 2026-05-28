'use client';

import { useEffect, useState, useTransition, useContext } from 'react';
import { BackButton } from '@/components/ui/BackButton';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { getMarketListingsAction, buyPlayerAction, cancelListingAction } from '@/app/actions/marketActions';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import toast from 'react-hot-toast';
import { RefreshCw, Filter, ShieldAlert } from 'lucide-react';

interface MarketListing {
  id: string;
  price_ton: number;
  created_at: string;
  seller: { id: string; username: string };
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
  const [activeTab, setActiveTab] = useState<'market' | 'my_lots'>('market');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

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

  useEffect(() => {
    fetchMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionFilter, sortOrder]);

  const handleBuy = (listing: MarketListing) => {
    if (!confirm(`Вы уверены, что хотите купить ${listing.player.name} за ${listing.price_ton} TON?`)) return;
    
    startTransition(async () => {
      const res = await buyPlayerAction(listing.id);
      if (res.success) {
        toast.success(`Игрок ${listing.player.name} успешно куплен!`);
        // Trigger balance update for global header
        window.dispatchEvent(new Event('balanceUpdated'));
        fetchMarket();
      } else {
        toast.error(res.error || 'Ошибка при покупке');
      }
    });
  };

  const handleCancel = (listingId: string) => {
    if (!confirm('Отменить продажу игрока? Налог в FC возвращен не будет.')) return;
    
    startTransition(async () => {
      const res = await cancelListingAction(listingId);
      if (res.success) {
        toast.success('Продажа отменена');
        fetchMarket();
      } else {
        toast.error(res.error || 'Ошибка отмены');
      }
    });
  };

  const displayListings = activeTab === 'market' 
    ? listings.filter(l => l.seller.id !== userId) 
    : listings.filter(l => l.seller.id === userId);

  return (
    <div className="flex flex-col flex-1 p-4 gap-4 min-h-screen bg-space-dark text-white">
      {/* HEADER */}
      <header className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between">
          <BackButton />
          <button 
            onClick={fetchMarket}
            disabled={isLoading || isPending}
            className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-neon-cyan hover:border-neon-cyan transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${(isLoading || isPending) ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tighter mt-1">
          Web3 <span className="text-neon-cyan">Market</span>
        </h1>
        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">
          P2P Трансферы за TON
        </p>
      </header>

      {/* TABS */}
      <div className="flex bg-black/40 border border-gray-800 p-1 rounded-lg">
        <button 
          onClick={() => setActiveTab('market')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${activeTab === 'market' ? 'bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-gray-400 hover:text-white'}`}
        >
          Рынок
        </button>
        <button 
          onClick={() => setActiveTab('my_lots')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${activeTab === 'my_lots' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'text-gray-400 hover:text-white'}`}
        >
          Мои лоты
        </button>
      </div>

      {/* FILTERS (Only visible on Market tab) */}
      {activeTab === 'market' && (
        <div className="flex flex-col gap-2 p-3 bg-gray-900/50 rounded-xl border border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">
            <Filter className="w-3 h-3" /> Фильтры
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
              { id: 'price_asc', label: 'Цена ↑' },
              { id: 'price_desc', label: 'Цена ↓' },
              { id: 'ovr_desc', label: 'OVR ↓' }
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
      ) : displayListings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-xl p-8 mt-4">
          <ShieldAlert className="w-12 h-12 text-gray-600 mb-4" />
          <span className="text-sm font-black text-gray-500 uppercase tracking-widest text-center">Нет лотов</span>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-2 text-center">
            {activeTab === 'market' ? 'Измените фильтры или зайдите позже.' : 'Вы еще никого не выставили на продажу.'}
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
                    <span>Возраст: {listing.player.age}</span>
                    <span>Сезонов: {listing.player.seasons_played}</span>
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
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Цена лота</span>
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
                    Купить
                  </button>
                ) : (
                  <button 
                    onClick={() => handleCancel(listing.id)}
                    disabled={isPending}
                    className="px-4 py-2 rounded border border-red-500/50 font-black uppercase text-[10px] tracking-widest transition-all bg-red-900/20 text-red-400 hover:bg-red-600 hover:text-white disabled:opacity-50"
                  >
                    Отменить
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
