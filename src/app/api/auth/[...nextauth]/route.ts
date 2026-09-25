import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { getDatabase } from "@/lib/db"
import { v4 as uuidv4 } from 'uuid';

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
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' && user.email) {
        const db = getDatabase();
        // Check if user exists in SQLite
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(user.email) as { id: string } | undefined;
        
        if (!existingUser) {
          // Auto-register user in our SQLite DB
          const newUserId = uuidv4();
          db.prepare(`
            INSERT INTO users (id, name, email, image) 
            VALUES (?, ?, ?, ?)
          `).run(newUserId, user.name || '', user.email, user.image || '');
        }
        return true;
      }
      return false;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const db = getDatabase();
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as { id: string } | undefined;
        if (existingUser) {
          // Attach the SQLite user ID to the session
          (session.user as any).id = existingUser.id;
        }
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "pharma-ddi-checker-secret-key",
});

export { handler as GET, handler as POST }
