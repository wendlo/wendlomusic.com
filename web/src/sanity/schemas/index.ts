/**
 * Flat list of every Sanity schema type for the Wendlo content model.
 * Consumed by sanity.config.ts as `schema: { types: schemaTypes }`.
 */
import type { SchemaTypeDefinition } from 'sanity';

// Documents
import { siteSettings } from './documents/siteSettings';
import { homePage } from './documents/homePage';
import { aboutPage } from './documents/aboutPage';
import { tourPage } from './documents/tourPage';
import { musicPage } from './documents/musicPage';
import { contactPage } from './documents/contactPage';
import { blogPage } from './documents/blogPage';
import { blogPost } from './documents/blogPost';

// Objects
import { announcement } from './objects/announcement';
import { designSettings } from './objects/designSettings';
import { navPage } from './objects/navPage';
import { connectionSettings } from './objects/connectionSettings';
import { shopifySettings } from './objects/shopifySettings';
import { bandsintownSettings } from './objects/bandsintownSettings';
import { googleForm } from './objects/googleForm';
import { heroImage } from './objects/heroImage';
import { songEntry } from './objects/songEntry';
import { youtubeEntry } from './objects/youtubeEntry';
import { listenLink } from './objects/listenLink';
import { ctaButton } from './objects/ctaButton';
import { licensing } from './objects/licensing';
import { socialLink } from './objects/socialLink';
import { contactForm } from './objects/contactForm';
import { formField } from './objects/formField';

export const schemaTypes: SchemaTypeDefinition[] = [
  // Documents
  siteSettings,
  homePage,
  aboutPage,
  tourPage,
  musicPage,
  contactPage,
  blogPage,
  blogPost,
  // Objects
  announcement,
  designSettings,
  navPage,
  connectionSettings,
  shopifySettings,
  bandsintownSettings,
  googleForm,
  heroImage,
  songEntry,
  youtubeEntry,
  listenLink,
  ctaButton,
  licensing,
  socialLink,
  contactForm,
  formField,
];
