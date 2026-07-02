/* Vercel serverless twin of serve.py's /proxy — fetches smart-link pages
   (DistroKid HyperFollow / TuneCore) server-side so the admin console's
   importer never hits browser CORS. Reached as /proxy via vercel.json rewrite. */
const MAX_BYTES = 3 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

module.exports = async (req, res) => {
  const url = String((req.query && req.query.url) || '');
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).send('proxy: url param must be http(s)');
    return;
  }
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
      signal: AbortSignal.timeout(15000)
    });
    const text = (await r.text()).slice(0, MAX_BYTES);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).send('proxy: ' + (e && e.message ? e.message : 'fetch failed'));
  }
};
