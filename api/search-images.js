export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing q parameter' });
  }

  try {
    // 1. Get VQD token from DuckDuckGo HTML search page (more reliable on cloud hostings like Vercel)
    const tokenRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const tokenHtml = await tokenRes.text();
    
    const match = tokenHtml.match(/name="vqd"\s+value="([^"]+)"/);
    const vqd = match ? match[1] : '';

    if (!vqd) {
      return res.status(500).json({ error: 'Failed to retrieve VQD token from DuckDuckGo' });
    }

    // 2. Fetch images
    const imagesRes = await fetch(`https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&vqd=${vqd}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    const data = await imagesRes.json();
    return res.status(200).json(data.results || []);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error searching images' });
  }
}
