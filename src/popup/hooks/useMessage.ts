import { useState, useRef, useCallback, useEffect } from 'react';

export interface MessageState {
  text: string;
  isError: boolean;
}

export function useMessage() {
  const [message, setMessage] = useState<MessageState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showMessage = useCallback((text: string, duration = 5000, isError = false) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage({ text, isError });
    timerRef.current = setTimeout(() => setMessage(null), duration);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { message, showMessage };
}
