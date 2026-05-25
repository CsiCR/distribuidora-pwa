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
    // 1. Get VQD token from DuckDuckGo search page
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const tokenHtml = await tokenRes.text();
    
    // Extract VQD token using regexes
    const vqdRegex = /vqd=(['"])([^'"]+)\1/;
    const vqdMatch = tokenHtml.match(vqdRegex);
    let vqd = '';
    if (vqdMatch) {
      vqd = vqdMatch[2];
    } else {
      const vqdRegex2 = /vqd:(['"])([^'"]+)\1/;
      const vqdMatch2 = tokenHtml.match(vqdRegex2);
      if (vqdMatch2) {
        vqd = vqdMatch2[2];
      }
    }

    if (!vqd) {
      return res.status(500).json({ error: 'Failed to retrieve VQD token' });
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
