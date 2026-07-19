import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Alfred — Tu agente para simplificar tu vida",
  description: "Tu agente para simplificar tu vida",
  icons: { icon: "/alfred-favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>
          <TooltipProvider>
            <AuthGate>{children}</AuthGate>
          </TooltipProvider>
          <Toaster
            position="bottom-right"
            theme="dark"
            richColors
            closeButton
          />
        </AuthProvider>
      </body>
    </html>
  );
}
