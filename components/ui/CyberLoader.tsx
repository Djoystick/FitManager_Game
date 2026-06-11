import React from 'react';

export function CyberLoader({ fullScreen = false, text = 'LOADING...' }: { fullScreen?: boolean, text?: string }) {
  const loaderContent = (
    <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in duration-300">
      <style>{`
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-slow-custom {
          animation: spin 3s linear infinite;
        }
        .animate-spin-reverse-fast-custom {
          animation: spin-reverse 1.5s linear infinite;
        }
      `}</style>
      
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute w-full h-full border-2 border-t-transparent border-neon-cyan rounded-full animate-spin-slow-custom opacity-80 shadow-[0_0_15px_rgba(0,240,255,0.4)]"></div>
        <div className="absolute w-3/4 h-3/4 border-2 border-b-transparent border-neon-pink rounded-full animate-spin-reverse-fast-custom opacity-60"></div>
        <div className="absolute w-1/2 h-1/2 border-2 border-l-transparent border-white rounded-full animate-spin opacity-90"></div>
        <div className="font-mono text-[10px] text-neon-cyan font-bold tracking-widest animate-pulse drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]">0101</div>
      </div>
      
      {text && (
        <div className="text-[10px] uppercase font-mono tracking-widest text-neon-cyan/70 animate-pulse drop-shadow-[0_0_5px_rgba(0,240,255,0.3)]">
          {text}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div 
        className="fixed inset-0 z-[999] flex flex-col items-center justify-end pb-12 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/loading_bg.jpg')" }}
      >
        <div className="bg-black/40 backdrop-blur-sm px-8 py-4 rounded-3xl border border-white/5 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          {loaderContent}
        </div>
      </div>
    );
  }

  return loaderContent;
}
