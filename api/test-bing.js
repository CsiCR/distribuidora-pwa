export default async function handler(req, res) {
  try {
    const query = req.query.q || "resma";
    const response = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    
    const regex = /m="([^"]+)"/g;
    const matches = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      try {
        const decoded = match[0].substring(3, match[0].length - 1).replace(/&quot;/g, '"');
        const json = JSON.parse(decoded);
        if (json.murl) {
          matches.push(json.murl);
        }
      } catch (e) {}
    }
    
    return res.status(200).json({
      status: response.status,
      length: html.length,
      count: matches.length,
      matches: matches.slice(0, 5)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
