import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'shoplab-stars': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
        count?: string;
        'show-count'?: string;
      };
    }
  }
}
