const fs = require('fs');
const path = require('path');

const cronDir = path.join(__dirname, 'app', 'api', 'cron');

const files = fs.readdirSync(cronDir).map(folder => path.join(cronDir, folder, 'route.ts')).filter(p => fs.existsSync(p));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // We want to replace the first few lines of the GET function containing the authorization check.
  // The generic replacement string we want to use:
  const newAuthCode = `  const authHeader = req.headers.get('authorization') || (typeof request !== 'undefined' ? request.headers.get('authorization') : null);
  const reqObj = typeof req !== 'undefined' ? req : (typeof request !== 'undefined' ? request : null);
  const secretParam = reqObj ? new URL(reqObj.url).searchParams.get('secret') : null;
  
  const validSecret = process.env.CRON_SECRET && (
    authHeader === \`Bearer \${process.env.CRON_SECRET}\` ||
    secretParam === process.env.CRON_SECRET
  );

  if (!validSecret) {
    console.warn('[cron] Unauthorized request blocked.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }`;

  // Let's manually replace the blocks
  content = content.replace(/const authHeader\s*=\s*(req|request)\.headers\.get\('authorization'\);\s*(const validBearer[^;]+;)?\s*if\s*\([^)]+\)\s*\{\s*(console\.warn[^;]+;)?\s*return NextResponse\.json\([^)]+\);\s*\}/s, newAuthCode);
  
  // Try another pattern
  content = content.replace(/const authHeader\s*=\s*(req|request)\.headers\.get\('authorization'\);\s*const cronSecret\s*=\s*process\.env\.CRON_SECRET;\s*if\s*\([^)]+\)\s*\{\s*return NextResponse\.json\([^)]+\);\s*\}/s, newAuthCode);

  content = content.replace(/const authHeader\s*=\s*(req|request)\.headers\.get\('authorization'\);\s*if\s*\([^)]+\)\s*\{\s*(console\.warn[^;]+;)?\s*return NextResponse\.json\([^)]+\);\s*\}/s, newAuthCode);

  content = content.replace(/if\s*\([^)]*authHeader[^)]*\)\s*\{\s*(console\.warn[^;]+;)?\s*return NextResponse\.json\([^)]+\);\s*\}/s, newAuthCode); // this might be too aggressive, but let's see.

  fs.writeFileSync(file, content, 'utf8');
}
console.log('Done');
