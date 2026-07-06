import React from "react";

export function CardSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
      <div className="animate-shimmer space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="space-y-2 mt-4">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-4/6" />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, colSpan }: { rows?: number; colSpan?: number }) {
  // If colSpan is provided, render as <tr> elements for use inside <tbody>
  if (colSpan !== undefined) {
    return (
      <>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            <td colSpan={colSpan || 6} className="p-3">
              <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
            </td>
          </tr>
        ))}
      </>
    );
  }

  // Default: render as card-style skeleton for standalone use
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
      <div className="animate-shimmer space-y-4">
        <div className="flex gap-4">
          <div className="h-3 bg-gray-200 rounded w-1/4" />
          <div className="h-3 bg-gray-200 rounded w-1/4" />
          <div className="h-3 bg-gray-200 rounded w-1/4" />
        </div>
        <div className="border-t border-gray-100 pt-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-3 bg-gray-200 rounded w-2/5" />
              <div className="h-3 bg-gray-200 rounded w-1/5" />
              <div className="h-3 bg-gray-200 rounded w-1/5" />
              <div className="h-3 bg-gray-200 rounded w-1/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs glass-card">
          <div className="animate-shimmer space-y-3">
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-6 bg-gray-200 rounded w-2/3" />
            <div className="h-2 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
      <div className="animate-shimmer space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/4" />
        <div className="flex items-end gap-2 h-40">
          {[40, 60, 80, 50, 70, 90, 45].map((h, i) => (
            <div key={i} className="flex-1 bg-gray-200 rounded-t-md" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0">
      <div className="animate-shimmer">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
      <StatsSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <CardSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}

export function ListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="space-y-2 animate-shimmer">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
          <div className="size-10 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-2 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
