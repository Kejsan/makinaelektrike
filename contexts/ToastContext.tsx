import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import { XCircle, CheckCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: number) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
    const timeoutId = setTimeout(() => {
      removeToast(id);
    }, 5000);
    return () => clearTimeout(timeoutId);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) return null;

  const icons = {
    success: <CheckCircle className="text-green-400" size={20} />,
    error: <XCircle className="text-red-400" size={20} />,
    info: <Info className="text-blue-400" size={20} />,
  };

  const borderColors = {
    success: 'border-green-500/50',
    error: 'border-red-500/50',
    info: 'border-blue-500/50'
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-3">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`bg-gray-900/80 backdrop-blur-lg border ${borderColors[toast.type]} text-white rounded-lg shadow-2xl p-4 flex items-center space-x-3 w-80`}
        >
          <div className="flex-shrink-0">{icons[toast.type]}</div>
          <div className="flex-1 text-sm">{toast.message}</div>
          <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-white">
            <XCircle size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
