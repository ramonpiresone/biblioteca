
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false, // Enable strict TypeScript checking
  },
  eslint: {
    ignoreDuringBuilds: false, // Enable ESLint checking during builds
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
        port: '',
        pathname: '/b/isbn/**',
      },
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
        port: '',
        pathname: '/b/id/**',
      }
    ],
  },
};

export default nextConfig;
