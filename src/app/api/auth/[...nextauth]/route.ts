import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { v4 as uuidv4 } from 'uuid';

function tryGetDatabase() {
  try {
    const { getDatabase } = require("@/lib/db");
    return getDatabase();
  } catch (e) {
    console.error("[NextAuth] DB unavailable:", e);
    return null;
  }
}

const handler = NextAuth({
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
          const db = tryGetDatabase();
          if (db) {
            const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(user.email) as { id: string } | undefined;
            if (!existingUser) {
              const newUserId = uuidv4();
              db.prepare(`
                INSERT INTO users (id, name, email, image) 
                VALUES (?, ?, ?, ?)
              `).run(newUserId, user.name || '', user.email, user.image || '');
            }
          }
        } catch (e) {
          console.error("[NextAuth] signIn DB error (non-fatal):", e);
        }
        return true; // Always allow sign-in even if DB fails
      }
      return false;
    },

    async jwt({ token, user }) {
      // Attach profile_complete flag on first sign-in
      if (user?.email) {
        try {
          const db = tryGetDatabase();
          if (db) {
            const dbUser = db.prepare('SELECT id FROM users WHERE email = ?').get(user.email) as { id: string } | undefined;
            if (dbUser) {
              token.userId = dbUser.id;
              const profile = db.prepare('SELECT id FROM patient_profiles WHERE user_id = ?').get(dbUser.id);
              token.profileComplete = !!profile;
            } else {
              token.profileComplete = false;
            }
          }
        } catch (e) {
          console.error("[NextAuth] jwt DB error (non-fatal):", e);
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
});

export { handler as GET, handler as POST }
