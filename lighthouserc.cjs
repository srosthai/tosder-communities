module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run build && PORT=4322 npm run start',
      startServerReadyPattern: 'Server listening',
      startServerReadyTimeout: 30_000,
      url: [
        'http://127.0.0.1:4322/',
        'http://127.0.0.1:4322/explore',
        'http://127.0.0.1:4322/destinations/angkor-wat',
        'http://127.0.0.1:4322/design?theme=light',
        'http://127.0.0.1:4322/admin',
      ],
      numberOfRuns: 1,
      settings: {
        chromeFlags: '--headless=new --no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
