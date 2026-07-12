import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FACEIT CS2 Stats Compare",
    template: "%s",
  },
  description: "Compare lifetime CS2 statistics for FACEIT players.",
  openGraph: {
    title: "FACEIT CS2 Stats Compare",
    description: "Compare lifetime CS2 statistics for FACEIT players.",
    siteName: "FACEIT CS2 Stats Compare",
    type: "website",
  },
};

const themeScript = `
(() => {
  try {
    const theme = localStorage.getItem("theme");
    document.documentElement.classList.toggle("dark", theme !== "light");
  } catch {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-[var(--bg)] text-[var(--text)]">
        {children}
      </body>
    </html>
  );
}
