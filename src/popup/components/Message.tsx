import type { FC } from 'react';
import type { MessageState } from '../hooks/useMessage.js';

interface MessageProps {
  message: MessageState | null;
}

export const Message: FC<MessageProps> = ({ message }) => (
  <section
    id="message"
    className="message"
    aria-live="polite"
    hidden={!message}
    style={message?.isError ? { color: 'var(--danger)' } : undefined}
  >
    {message?.text ?? ''}
  </section>
);
