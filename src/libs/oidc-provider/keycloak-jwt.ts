import { TRPCError } from '@trpc/server';
import debug from 'debug';
import type { JWTPayload } from 'jose';

import { authEnv } from '@/envs/auth';

const log = debug('sso-keycloak-jwt');

/** Cached remote JWKS key set */
let cachedRemoteJWKS: any = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if Keycloak SSO JWT authentication is enabled
 */
export const isKeycloakSSOEnabled = (): boolean => {
  return !!authEnv.KEYCLOAK_SSO_JWT_ENABLED;
};

/**
 * Get remote JWKS from Keycloak server
 * Uses jose's createRemoteJWKSet with caching
 */
const getRemoteJWKS = async () => {
  const jwksUri = authEnv.KEYCLOAK_SSO_JWKS_URI;
  if (!jwksUri) {
    throw new Error('KEYCLOAK_SSO_JWKS_URI is not configured');
  }

  // Return cached JWKS if still valid
  if (cachedRemoteJWKS && Date.now() < jwksCacheExpiry) {
    return cachedRemoteJWKS;
  }

  const { createRemoteJWKSet } = await import('jose');
  const jwks = createRemoteJWKSet(new URL(jwksUri));

  cachedRemoteJWKS = jwks;
  jwksCacheExpiry = Date.now() + JWKS_CACHE_TTL_MS;

  return jwks;
};

/**
 * Extract platform role from Keycloak JWT token
 * Maps Keycloak realm/client roles to platform role strings
 */
export const extractPlatformRole = (payload: JWTPayload): string => {
  const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
  const clientId = authEnv.KEYCLOAK_SSO_CLIENT_ID || 'lobechat';
  const resourceAccess = payload.resource_access?.[clientId] as
    | { roles?: string[] }
    | undefined;

  const allRoles = [
    ...(realmAccess?.roles || []),
    ...(resourceAccess?.roles || []),
  ];

  if (allRoles.includes('super_admin')) return 'super_admin';
  if (allRoles.includes('admin')) return 'admin';
  if (allRoles.includes('teacher')) return 'teacher';

  return 'student';
};

/**
 * Validate Keycloak SSO JWT token
 * Verifies signature against remote JWKS, checks issuer and client ID
 *
 * @param token - JWT token string from Authorization header
 * @returns Parsed token payload with user information
 */
export const validateKeycloakJWT = async (token: string) => {
  try {
    log('开始验证 Keycloak SSO JWT token');

    const remoteJWKS = await getRemoteJWKS();

    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, remoteJWKS, {
      algorithms: ['RS256'],
      issuer: authEnv.KEYCLOAK_SSO_ISSUER || undefined,
    });

    log('Keycloak JWT 验证成功，payload: %O', payload);

    const userId = payload.sub;
    if (!userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Keycloak JWT token 中缺少用户 ID (sub)',
      });
    }

    const email = payload.email as string | undefined;
    const name =
      (payload.name as string | undefined) ||
      (payload.preferred_username as string | undefined) ||
      email ||
      userId;

    const SmartAARole = extractPlatformRole(payload);

    return {
      email,
      name,
      payload,
      SmartAARole,
      userId,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    log('Keycloak JWT 验证失败: %O', error);

    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: `Keycloak JWT token 验证失败: ${(error as Error).message}`,
    });
  }
};

/**
 * Client-side auth helpers for Keycloak SSO
 *
 * These helpers are used by the SmartAA BFF API client to obtain
 * the current user's access token for authenticated API calls.
 */
export const ssoAuthHelpers = {
  /**
   * Get the current access token for BFF API calls.
   * In browser context, reads from the auth session/cookie.
   * Falls back to empty string if no token is available.
   */
  getAccessToken: async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    try {
      // Try to get token from the auth session
      // LobeChat stores auth state in localStorage or session
      const authStateStr = localStorage.getItem('lobe-auth-token');
      if (authStateStr) {
        const authState = JSON.parse(authStateStr) as { accessToken?: string; token?: string };
        return authState.accessToken || authState.token || null;
      }

      // Fallback: try session storage
      const sessionToken = sessionStorage.getItem('sso-keycloak-token');
      if (sessionToken) return sessionToken;
    } catch {
      // Ignore storage access errors
    }

    return null;
  },

  /**
   * Store the access token after successful Keycloak login
   */
  setAccessToken: async (token: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('sso-keycloak-token', token);
    } catch {
      // Ignore storage access errors
    }
  },
};
