import { account } from '@/database/schemas/betterAuth';
import { users } from '@/database/schemas/user';
import { serverDB } from '@/database/server';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { type BetterAuthPlugin } from 'better-auth/types';
import { eq } from 'drizzle-orm';

import { createNanoId, idGenerator } from '@lobechat/database';

import { UserService } from '@/server/services/user';

interface KeycloakRopcConfig {
  clientId: string;
  clientSecret?: string;
  enabled: boolean;
  realmUrl: string;
}

/**
 * Better Auth plugin that validates email/password credentials against Keycloak
 * via Resource Owner Password Credentials (Direct Grant) flow.
 *
 * When enabled:
 * - Sign-in: credentials are validated against Keycloak, not local DB
 * - Auto-provision: local user is created on first successful Keycloak login
 * - Sign-up: disabled (users managed via Keycloak / Admin panel)
 */
export const keycloakRopcPlugin = (config: KeycloakRopcConfig): BetterAuthPlugin => ({
  id: 'keycloak-ropc',
  hooks: {
    before: [
      {
        matcher: (context) => context.path === '/sign-in/email',
        handler: createAuthMiddleware(async (ctx) => {
          if (!config.enabled) return { context: ctx };

          const { email, password } = ctx.body as { email: string; password: string };

          // Validate credentials against Keycloak Direct Grant
          const tokenUrl = `${config.realmUrl}/protocol/openid-connect/token`;
          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: config.clientId,
              ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
              grant_type: 'password',
              username: email,
              password,
              scope: 'openid profile email',
            }),
          });

          if (!response.ok) {
            throw new APIError('UNAUTHORIZED', {
              message: '账号或密码错误，请联系管理员开通账号',
            });
          }

          // Keycloak validation passed — ensure local user exists
          const [existingUser] = await serverDB
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email.toLowerCase().trim()))
            .limit(1);

          if (!existingUser) {
            // Auto-create local user (first time Keycloak login on LobeChat)
            const userId = idGenerator('user', 32 - 'user_'.length);
            const now = new Date();

            await serverDB.insert(users).values({
              id: userId,
              email: email.toLowerCase().trim(),
              fullName: email.split('@')[0],
              emailVerified: true,
              createdAt: now,
              updatedAt: now,
            });

            // Create credential record so Better Auth can find the user
            await serverDB.insert(account).values({
              id: createNanoId(12)(),
              userId,
              providerId: 'credential',
              accountId: email.toLowerCase().trim(),
              password: 'keycloak-managed',
              createdAt: now,
              updatedAt: now,
            });

            // Bootstrap user (same as databaseHooks.user.create.after)
            const userService = new UserService(serverDB);
            await userService.initUser({
              email: email.toLowerCase().trim(),
              id: userId,
              username: null,
              createdAt: now,
            });
          }

          return { context: ctx };
        }),
      },
    ],
  },
});
