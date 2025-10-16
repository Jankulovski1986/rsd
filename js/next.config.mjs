// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (process.env.USE_MOCK === '1') {
      return {
        // WICHTIG: nur die GET-Liste mocken (erkennbar an Query "limit");
        // POST/PATCH/DELETE sollen zur echten API gehen, sonst 405.
        beforeFiles: [
          {
            source: '/api/ausschreibungen',
            has: [{ type: 'query', key: 'limit' }],
            destination: '/mock/ausschreibungen.json',
          },
          { source: '/api/kpis',     destination: '/mock/kpis.json' },
          { source: '/api/by_month', destination: '/mock/by_month.json' },
        ],
        afterFiles: [],
        fallback: [],
      };
    }
    return { beforeFiles: [], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
