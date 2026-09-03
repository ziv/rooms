import "./globals.css";

// The html/body tags live in app/[locale]/layout.tsx so lang/dir can follow the locale.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
