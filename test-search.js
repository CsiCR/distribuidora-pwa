async function test() {
  const query = "resma";
  try {
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const tokenHtml = await tokenRes.text();
    
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
    
    console.log("VQD:", vqd);
    if (!vqd) {
      console.log("Token extraction failed.");
      return;
    }
    
    const imagesRes = await fetch(`https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&vqd=${vqd}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    const data = await imagesRes.json();
    console.log("Result status:", imagesRes.status);
    console.log("Results count:", data.results?.length || 0);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
