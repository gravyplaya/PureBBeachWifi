function getEnv(key: string): string {
  return process.env[key] || "";
}

export const env = {
  mikrotik: {
    apiUrl: getEnv("MIKROTIK_API_URL"),
    user: getEnv("MIKROTIK_API_USER"),
    pass: getEnv("MIKROTIK_API_PASS"),
  },
  stripe: {
    secretKey: getEnv("STRIPE_SECRET_KEY"),
    webhookSecret: getEnv("STRIPE_WEBHOOK_SECRET"),
  },
  database: {
    url: getEnv("DATABASE_URL"),
  },
  auth: {
    jwtSecret: getEnv("AUTH_JWT_SECRET"),
    adminEmail: getEnv("ADMIN_EMAIL"),
    adminPasswordHash: getEnv("ADMIN_PASSWORD_HASH"),
  },
  portal: {
    url: getEnv("PORTAL_URL") || "http://localhost:3000",
    hotspotLoginUrl: getEnv("HOTSPOT_LOGIN_URL") || "http://10.5.50.1/login",
  },
} as const;

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
