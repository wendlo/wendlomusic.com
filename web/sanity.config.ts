/**
 * Sanity Studio config, embedded at /studio.
 *
 * INVARIANT: this module must import without throwing when no Sanity project is
 * configured. `safeProjectId` guarantees a non-empty projectId so
 * `defineConfig` never blows up; the Studio route + read layer gate on
 * `isSanityConfigured` before anything live runs.
 *
 * Phase-5 scope: schema + structureTool + presentationTool (live preview via
 * /api/draft-mode/enable) + visionTool + custom inputs + the 'publish-all'
 * tool ("Publish site"). None of these read env at import beyond the guarded
 * constants below, so the unconfigured placeholder path is unchanged.
 */
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import {
  defineDocuments,
  defineLocations,
  presentationTool,
} from 'sanity/presentation';
import { visionTool } from '@sanity/vision';

import { schemaTypes } from './src/sanity/schemas';
import { structure } from './src/sanity/structure';
import { publishAllTool } from './src/sanity/actions/PublishAllChanged';
import { apiVersion, dataset, safeProjectId } from './src/sanity/env';

/**
 * One fixed document each, with _id === type name (see structure.ts). They
 * must never be created anew, duplicated or deleted — the site reads them by id.
 */
const SINGLETON_TYPES = new Set([
  'siteSettings',
  'homePage',
  'aboutPage',
  'tourPage',
  'musicPage',
  'contactPage',
  'blogPage',
]);

const SINGLETON_BLOCKED_ACTIONS = new Set(['delete', 'duplicate']);

/** The whole site is one page ('/'); rooms are hash routes on it. */
const HOME_LOCATION = defineLocations({
  locations: [{ title: 'Home page', href: '/' }],
});

export default defineConfig({
  name: 'wendlo',
  title: 'Wendlo',
  basePath: '/studio',
  projectId: safeProjectId,
  dataset,
  schema: {
    types: schemaTypes,
  },
  document: {
    // Hide the singletons from the global "Create" (+) menu.
    newDocumentOptions: (prev, { creationContext }) =>
      creationContext.type === 'global'
        ? prev.filter((item) => !SINGLETON_TYPES.has(item.templateId))
        : prev,
    actions: (prev, { schemaType }) =>
      SINGLETON_TYPES.has(schemaType)
        ? prev.filter(
            ({ action }) => !action || !SINGLETON_BLOCKED_ACTIONS.has(action),
          )
        : prev,
  },
  plugins: [
    structureTool({ structure }),
    presentationTool({
      // Same-origin preview (Studio is embedded at /studio on the site
      // itself); the enable route turns on Next draft mode for the iframe.
      previewUrl: {
        preview: '/',
        previewMode: { enable: '/api/draft-mode/enable' },
      },
      resolve: {
        // Opening the preview at '/' opens the Home document beside it, so
        // edits made there refresh the preview (see PreviewVisualEditing).
        mainDocuments: defineDocuments([
          { route: '/', filter: `_id == "homePage"` },
        ]),
        // "Used on: Home page" link in the document editor → Presentation.
        locations: {
          homePage: HOME_LOCATION,
          siteSettings: HOME_LOCATION,
        },
      },
    }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
  tools: [publishAllTool],
});
