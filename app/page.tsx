import Image from "next/image";

export default function Home() {
  return (
    <section 
      aria-label="Initialization Screen"
      className="flex flex-col flex-1 items-center justify-center min-h-screen"
    >
      <header className="text-center">
        <h1 className="text-neon-cyan tracking-widest text-2xl font-bold uppercase">
          FITMANAGER TMA INITIALIZED
        </h1>
      </header>
    </section>
  );
}
