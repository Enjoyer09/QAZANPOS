import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export interface POSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'md' | 'lg' | 'touch-pos';
  isLoading?: boolean;
}

export const POSButton: React.FC<POSButtonProps> = ({
  children,
  variant = 'primary',
  size = 'touch-pos',
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold select-none rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2';

  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/20',
    secondary: 'bg-slate-800 text-white hover:bg-slate-700 active:bg-slate-900',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800',
    outline: 'border-2 border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-white'
  };

  const sizes = {
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    'touch-pos': 'h-14 min-w-[120px] px-6 text-lg font-bold shadow-lg'
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block animate-spin mr-2">⏳</span>
      ) : null}
      {children}
    </button>
  );
};
