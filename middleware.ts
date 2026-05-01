import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Protected routes check
  const isProtectedRoute = 
    request.nextUrl.pathname.startsWith('/painel') ||
    request.nextUrl.pathname.startsWith('/receitas') ||
    request.nextUrl.pathname.startsWith('/despesas') ||
    request.nextUrl.pathname.startsWith('/investimentos') ||
    request.nextUrl.pathname.startsWith('/orcamento');

  if (isProtectedRoute && !session) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('redirectedFrom', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if logged in and at login page
  if (request.nextUrl.pathname === '/' && session) {
    const url = request.nextUrl.clone();
    url.pathname = '/painel';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api|registrar|public|.*\\.).*)',
  ],
};
