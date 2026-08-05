export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const envKey = 'API_URL';
  const apiUrl = process.env[envKey];
  if (!apiUrl) {
    return res.status(500).json({
      success: false,
      message: 'API_URL is not configured'
    });
  }

  const startTime = Date.now();
  let gasResponse = null;
  let error = null;

  // Build target URL by copying all search params from incoming request
  const targetUrl = new URL(apiUrl);
  if (req.url.includes('?')) {
    const incomingUrl = new URL(req.url, 'http://localhost');
    incomingUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });
  }

  // Construct fetch options
  const fetchOptions = {
    method: req.method,
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    redirect: 'follow'
  };

  if (req.method === 'POST') {
    fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  // Fetch with retry logic (up to 2 attempts)
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    fetchOptions.signal = controller.signal;

    try {
      gasResponse = await fetch(targetUrl.toString(), fetchOptions);
      clearTimeout(timeoutId);
      if (gasResponse.ok) {
        break; // Success, exit retry loop
      }
      if (attempt < maxAttempts) {
        console.warn(`[Proxy] Attempt ${attempt} failed with status ${gasResponse.status}. Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      clearTimeout(timeoutId);
      error = err;
      if (attempt < maxAttempts) {
        console.warn(`[Proxy] Attempt ${attempt} encountered error: ${err.message}. Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  if (error && !gasResponse) {
    const isTimeout = error.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      success: false,
      message: isTimeout ? 'Gateway Timeout' : (error.message || 'Proxy error')
    });
  }

  if (!gasResponse.ok) {
    return res.status(gasResponse.status).json({
      success: false,
      message: `Google Apps Script returned status ${gasResponse.status}`
    });
  }

  const responseText = await gasResponse.text();
  const parseStart = Date.now();
  let jsonResponse;
  try {
    jsonResponse = JSON.parse(responseText);
  } catch (parseError) {
    return res.status(502).json({
      success: false,
      message: 'Invalid JSON response from Apps Script',
      raw: responseText
    });
  }

  const totalDuration = Date.now() - startTime;
  const parseDuration = Date.now() - parseStart;
  const gasDuration = totalDuration - parseDuration;

  res.setHeader('Server-Timing', `gas;dur=${gasDuration};desc="GAS Response Time", parse;dur=${parseDuration};desc="JSON Parse Time", total;dur=${totalDuration};desc="Vercel API Route"`);

  return res.status(200).json(jsonResponse);
}
