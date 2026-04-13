export default function SEO({ title, description, schema }) {
  const siteName = "Fundetec Academy";
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const fullDesc = description || "Plataforma líder en educación virtual con contenido premium y seguimiento personalizado.";

  return (
    <>
      {/* Standard Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={fullDesc} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="utf-8" />

      {/* OpenGraph - Optimized for Social & AI Engines */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDesc} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="es_ES" />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDesc} />

      {/* GEO (Generative Engine Optimization) Structured Data */}
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}
      
      {/* Default Organization Schema for every page */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            "name": siteName,
            "url": "https://fundetec-academy.vercel.app",
            "logo": "https://fundetec-academy.vercel.app/logo.png",
            "description": fullDesc,
            "sameAs": [
              "https://facebook.com/fundetec",
              "https://instagram.com/fundetec"
            ]
          })
        }}
      />
    </>
  );
}
