import type { Metadata } from "next";
import "./globals.css";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Physics Lab",
  description: "Interactive physics lessons and simulations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <nav className="bg-gray-800">
          <div className="container mx-auto flex items-center justify-between px-4 py-3">
            <Link href="/" className="text-white text-lg font-bold">
              Physics Lab
            </Link>
            <div className="space-x-4">
              <Link href="/lessons" passHref>
                <Button variant="link" className="text-white">Lessons</Button>
              </Link>
              <Link href="/simulator" passHref>
                <Button variant="link" className="text-white">Simulator</Button>
              </Link>
              <Link href="/editor" passHref>
                <Button variant="link" className="text-white">Editor</Button>
              </Link>
              <Link href="/profile" passHref>
                <Button variant="link" className="text-white">Profile</Button>
              </Link>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
