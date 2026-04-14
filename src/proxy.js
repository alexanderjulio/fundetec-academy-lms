import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function proxy(request) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // 1. Prohibir acceso a rutas protegidas sin sesión
  if (!session && (path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/coordinador'))) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Seguridad Estricta por Rol
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', session.user.id)
      .single();

    const role = profile?.role_id;

    // Redirección si intenta entrar a login o landing ya estando logueado
    if (path === '/' || path === '/login') {
      if (role === 1) url.pathname = '/admin';
      else if (role === 2) url.pathname = '/coordinador';
      else url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // BLOQUEO ESTRICTO:
    
    // Si es ADMIN (role 1), solo puede estar en /admin
    if (role === 1 && (path.startsWith('/dashboard') || path.startsWith('/coordinador'))) {
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }

    // Si es COORDINADOR (role 2), solo puede estar en /coordinador
    if (role === 2 && (path.startsWith('/admin') || path.startsWith('/dashboard'))) {
      url.pathname = '/coordinador';
      return NextResponse.redirect(url);
    }

    // Si es ESTUDIANTE (role 3 o sin rol definido), solo puede estar en /dashboard
    if ((role === 3 || !role) && (path.startsWith('/admin') || path.startsWith('/coordinador'))) {
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/admin/:path*', '/coordinador/:path*'],
};
