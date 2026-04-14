
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restoreAdmin() {
  const email = 'ajulio@fundetec.edu.co';
  const password = 'fundetec2026';
  
  console.log('Restoring admin:', email);

  // 1. Create in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Alexander Julio Admin' }
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    if (!authError.message.includes('already registered')) return;
  }

  const userId = authData?.user?.id || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email).id;

  // 2. Create/Update Profile
  const { error: profError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: 'Alexander Julio Admin',
      email,
      role_id: 1, // Admin
      status: 'activo'
    }, { onConflict: 'id' });

  if (profError) {
    console.error('Profile Error:', profError.message);
  } else {
    console.log('Admin restored successfully in Auth and Profiles!');
  }
}

restoreAdmin();
