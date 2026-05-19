import type { CSSProperties } from 'react';
import spearPhotoRotated from './assets/spear-photo-rotated.jpg';

/** Spear photo as a soft, semi-transparent full-page background (tint overlay for readability). */
export const spearPhotoRotatedPageStyle: CSSProperties = {
  backgroundImage: `linear-gradient(
      rgba(227, 242, 247, 0.5),
      rgba(236, 248, 251, 0.74)
    ),
    url(${spearPhotoRotated})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
};
