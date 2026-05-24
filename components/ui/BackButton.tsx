import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export function BackButton() {
  return (
    <Link 
      href="/" 
      className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4 font-bold"
    >
      <ChevronLeft size={16} />
      На Главную
    </Link>
  );
}
