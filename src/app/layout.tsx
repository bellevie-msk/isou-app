import type { Metadata } from "next";
import "./globals.css";

export const metadata = {
  title: "走行距離記録アプリ",
  description: "車両の走行距離を記録する簡易アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="font-sans">{children}</body>
    </html>
  );
}
