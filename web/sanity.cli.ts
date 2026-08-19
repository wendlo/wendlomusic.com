/**
 * Sanity CLI config — used by `sanity` CLI commands (deploy, dataset, etc.).
 * projectId/dataset come from env; a placeholder keeps import safe when unset
 * (CLI commands that actually need a real project will fail loudly on their
 * own, which is the desired behaviour for the CLI).
 */
import { defineCliConfig } from 'sanity/cli';

import { dataset, safeProjectId } from './src/sanity/env';

export default defineCliConfig({
  api: {
    projectId: safeProjectId,
    dataset,
  },
});
