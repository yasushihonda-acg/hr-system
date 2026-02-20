import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    idToken?: string;
    user: {
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

const isDev = process.env.NODE_ENV === "development";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    // 開発環境専用: Google OAuth 不要でメールアドレスのみでログイン
    ...(isDev
      ? [
          Credentials({
            id: "dev-login",
            name: "開発用ログイン",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              const email = credentials?.email as string | undefined;
              if (!email) return null;
              return { id: email, email, name: email };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, account, user }) {
      if (account?.id_token) {
        // Google OAuth: 実際の ID トークンをセット
        token.idToken = account.id_token;
      } else if (user?.email) {
        // dev Credentials: "dev:{email}" 形式のトークンをセット
        // account が null の Credentials プロバイダーのみここに入る
        token.idToken = `dev:${user.email}`;
      }
      return token;
    },
    session({ session, token }) {
      session.idToken = token.idToken as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
