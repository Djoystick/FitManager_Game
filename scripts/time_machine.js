import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const CRON_SECRET = process.env.CRON_SECRET || process.env.CRON_SECRET_MANUAL;
// Since we are running locally, point to localhost or the Vercel URL if you want to test prod
const API_URL = 'http://localhost:3000';

async function fastForwardSeason() {
  console.log(`🚀 Starting Time Machine for 26 rounds at ${API_URL}...`);

  for (let round = 1; round <= 26; round++) {
    console.log(`\n⏳ Simulating Round ${round}...`);
    try {
      const res = await fetch(`${API_URL}/api/cron/process-matches?secret=${CRON_SECRET}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
      });
      
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ Round ${round} success:`, data.message || data);
      } else {
        console.error(`❌ Round ${round} failed:`, data);
        break; 
      }
    } catch (err) {
      console.error(`❌ Fetch error on round ${round}:`, err.message);
      break;
    }

    // Small delay to prevent overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('\n🏁 Time Machine stopped. Season should be finished!');
}

fastForwardSeason();
