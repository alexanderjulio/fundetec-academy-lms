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

  // 2. Si hay sesión, verificar ROLES para rutas específicas
  if (session) {
    // Si intenta acceder a login o landing ya estando logueado, redirigir a su panel
    if (path === '/' || path === '/login') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', session.user.id)
        .single();
      
      const role = profile?.role_id;
      if (role === 1) url.pathname = '/admin';
      else if (role === 2) url.pathname = '/coordinador';
      else url.pathname = '/dashboard';
      
      return NextResponse.redirect(url);
    }

    // Restricciones de rutas por rol
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', session.user.id)
      .single();

    const role = profile?.role_id;

    // Admin puede entrar a /admin, /coordinador y /dashboard
    if (path.startsWith('/admin') && role !== 1) {
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Coordinador solo puede entrar a /coordinador o /dashboard
    if (path.startsWith('/coordinador') && role !== 2 && role !== 1) {
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Estudiante NO puede entrar a admin ni coordinador
    if ((path.startsWith('/admin') || path.startsWith('/coordinador')) && role === 3) {
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/admin/:path*', '/coordinador/:path*'],
};
