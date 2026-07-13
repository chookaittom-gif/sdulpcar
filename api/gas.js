export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
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

    const gasResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(req.body)
    });

    const responseText = await gasResponse.text();

    try {
      const jsonResponse = JSON.parse(responseText);
      return res.status(200).json(jsonResponse);
    } catch (parseError) {
      return res.status(502).json({
        success: false,
        message: 'Invalid JSON response from Apps Script',
        raw: responseText
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Proxy error'
    });
  }
}
