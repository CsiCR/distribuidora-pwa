import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import url from 'url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'api-proxy-plugin',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url) return next();
          
          const parsedUrl = url.parse(req.url, true);
          const pathname = parsedUrl.pathname;
          
          // Endpoint to search images via DuckDuckGo
          if (pathname === '/api/search-images') {
            const query = parsedUrl.query.q;
            if (!query || typeof query !== 'string') {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing or invalid q parameter' }));
              return;
            }
            
            try {
              // 1. Fetch main search page to extract VQD token
              const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              });
              const tokenHtml = await tokenRes.text();
              
              // Extract VQD token using regexes with optional spaces support
              let vqd = '';
              const match1 = tokenHtml.match(/vqd=(['"])([^'"]+)\1/);
              if (match1) {
                vqd = match1[2];
              } else {
                const match2 = tokenHtml.match(/vqd:\s*(['"])([^'"]+)\1/);
                if (match2) {
                  vqd = match2[2];
                } else {
                  const match3 = tokenHtml.match(/vqd\s*=\s*(['"])([^'"]+)\1/);
                  if (match3) {
                    vqd = match3[2];
                  } else {
                    const match4 = tokenHtml.match(/vqd\s*=\s*([^;,\s"']+)/);
                    if (match4) {
                      vqd = match4[1].trim();
                    }
                  }
                }
              }

              if (!vqd) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to retrieve VQD token from search' }));
                return;
              }

              // 2. Fetch search results from DuckDuckGo's internal image endpoint
              const imagesRes = await fetch(`https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&vqd=${vqd}`, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'application/json'
                }
              });
              const data = await imagesRes.json() as any;
              
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(data.results || []));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Error searching images' }));
            }
            return;
          }
          
          // Endpoint to proxy external images bypass CORS
          if (pathname === '/api/proxy-image') {
            const imageUrl = parsedUrl.query.url;
            if (!imageUrl || typeof imageUrl !== 'string') {
              res.statusCode = 400;
              res.end('Missing or invalid url parameter');
              return;
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
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(Buffer.from(buffer));
            } catch (err: any) {
              res.statusCode = 500;
              res.end('Failed to proxy image: ' + (err.message || 'Unknown error'));
            }
            return;
          }
          
          next();
        });
      }
    }
  ],
});
