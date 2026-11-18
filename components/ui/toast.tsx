/**
 * Toast notification component
 * Simple, accessible toast notifications
 */

'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, options?: Partial<Omit<Toast, 'id' | 'message'>>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  const addToast = useCallback((
    message: string,
    options?: Partial<Omit<Toast, 'id' | 'message'>>
  ) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = {
      id,
      message,
      type: options?.type || 'info',
      description: options?.description,
      duration: options?.duration || 5000,
    };
    
    setToasts(prev => [...prev, toast]);
    
    // Auto remove after duration
    setTimeout(() => {
      removeToast(id);
    }, toast.duration);
  }, [removeToast]);
  
  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  
  return {
    toast: context.addToast,
    success: (message: string, description?: string) => 
      context.addToast(message, { type: 'success', description }),
    error: (message: string, description?: string) => 
      context.addToast(message, { type: 'error', description }),
    warning: (message: string, description?: string) => 
      context.addToast(message, { type: 'warning', description }),
    info: (message: string, description?: string) => 
      context.addToast(message, { type: 'info', description }),
  };
}

function ToastContainer({ 
  toasts, 
  onRemove 
}: { 
  toasts: Toast[]; 
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  
  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ 
  toast, 
  onRemove 
}: { 
  toast: Toast; 
  onRemove: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  
  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  };
  
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  };
  
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
  };
  
  return (
    <div
      className={`
        ${colors[toast.type]}
        border rounded-lg p-4 shadow-lg
        transition-all duration-200
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-lg font-bold">{icons[toast.type]}</span>
          <div className="flex-1">
            <p className="font-semibold">{toast.message}</p>
            {toast.description && (
              <p className="text-sm mt-1 opacity-80">{toast.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleRemove}
          className="text-lg leading-none opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
