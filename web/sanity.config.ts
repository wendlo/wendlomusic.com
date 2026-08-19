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
import { presentationTool } from 'sanity/presentation';
import { visionTool } from '@sanity/vision';

import { schemaTypes } from './src/sanity/schemas';
import { structure } from './src/sanity/structure';
import { publishAllTool } from './src/sanity/actions/PublishAllChanged';
import { apiVersion, dataset, safeProjectId } from './src/sanity/env';

export default defineConfig({
  name: 'wendlo',
  title: 'Wendlo',
  basePath: '/studio',
  projectId: safeProjectId,
  dataset,
  schema: {
    types: schemaTypes,
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
    }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
  tools: [publishAllTool],
});
