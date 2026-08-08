import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

// Notifications éphémères (remplacent les alert() natifs, hors charte). Un provider global expose
// `useToast()` : toast(message, variant?). Auto-disparition après quelques secondes, empilables.

type Variant = 'success' | 'danger' | 'info' | 'warning';
type Item = { id: number; msg: string; variant: Variant };

const ToastCtx = createContext<(msg: string, variant?: Variant) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const drop = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((msg: string, variant: Variant = 'success') => {
    const id = ++seq;
    setItems((xs) => [...xs, { id, msg, variant }]);
    setTimeout(() => drop(id), variant === 'danger' ? 8000 : 5000);
  }, [drop]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 1100 }}>
        {items.map((it) => (
          <Toast key={it.id} bg={it.variant} onClose={() => drop(it.id)} role="status">
            <Toast.Body className={it.variant === 'warning' ? 'text-dark' : 'text-white'} style={{ whiteSpace: 'pre-wrap' }}>
              {it.msg}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastCtx.Provider>
  );
}
