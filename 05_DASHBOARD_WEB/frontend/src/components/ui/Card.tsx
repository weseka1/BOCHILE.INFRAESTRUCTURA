import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function Card({ children, className, title, subtitle, action }: CardProps) {
  return (
    <div className={cn('card p-5', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between mb-4 pb-3 border-b border-border-subtle">
          <div>
            {title && (
              <h3 className="font-display text-base font-semibold text-text">
                <span className="text-accent mr-2">·</span>
                {title}
              </h3>
            )}
            {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
