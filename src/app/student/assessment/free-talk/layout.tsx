
import { Suspense } from 'react';

// This layout wraps the page with a Suspense boundary,
// which is required when a page uses useSearchParams().
export default function FreeTalkLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>;
}
