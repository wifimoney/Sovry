/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname, // Set root to frontend directory explicitly
  },
  // Ignore parent directory lockfiles to prevent warnings
  // This is a monorepo with backend/ and frontend/ structure
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    
    // Handle Dynamic dependencies properly
    config.externals = config.externals || [];
    if (!isServer) {
      // Exclude Node.js specific modules from client bundle
      const nodeModules = [
        'pino',
        'pino-pretty', 
        'pino-std-serializers',
        'thread-stream',
        'why-is-node-running',
        'tape',
        'fs-extra',
        'mkdirp'
      ];
      
      nodeModules.forEach(module => {
        config.resolve.alias = {
          ...config.resolve.alias,
          [module]: false
        };
      });
    }
    
    return config;
  },
  transpilePackages: ['@dynamic-labs'],
};

module.exports = nextConfig;
