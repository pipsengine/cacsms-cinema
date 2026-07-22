import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      { source: '/scripts', destination: '/visuals/discover/script-interpretation', permanent: false },
      { source: '/qa', destination: '/visuals/quality/evidence', permanent: false },
      { source: '/video', destination: '/visuals/delivery/video-readiness', permanent: false },
      { source: '/library/assets', destination: '/visuals/delivery/approved-assets', permanent: false },
      { source: '/storyboards', destination: '/storyboard/storyboard-editor', permanent: false },
      { source: '/storyboards/:path*', destination: '/storyboard/storyboard-editor', permanent: false },
    ];
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
