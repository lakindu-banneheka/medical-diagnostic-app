import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Medical Diagnostic App",
  description: "Record or upload audio for medical diagnosis",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon-32x32.png",

  },
  authors: [
    {
      name: "Lakindu Banneheka",
      url: "https://lakindu-banneheka.vercel.app/"
    }
  ],
  keywords: [
    "medical",
    "diagnosis",
    "audio",
    "recording",
    "upload",
    "healthcare",
    "AI"
  ],
  openGraph: {
    title: "Medical Diagnostic App",
    description: "Record or upload audio for medical diagnosis",
    url: "https://medical-diagnostic-app.vercel.app/",
    siteName: "Medical Diagnostic App",
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Favicons for all environments */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon-32x32.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
