'use client';

import Image from 'next/image';
import { useState } from 'react';
import { tickerInitials } from '@/lib/market/format';

type StockLogoProps = {
  logoUrl: string | null;
  ticker: string;
  alt?: string;
  size?: 'small' | 'large';
};

export default function StockLogo({
  logoUrl,
  ticker,
  alt = '',
  size = 'small',
}: StockLogoProps) {
  const [failed, setFailed] = useState(false);
  const dimension = size === 'large' ? 56 : 32;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dce6f7] bg-white ${
        size === 'large' ? 'h-14 w-14' : 'h-8 w-8'
      }`}
      data-testid={`stock-logo-${ticker}`}
    >
      {logoUrl && !failed ? (
        <Image
          src={logoUrl}
          alt={alt}
          width={dimension}
          height={dimension}
          sizes={`${dimension}px`}
          className="h-full w-full object-contain p-1"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden={alt ? undefined : true}
          aria-label={alt || undefined}
          role={alt ? 'img' : undefined}
          className="text-xs font-extrabold tracking-wide text-[#1d4ed8]"
        >
          {tickerInitials(ticker)}
        </span>
      )}
    </span>
  );
}
