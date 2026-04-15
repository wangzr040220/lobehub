export const getAnalyticsConfig = () => {
  return {
    // Plausible Analytics
    ENABLED_PLAUSIBLE_ANALYTICS: !!process.env.PLAUSIBLE_DOMAIN,
    PLAUSIBLE_DOMAIN: process.env.PLAUSIBLE_DOMAIN as string | undefined,
    PLAUSIBLE_SCRIPT_BASE_URL: process.env.PLAUSIBLE_SCRIPT_BASE_URL || 'https://plausible.io',

    // Posthog Analytics
    ENABLED_POSTHOG_ANALYTICS: !!process.env.POSTHOG_KEY,
    POSTHOG_KEY: process.env.POSTHOG_KEY as string | undefined,
    POSTHOG_HOST: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    DEBUG_POSTHOG_ANALYTICS: process.env.DEBUG_POSTHOG_ANALYTICS === '1',

    // Umami Analytics
    ENABLED_UMAMI_ANALYTICS: !!process.env.UMAMI_WEBSITE_ID,
    UMAMI_SCRIPT_URL: process.env.UMAMI_SCRIPT_URL || 'https://analytics.umami.is/script.js',
    UMAMI_WEBSITE_ID: process.env.UMAMI_WEBSITE_ID as string | undefined,

    // Clarity Analytics
    ENABLED_CLARITY_ANALYTICS: !!process.env.CLARITY_PROJECT_ID,
    CLARITY_PROJECT_ID: process.env.CLARITY_PROJECT_ID as string | undefined,

    // Vercel Analytics
    ENABLE_VERCEL_ANALYTICS: process.env.ENABLE_VERCEL_ANALYTICS === '1',
    DEBUG_VERCEL_ANALYTICS: process.env.DEBUG_VERCEL_ANALYTICS === '1',

    // Google Analytics
    ENABLE_GOOGLE_ANALYTICS: !!process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID,
    GOOGLE_ANALYTICS_MEASUREMENT_ID: process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID as
      | string
      | undefined,

    // React Scan Monitor
    // https://dashboard.react-scan.com
    REACT_SCAN_MONITOR_API_KEY: process.env.REACT_SCAN_MONITOR_API_KEY as string | undefined,
  };
};

export const analyticsEnv = getAnalyticsConfig();
