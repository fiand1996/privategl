import { verifyPassword } from "@/lib/auth-passwords";
import { getUserByUsername } from "@/lib/database";
import NextAuth, { type DefaultSession } from "next-auth";
import "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "viewer";
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: "admin" | "viewer";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "admin" | "viewer";
  }
}

if (
  !process.env.AUTH_SECRET &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  console.warn(
    "\n⚠️  [Security Warning] AUTH_SECRET is not set! Authentication will fail until AUTH_SECRET is provided in your environment or .env file.\n",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        const username = String(credentials.username).trim().toLowerCase();
        const password = String(credentials.password);

        const user = getUserByUsername(username);
        if (!user) {
          return null;
        }

        const isValid = verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: String(user.id),
          name: user.displayName || user.username,
          email: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Prevent internal container hostnames (e.g. 0.0.0.0) from leaking to client redirects
      if (url.startsWith("/")) return url;
      try {
        const parsedUrl = new URL(url);
        const parsedBase = new URL(baseUrl);
        if (parsedUrl.origin === parsedBase.origin) return url;
      } catch {}
      return baseUrl;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) || "";
        session.user.role = (token.role as "admin" | "viewer") || "viewer";
      }
      return session;
    },
  },
});
