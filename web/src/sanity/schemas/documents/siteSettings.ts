import { defineArrayMember, defineField, defineType } from 'sanity';
import NavManagerInput from '@/sanity/inputs/NavManagerInput';
import { PAGE_IDS } from '../objects/announcement';
import { MAX_CUSTOM_NAV, navLinkProblem, type NavLinkValue } from '../objects/navCustom';

/** A row of siteSettings.pages: a fixed navPage or a band-made navCustom. */
interface NavRow {
  _key?: string;
  _type?: string;
  pageId?: string;
  enabled?: boolean;
  label?: string;
  link?: NavLinkValue;
}

/** "a", "a and b", "a, b and c" */
function list(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * §3.1 siteSettings — document (singleton, id `siteSettings`). Global meta,
 * SEO, announcement, theming, page/nav config, band-owned connection URLs.
 */
export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'SEO <title> base.',
      initialValue: 'Wendlo',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
      description: 'Meta / share description.',
    }),
    defineField({
      name: 'announcement',
      title: 'Announcement',
      type: 'announcement',
    }),
    defineField({
      name: 'design',
      title: 'Design',
      type: 'designSettings',
    }),
    defineField({
      name: 'pages',
      title: 'Pages & nav',
      type: 'array',
      description: `The menu row: its order (top of the list = first), which pages show, and up to ${MAX_CUSTOM_NAV} custom links of your own.`,
      components: { input: NavManagerInput },
      of: [defineArrayMember({ type: 'navPage' }), defineArrayMember({ type: 'navCustom' })],
      validation: (rule) => [
        rule.custom((value) => {
          if (!Array.isArray(value)) return true;
          const rows = value as NavRow[];
          const fixed = rows.filter((r) => r?._type !== 'navCustom');
          const custom = rows.filter((r) => r?._type === 'navCustom');
          const problems: string[] = [];

          const ids = fixed.map((p) => p?.pageId).filter(Boolean) as string[];
          const missing = PAGE_IDS.filter((id) => !ids.includes(id));
          if (missing.length) {
            problems.push(
              `The ${list(missing)} ${missing.length === 1 ? 'page is' : 'pages are'} missing from the list. Pages can be hidden, but not removed.`,
            );
          }
          const twice = PAGE_IDS.filter((id) => ids.filter((x) => x === id).length > 1);
          if (twice.length) {
            problems.push(`The ${list(twice)} ${twice.length === 1 ? 'page is' : 'pages are'} in the list more than once.`);
          }
          const extra = ids.filter((id) => !(PAGE_IDS as readonly string[]).includes(id));
          if (extra.length) {
            problems.push(`Unknown ${extra.length === 1 ? 'page' : 'pages'} in the list: ${list(extra)}.`);
          }
          const home = fixed.find((p) => p?.pageId === 'home');
          if (home && home.enabled === false) {
            problems.push('The Home page must stay switched on.');
          }

          if (custom.length > MAX_CUSTOM_NAV) {
            const over = custom.length - MAX_CUSTOM_NAV;
            problems.push(
              `The menu only has room for ${MAX_CUSTOM_NAV} custom links — please remove ${over} (you have ${custom.length}).`,
            );
          }
          for (const c of custom) {
            const name = c.label?.trim() ? `“${c.label.trim()}”` : 'A custom link';
            if (!c.label?.trim()) problems.push('A custom link needs a label (click Edit to add one).');
            const problem = navLinkProblem(c.link);
            if (problem) problems.push(`${name} needs somewhere to go — click Edit and ${problem}.`);
          }

          return problems.length ? problems.map((message) => ({ message })) : true;
        }),
        rule
          .custom((value) => {
            if (!Array.isArray(value)) return true;
            const rows = value as NavRow[];
            const hiddenPages = new Set(
              rows
                .filter((r) => r?._type !== 'navCustom' && r?.enabled === false)
                .map((r) => r.pageId ?? ''),
            );
            // Same rule as the site (lib/doodles linkAvailable): such items are left out of the menu.
            const target = (r: NavRow): string | null => {
              const kind = r.link?.kind;
              if (kind === 'page') return r.link?.page && hiddenPages.has(r.link.page) ? r.link.page : null;
              if (kind === 'email-signup' || kind === 'message') return hiddenPages.has('contact') ? 'contact' : null;
              return null;
            };
            const warnings = rows
              .filter((r) => r?._type === 'navCustom' && r.enabled !== false && target(r) !== null)
              .map((r) => {
                const why = r.link?.kind === 'page' ? '' : ' (its form is on that page)';
                return {
                  message: `“${r.label?.trim() || 'custom link'}” is left out of the menu while the ${target(r)} page is hidden${why}.`,
                };
              });
            return warnings.length ? warnings : true;
          })
          .warning(),
      ],
    }),
    defineField({
      name: 'connections',
      title: 'Connections',
      type: 'connectionSettings',
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Site settings' };
    },
  },
});
