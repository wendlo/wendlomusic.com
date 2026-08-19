/**
 * Studio desk structure.
 *
 * The 7 singletons (siteSettings + the 6 page docs) are rendered as single,
 * un-listed documents (there is exactly one of each, id === type name). blogPost
 * stays a normal document list (one document per post).
 *
 * Exported as `structure` and passed to `structureTool({ structure })`.
 */
import type { StructureResolver } from 'sanity/structure';

/** Document types that are edited as a single fixed document (id === type). */
const SINGLETONS: Array<{ type: string; title: string }> = [
  { type: 'siteSettings', title: 'Site settings' },
  { type: 'homePage', title: 'Home' },
  { type: 'aboutPage', title: 'About' },
  { type: 'tourPage', title: 'Tour' },
  { type: 'musicPage', title: 'Music' },
  { type: 'contactPage', title: 'Contact' },
  { type: 'blogPage', title: 'Blog page' },
];

const SINGLETON_TYPES = new Set(SINGLETONS.map((s) => s.type));

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      ...SINGLETONS.map(({ type, title }) =>
        S.listItem()
          .id(type)
          .title(title)
          .child(S.document().schemaType(type).documentId(type)),
      ),
      S.divider(),
      S.documentTypeListItem('blogPost').title('Blog posts'),
      // Any future document types show up automatically, minus the singletons.
      ...S.documentTypeListItems().filter(
        (item) =>
          !SINGLETON_TYPES.has(item.getId() ?? '') &&
          item.getId() !== 'blogPost',
      ),
    ]);
