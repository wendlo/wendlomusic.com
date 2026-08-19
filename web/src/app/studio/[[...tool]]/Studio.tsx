'use client';

/**
 * Client boundary for the embedded Sanity Studio.
 *
 * The `sanity` package (and its transitive `swr` default import) must only be
 * evaluated in the CLIENT module graph — under Turbopack's `react-server`
 * condition, `swr` resolves to a build with no default export and the build
 * fails. Importing `sanity.config` here (inside a 'use client' module) instead
 * of in the server `page.tsx` keeps the whole Studio bundle out of the RSC
 * graph.
 */
import { NextStudio } from 'next-sanity/studio';

import config from '../../../../sanity.config';

export default function Studio() {
  return <NextStudio config={config} />;
}
