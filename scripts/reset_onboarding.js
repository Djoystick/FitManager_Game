import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetOnboarding() {
  const { data, error } = await supabase
    .from('users')
    .update({ tutorial_step: 0 })
    .neq('tutorial_step', 0);

  if (error) {
    console.error('Error resetting onboarding:', error);
  } else {
    console.log('Successfully reset onboarding for all users.');
  }
}

resetOnboarding();
