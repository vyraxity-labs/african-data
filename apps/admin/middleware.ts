import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isAuthRoute = pathname.startsWith('/api/auth');
  const isLoginPage = pathname === '/admin/login' || pathname === '/login';

  if (isAuthRoute) {
    return NextResponse.next();
  }

  if (isLoginPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/admin', req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL('/admin/login', req.nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
