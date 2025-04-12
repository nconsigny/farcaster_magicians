import type { VercelRequest, VercelResponse } from '@vercel/node';

const DISCOURSE_BASE_URL = 'https://ethereum-magicians.org';
// TODO: Replace with your actual domain
const FRAME_BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Vercel routes query params like /api/frame?topicId=123
  const topicId = req.query['topicId'] as string;
  const topicSlug = req.query['topicSlug'] as string | undefined; // Optional, might be needed later

  if (!topicId) {
    return res.status(400).send('Missing topicId parameter');
  }

  // Construct the target Discourse URL
  // We might need to fetch the slug if it wasn't passed or is outdated
  const discourseTopicUrl = topicSlug
    ? `${DISCOURSE_BASE_URL}/t/${topicSlug}/${topicId}`
    : `${DISCOURSE_BASE_URL}/t/${topicId}`;

  // Construct the POST URL for frame actions
  const postUrl = `${FRAME_BASE_URL}/api/frame?topicId=${topicId}${topicSlug ? `&topicSlug=${topicSlug}` : ''}`;

  // TODO: Fetch actual topic details from Discourse to populate image and title dynamically
  const imageUrl = `${FRAME_BASE_URL}/placeholder-image.png`; // Replace with a real or dynamic image URL
  const topicTitle = `Ethereum Magicians Topic #${topicId}`; // Replace with actual title

  // Return the Frame HTML
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${topicTitle}</title>
        <meta property="og:title" content="${topicTitle}">
        <meta property="og:image" content="${imageUrl}">
        <meta property="fc:frame" content="vNext">
        <meta property="fc:frame:image" content="${imageUrl}">
        <meta property="fc:frame:post_url" content="${postUrl}">
        <meta property="fc:frame:button:1" content="View Original Topic">
        <meta property="fc:frame:button:1:action" content="link">
        <meta property="fc:frame:button:1:target" content="${discourseTopicUrl}">
        <!-- Add more buttons here if needed -->
      </head>
      <body>
        <h1>${topicTitle}</h1>
        <p>View this topic on <a href="${discourseTopicUrl}" target="_blank" rel="noopener noreferrer">Ethereum Magicians</a>.</p>
        <p>This is the content users see if their client doesn't support Frames.</p>
      </body>
    </html>
  `);
} 