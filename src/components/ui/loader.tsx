
"use client";

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  className?: string;
  size?: number;
}

export function Loader({ className, size = 24 }: LoaderProps) {
  return (
    <div className={cn("flex justify-center items-center", className)}>
      <Loader2 className="animate-spin text-primary" size={size} />
    </div>
  );
}
