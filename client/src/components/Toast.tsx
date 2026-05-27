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
    <div className="fixed bottom-4 right-4 z-100 flex flex-col p-4 space-y-3 max-w-sm w-full pointer-events-none">
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
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const variants = {
    default: "bg-white/90 border-gray-200 text-gray-900 shadow-lg",
    success: "bg-white/95 border-green-100 text-green-900 shadow-green-500/5 shadow-lg",
    destructive: "bg-white/95 border-red-100 text-red-900 shadow-red-500/5 shadow-lg",
  };

  const icons = {
    default: <Info className="w-5 h-5 text-primary shrink-0" />,
    success: <CheckCircle className="w-5 h-5 text-primary shrink-0" />,
    destructive: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border pointer-events-auto transition-all duration-300 animate-in slide-in-from-bottom-2 ${variants[variant]} glass`}
      style={{ boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.08)" }}
    >
      {icons[variant]}
      <div className="flex-1">
        {title && <h4 className="font-bold text-sm tracking-tight text-gray-950">{title}</h4>}
        {description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>}
      </div>
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
