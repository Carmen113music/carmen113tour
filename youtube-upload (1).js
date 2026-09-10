// api/youtube-upload.js
// Genera una URL d'upload resumible de YouTube i la retorna a l'app
// El vídeo es puja directament des del navegador a YouTube (sense passar per Vercel)

const { google } = require('googleapis')

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  )
  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
  })
  return oauth2Client
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-video-title, x-video-description, x-concert-id, x-content-type, x-content-length')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Mètode no permès' })

  try {
    const titol = req.headers['x-video-title'] || 'Carmen 113 - Vídeo'
    const descripcio = req.headers['x-video-description'] || ''
    const concertId = req.headers['x-concert-id'] || ''
    const contentType = req.headers['x-content-type'] || 'video/mp4'
    const contentLength = req.headers['x-content-length'] || '0'

    const auth = getOAuthClient()
    const accessTokenRes = await auth.getAccessToken()
    const accessToken = accessTokenRes.token

    // Iniciem un upload resumible directament contra l'API de YouTube
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': contentLength,
        },
        body: JSON.stringify({
          snippet: {
            title: titol,
            description: `${descripcio}\n\nCarmen 113 · Mañanas de Euforia\nConcert ID: ${concertId}`,
            categoryId: '10',
          },
          status: {
            privacyStatus: 'unlisted',
          },
        }),
      }
    )

    if (!initRes.ok) {
      const errText = await initRes.text()
      return res.status(500).json({ error: 'Error iniciant upload', detail: errText })
    }

    // YouTube retorna la URL d'upload a la capçalera Location
    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) return res.status(500).json({ error: 'No s\'ha obtingut upload URL' })

    res.status(200).json({ uploadUrl })

  } catch (err) {
    console.error('Error:', err)
    res.status(500).json({ error: err.message })
  }
}
