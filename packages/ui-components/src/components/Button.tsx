import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'icon' | 'browse';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50 disabled:pointer-events-none shadow-sm",
          {
            "bg-gradient-to-b from-accent to-[#C48C2B] text-black hover:brightness-110 px-4 py-2": variant === 'primary',
            "bg-transparent border border-border/60 text-primaryText hover:bg-surface px-4 py-2": variant === 'secondary',
            "bg-surface border border-border/60 text-primaryText hover:bg-border/80 px-4 py-2": variant === 'browse',
            "w-8 h-8 hover:text-accent text-secondaryText rounded-md hover:bg-surface shadow-none": variant === 'icon'
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
