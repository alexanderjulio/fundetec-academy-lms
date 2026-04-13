'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Update a user's password from the admin panel.
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable.
 */
export async function updateUserPassword(userId, newPassword) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' };
  }

  // 1. Initialize admin client
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // 2. Perform the update
    const { data, error } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) throw error;

    return { success: true, message: 'Seguridad de usuario actualizada.' };
  } catch (error) {
    console.error('Admin Auth Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Register a new user from the admin/coordinator panel.
 */
export async function registerNewUser(userData, actorId, actorRole) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) return { success: false, error: 'Configuración de servidor incompleta.' };

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Create User in Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: { full_name: userData.full_name }
    });

    if (authError) throw authError;

    // 2. Insert into Profiles
    const profileData = {
      id: authData.user.id,
      full_name: userData.full_name,
      whatsapp: userData.whatsapp,
      email: userData.email,
      role_id: userData.role_id,
      student_type: userData.student_type || 'otro',
      status: userData.status || 'activo',
      coordinator_id: actorRole === 2 ? actorId : userData.coordinator_id || null
    };

    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (profileError) {
      // Rollback Auth user if profile fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return { success: true, message: 'Usuario registrado exitosamente.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update profile state or modality.
 */
export async function updateProfileMetadata(userId, metadata) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await adminClient
      .from('profiles')
      .update(metadata)
      .eq('id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a user (Admin only).
 */
export async function removeUserById(userId, actorRole) {
  if (actorRole !== 1) return { success: false, error: 'Acción restringida a administradores.' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) throw error;
    return { success: true, message: 'Cuenta eliminada del sistema.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Change user role (Admin only).
 */
export async function updateUserRoleById(userId, newRoleId, actorRole) {
  if (actorRole !== 1) return { success: false, error: 'Acción restringida a administradores.' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await adminClient
      .from('profiles')
      .update({ role_id: parseInt(newRoleId) })
      .eq('id', userId);

    if (error) throw error;
    return { success: true, message: 'Rol de usuario actualizado.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update Landing Page Sections (CMS).
 */
export async function updateLandingSection(slug, updates, actorRole) {
  if (actorRole !== 1) return { success: false, error: 'Acción restringida a administradores maestros.' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await adminClient
      .from('landing_sections')
      .update(updates)
      .eq('slug', slug);

    if (error) throw error;
    return { success: true, message: `Sección ${slug} actualizada con éxito.` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Manually confirm a user's email (bypasses rate limits and manual clicks).
 */
export async function confirmEmailManual(userId) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) return { success: false, error: 'Error de configuración.' };
  
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await adminClient.auth.admin.updateUserById(userId, { 
      email_confirm: true 
    });
    
    if (error) throw error;
    return { success: true, message: 'Cuenta activada manualmente con éxito.' };
  } catch (error) {
    console.error('Confirm Email Error:', error);
    return { success: false, error: error.message };
  }
}
