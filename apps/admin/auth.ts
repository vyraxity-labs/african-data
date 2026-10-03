import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

/* eslint-disable no-unused-vars */
declare module 'next-auth' {
  interface User {
    role?: string
  }
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      role?: string
    }
  }
}
/* eslint-enable no-unused-vars */

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@africandata.org'
        const adminPassword =
          process.env.ADMIN_PASSWORD || 'AfricanData2026!Admin'

        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined

        if (email === adminEmail && password === adminPassword) {
          return {
            id: 'admin-1',
            name: 'Administrator',
            email: adminEmail,
            role: 'admin',
          }
        }
        return null
      },
    }),
  ],
  pages: {
    signIn: '/admin/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = 'admin'
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) || 'admin'
      }
      return session
    },
  },
})
