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

  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const imageRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch target image, status code: ${imageRes.status}`);
    }

    const contentType = imageRes.headers.get('content-type') || 'application/octet-stream';
    const buffer = await imageRes.arrayBuffer();
    
    res.setHeader('Content-Type', contentType);
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).send('Failed to proxy image: ' + (err.message || 'Unknown error'));
  }
}
