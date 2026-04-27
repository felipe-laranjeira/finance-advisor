'use client';

import React from 'react';
import { useMask } from '@/components/MaskProvider';
import { formatCurrency } from '@/lib/utils';

interface MaskedValueProps {
  value: number;
  prefix?: string;
  className?: string;
}

export function MaskedValue({ value, prefix, className }: MaskedValueProps) {
  const { isMasked } = useMask();

  if (isMasked) {
    return <span className={className}>••••••</span>;
  }

  return (
    <span className={className}>
      {formatCurrency(value)}
    </span>
  );
}
