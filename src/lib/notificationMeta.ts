import type { NotificationKind } from '@/types/db';

export interface NotificationMeta { text: string; to: string }

export const NOTIFICATION_META: Record<NotificationKind, NotificationMeta> = {
  connection_request: { text: 'sent you a connection request', to: '/requests' },
  connection_accepted: { text: 'accepted your request. You can chat now!', to: '/chat' },
  teammate_invite: { text: 'invited you to join their team', to: '/teammates' },
  senior_question: { text: 'asked you a question', to: '/seniors' },
  senior_answer: { text: 'answered your question', to: '/seniors' },
};
