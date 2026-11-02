// Print only endpoint labels, status, and error codes; never credentials or bodies.
const base = '/accounts/15ec841931f6312fb82fdf863bb10d9a/workers';
const paths = [
  ['bindings', '/services/elah-boutique/environments/production/bindings'],
  ['routes', '/services/elah-boutique/environments/production/routes?show_zonename=true'],
  ['domains', '/domains/records?page=0&per_page=5&service=elah-boutique&environment=production'],
  ['subdomain', '/services/elah-boutique/environments/production/subdomain'],
  ['environment', '/services/elah-boutique/environments/production'],
  ['schedules', '/scripts/elah-boutique/schedules'],
];
for (const [label, path] of paths) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${base}${path}`, {
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
  });
  const data = await response.json();
  console.log(`${label}: HTTP ${response.status}; success=${data.success}; codes=${(data.errors || []).map(e => e.code).join(',')}`);
}
