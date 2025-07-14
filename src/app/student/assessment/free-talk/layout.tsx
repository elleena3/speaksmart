
// This file is no longer necessary as we handle loading states inside the page component.
// It can be deleted, but for now we'll just return the children.
export default function FreeTalkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
