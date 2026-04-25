/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'ihcdtqrphvxgtverrrst.supabase.co' },
      { protocol: 'https', hostname: 'i.pravatar.cc' }
    ]
  }
};

export default nextConfig;
