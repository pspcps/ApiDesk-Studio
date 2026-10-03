import React from 'react';
import { HttpMethod } from '../types';

interface MethodBadgeProps {
  method: HttpMethod;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const METHOD_COLORS: Record<HttpMethod, { text: string; bg: string; border: string; activeBg: string }> = {
  GET: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    activeBg: 'bg-emerald-500 text-slate-950 font-bold'
  },
  POST: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    activeBg: 'bg-amber-500 text-slate-950 font-bold'
  },
  PUT: {
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    activeBg: 'bg-sky-500 text-slate-950 font-bold'
  },
  PATCH: {
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    activeBg: 'bg-purple-500 text-slate-950 font-bold'
  },
  DELETE: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    activeBg: 'bg-rose-500 text-slate-950 font-bold'
  },
  HEAD: {
    text: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    activeBg: 'bg-teal-500 text-slate-950 font-bold'
  },
  OPTIONS: {
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    activeBg: 'bg-indigo-500 text-slate-950 font-bold'
  }
};

export const MethodBadge: React.FC<MethodBadgeProps> = ({ method, size = 'sm', className = '' }) => {
  const color = METHOD_COLORS[method] || METHOD_COLORS.GET;
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 font-mono font-semibold tracking-wider',
    md: 'text-xs px-2 py-1 font-mono font-bold tracking-wide',
    lg: 'text-sm px-3 py-1.5 font-mono font-bold tracking-wide'
  }[size];

  return (
    <span
      className={`inline-flex items-center justify-center rounded border whitespace-nowrap select-none ${color.bg} ${color.text} ${color.border} ${sizeClasses} ${className}`}
    >
      {method}
    </span>
  );
};
