import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = req.nextUrl.clone();

  // 1. Si no hay sesión y trata de entrar al dashboard, enviar a login
  if (!session && (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/coordinador'))) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Si hay sesión, verificar roles para las rutas protegidas
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', session.user.id)
      .single();

    const roleId = profile?.role_id;

    // Redirigir si está en la ruta equivocada
    
    // Un Coordinador (role 2) no debe estar en /dashboard (estudiante)
    if (roleId === 2 && url.pathname.startsWith('/dashboard')) {
      url.pathname = '/coordinador';
      return NextResponse.redirect(url);
    }

    // Un Estudiante (role 3 o null) no debe estar en /admin o /coordinador
    if ((roleId === 3 || !roleId) && (url.pathname.startsWith('/admin') || url.pathname.startsWith('/coordinador'))) {
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Un Admin (role 1) puede verlo todo, pero por defecto lo enviamos a /admin si entra a /login
    if (roleId === 1 && url.pathname === '/login') {
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/coordinador/:path*', '/login'],
};
