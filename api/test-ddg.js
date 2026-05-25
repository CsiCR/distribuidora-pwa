export default async function handler(req, res) {
  try {
    const query = req.query.q || "resma";
    const response = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    
    return res.status(200).json({
      status: response.status,
      length: html.length,
      title: html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || 'No title',
      bodySnippet: html.substring(0, 1000)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
