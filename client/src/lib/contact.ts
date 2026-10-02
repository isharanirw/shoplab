export const CONTACT_TOPICS = [
  { value: 'order', label: 'Order or delivery' },
  { value: 'returns', label: 'Returns and refunds' },
  { value: 'product', label: 'Product question' },
  { value: 'account', label: 'Account help' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Something else' },
] as const;

export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 1000;

export interface ContactValues {
  topic: string;
  message: string;
  consent: boolean;
}

export type ContactField = keyof ContactValues;

export function validateContactField(field: ContactField, values: ContactValues): string | null {
  switch (field) {
    case 'topic':
      if (values.topic === '') return 'Choose a topic.';
      return CONTACT_TOPICS.some((t) => t.value === values.topic) ? null : 'Choose one of the listed topics.';
    case 'message': {
      const message = values.message.trim();
      if (message === '') return 'Message is required.';
      if (message.length < CONTACT_MESSAGE_MIN) return `Message must be at least ${CONTACT_MESSAGE_MIN} characters.`;
      if (message.length > CONTACT_MESSAGE_MAX) return `Message must be at most ${CONTACT_MESSAGE_MAX} characters.`;
      return null;
    }
    case 'consent':
      return values.consent ? null : 'You must agree to us storing your message so we can reply.';
  }
}

export function validateContactValues(values: ContactValues): Partial<Record<ContactField, string>> {
  const errors: Partial<Record<ContactField, string>> = {};
  for (const field of ['topic', 'message', 'consent'] as const) {
    const message = validateContactField(field, values);
    if (message) errors[field] = message;
  }
  return errors;
}
