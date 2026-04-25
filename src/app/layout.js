import "./globals.css";

import { supabase } from "@/lib/supabase";
import { NotificationProvider } from "@/context/NotificationContext";

export async function generateMetadata() {
  try {
    const { data, error } = await supabase.from('landing_sections').select('*').eq('slug', 'branding').single();
    if (error || !data) throw new Error("Metadata source missing");
    
    const branding = data?.content || {};
    return {
      title: branding.site_name || "Fundetec Academy | Excelencia en Educación Virtual",
      description: "Plataforma líder en educación virtual con contenido premium, evaluaciones y seguimiento personalizado.",
      icons: {
        icon: branding.favicon_url || "/favicon.ico",
      },
      manifest: "/manifest.json",
      appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Fundetec Academy",
      },
    };
  } catch (err) {
    return {
      title: "Fundetec Academy | Excelencia en Educación Virtual",
      description: "Plataforma líder en educación virtual.",
      icons: {
        icon: "/favicon.ico",
      },
      manifest: "/manifest.json",
    };
  }
}

export const viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: 0,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body suppressHydrationWarning>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
