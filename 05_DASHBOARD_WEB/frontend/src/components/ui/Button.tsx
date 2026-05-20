import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2',
        variant === 'primary' && 'bg-accent text-accent-fg hover:opacity-90',
        variant === 'ghost' && 'bg-surface-2 text-text hover:bg-surface-3',
        variant === 'outline' && 'border border-border text-text hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
