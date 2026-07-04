import React, { createContext, useContext, useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

const ToastContext = createContext<{
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, "id">) => void;
  removeToast: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = (toast: Omit<ToastProps, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return {
    toast: (props: Omit<ToastProps, "id">) => context.addToast(props),
    toasts: context.toasts,
    dismiss: context.removeToast,
  };
}

export function ToastViewport() {
  const context = useContext(ToastContext);
  const toasts = context?.toasts || [];
  const dismiss = context?.removeToast || (() => {});

  return (
    <div className="fixed top-24 right-4 z-100 flex flex-col p-4 space-y-3 max-w-sm w-full pointer-events-none no-print">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  title,
  description,
  variant = "default",
  onDismiss,
}: ToastProps & { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const variants = {
    default: "bg-white/65 border-gray-200/40 text-gray-900",
    success: "bg-white/70 border-primary/25 text-gray-900 shadow-primary/5",
    destructive: "bg-white/70 border-red-500/25 text-red-950 shadow-red-500/5",
  };

  const icons = {
    default: <Info className="w-4.5 h-4.5 text-primary shrink-0 mt-0.5" />,
    success: <CheckCircle className="w-4.5 h-4.5 text-primary shrink-0 mt-0.5" />,
    destructive: <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />,
  };

  return (
    <div
      className={`flex items-start gap-3.5 p-4 rounded-2xl border pointer-events-auto backdrop-blur-xl saturate-140 transition-all duration-300 animate-in slide-in-from-right-8 fade-in ${variants[variant]}`}
      style={{
        boxShadow: "0 16px 45px -10px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.4)"
      }}
    >
      {icons[variant]}
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-extrabold text-[13px] tracking-tight text-gray-950 leading-tight">{title}</h4>}
        {description && <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{description}</p>}
      </div>
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0 mt-0.5 p-0.5 hover:bg-gray-100/50 rounded-lg">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
