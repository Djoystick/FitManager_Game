'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MarketListing {
  id: string;
  price_ton: number;
  created_at: string;
  player: {
    id: string;
    name: string;
    age: number;
    ovr: number;
    perks: any;
  };
}

export default function TransferMarketPage() {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch('/api/market/active');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setListings(data.listings);
          }
        }
      } catch (error) {
        console.error("Failed to fetch market listings", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMarket();
  }, []);

  const handleBuy = (id: string) => {
    setBuyingId(id);
    // MVP Mock execution: real execution happens via TON smart contract bridging in V2
    setTimeout(() => {
      alert("TON Smart Contract bridge connecting... (Integration coming in V2 Roadmap!)");
      setBuyingId(null);
    }, 1000);
  };

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 min-h-screen bg-space-dark text-white">
      {/* HEADER */}
      <header className="border-b border-gray-800 pb-4">
        <Link href="/" className="text-xs text-neon-cyan hover:underline mb-2 inline-block">&larr; Dashboard</Link>
        <h1 className="text-3xl font-black uppercase tracking-tighter">P2P <span className="text-neon-cyan">Market</span></h1>
        <p className="text-sm text-gray-400 mt-1">Acquire elite athletes directly via The Open Network.</p>
      </header>

      {/* LISTINGS FEED */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : listings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-xl p-8">
          <span className="text-xl font-black text-neon-pink drop-shadow-[0_0_10px_rgba(255,0,60,0.8)] uppercase tracking-widest text-center">No Active Listings</span>
          <p className="text-gray-500 text-xs mt-2 text-center">The transfer window is currently dead silent.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-10">
          {listings.map((listing) => (
            <div key={listing.id} className="bg-black/60 border border-neon-cyan/40 p-4 rounded-xl flex flex-col gap-3 shadow-[0_0_15px_rgba(0,240,255,0.05)] hover:border-neon-cyan hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white">{listing.player.name}</h3>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Age {listing.player.age}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">OVR</span>
                  <span className="text-2xl font-black text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]">{listing.player.ovr}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2 border-t border-gray-800 pt-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">Price</span>
                  <span className="text-lg font-bold text-white flex items-center gap-1">
                    <span className="text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)]">💎</span> {listing.price_ton} TON
                  </span>
                </div>
                
                <button 
                  onClick={() => handleBuy(listing.id)}
                  disabled={buyingId === listing.id}
                  className={`px-4 py-2 rounded font-black uppercase text-xs tracking-wider transition-all ${
                    buyingId === listing.id
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-neon-cyan text-black hover:bg-white shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                  }`}
                >
                  {buyingId === listing.id ? 'Connecting Web3...' : 'Buy with TON'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
