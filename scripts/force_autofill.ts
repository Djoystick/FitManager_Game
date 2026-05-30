import { GET } from '../app/api/cron/league-autofill/route';

async function run() {
  const req = new Request('http://localhost');
  const res = await GET(req);
  const data = await res.json();
  console.log(data);
}
run();
