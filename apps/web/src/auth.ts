import NextAuth from "next-auth";
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
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
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
