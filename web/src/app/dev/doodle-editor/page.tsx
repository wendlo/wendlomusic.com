/**
 * Dev-only sandbox for the home-doodle visual editor (no Sanity login):
 * http://localhost:3000/dev/doodle-editor. 404 in production builds.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
// also imported by the root layout; kept so the sandbox never depends on it
import '@/styles/doodles.css';
import { DoodleEditorSandbox } from './DoodleEditorSandbox';

export const metadata: Metadata = {
  title: 'Doodle editor sandbox',
  robots: { index: false, follow: false },
};

export default function DoodleEditorSandboxPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DoodleEditorSandbox />;
}
