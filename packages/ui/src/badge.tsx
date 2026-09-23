import * as React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  default: {
    badge: 'bg-slate-100 text-slate-700 ring-slate-500/10',
    dot: 'bg-slate-500',
  },
  success: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  danger: {
    badge: 'bg-red-50 text-red-700 ring-red-600/10',
    dot: 'bg-red-500',
  },
  info: {
    badge: 'bg-blue-50 text-blue-700 ring-blue-700/10',
    dot: 'bg-blue-500',
  },
  purple: {
    badge: 'bg-purple-50 text-purple-700 ring-purple-700/10',
    dot: 'bg-purple-500',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs font-medium',
};

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className = '',
  ...props
}: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-x-1.5 rounded-md font-medium ring-1 ring-inset ${styles.badge} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <svg className={`h-1.5 w-1.5 fill-current ${styles.dot}`} viewBox="0 0 6 6" aria-hidden="true">
          <circle cx="3" cy="3" r="3" />
        </svg>
      )}
      {children}
    </span>
  );
}
