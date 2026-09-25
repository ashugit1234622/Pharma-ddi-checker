import GoogleProvider from "next-auth/providers/google";
import { v4 as uuidv4 } from 'uuid';
import type { NextAuthOptions } from "next-auth";
import { getDatabase } from '@/lib/db';

function tryGetDatabase() {
  try {
    return getDatabase();
  } catch (e: any) {
    console.error('[NextAuth] Database initialization failed:', e.message);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string || "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        try {
          const pool = tryGetDatabase();
          if (pool) {
            const existingRes = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
            if (existingRes.rows.length === 0) {
              const newUserId = uuidv4();
              await pool.query(
                `INSERT INTO users (id, name, email, image) VALUES ($1, $2, $3, $4)`,
                [newUserId, user.name || '', user.email, user.image || '']
              );
            }
          }
        } catch (e) {
          console.error("[NextAuth] signIn DB error (non-fatal):", e);
        }
        return true;
      }
      return false;
    },

    async jwt({ token, user, trigger, session }) {
      if (trigger === 'update' && session?.profileComplete) {
        token.profileComplete = session.profileComplete;
      }

      if (user?.email) {
        try {
          const pool = tryGetDatabase();
          if (pool) {
            const dbUserRes = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
            if (dbUserRes.rows.length > 0) {
              const dbUser = dbUserRes.rows[0];
              token.userId = dbUser.id;
              const profileRes = await pool.query('SELECT id FROM patient_profiles WHERE user_id = $1', [dbUser.id]);
              token.profileComplete = profileRes.rows.length > 0;
            } else {
              token.profileComplete = false;
            }
          }
        } catch (e) {
          console.error("[NextAuth] jwt DB error:", e);
          token.profileComplete = false;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string || '';
        (session.user as any).profileComplete = token.profileComplete as boolean ?? false;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "pharma-ddi-checker-secret-key",
};
