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
    async jwt({ token, account, user }) {
      if (account?.id_token) {
        // Google OAuth 初回ログイン: トークン一式を保存
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        // expires_at は秒単位の UNIX タイムスタンプ
        token.expiresAt = account.expires_at;
        return token;
      }

      if (user?.email) {
        // dev Credentials プロバイダー
        token.idToken = `dev:${user.email}`;
        return token;
      }

      // 以降: セッション更新時 (account は null)
      // ID トークンの期限を 5 分前に切ってリフレッシュ
      const expiresAt = token.expiresAt as number | undefined;
      if (!expiresAt || Date.now() / 1000 < expiresAt - 300) {
        // まだ有効
        return token;
      }

      // リフレッシュトークンで新しい ID トークンを取得
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID ?? "",
            client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            grant_type: "refresh_token",
            refresh_token: (token.refreshToken as string) ?? "",
          }),
        });
        const tokens = await response.json();
        if (!response.ok) throw new Error(tokens.error ?? "Token refresh failed");

        token.idToken = tokens.id_token ?? token.idToken;
        token.expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in as number);
      } catch (err) {
        // リフレッシュ失敗時は期限切れのまま返す（次のリクエストで再試行）
        console.error("Failed to refresh Google token:", err);
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
