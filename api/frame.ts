// import type { VercelRequest, VercelResponse } from '@vercel/node'; // Removed import
import { getLatestTopics } from '@lib/discourse.js'; // Import the function using path alias

const DISCOURSE_BASE_URL = process.env.DISCOURSE_BASE_URL || 'https://ethereum-magicians.org';
// TODO: Replace with your actual domain
const FRAME_BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

// Use 'any' for request and response types
export default async function handler(
  req: any, // Changed from VercelRequest
  res: any, // Changed from VercelResponse
) {
  try {
    // Fetch the latest topics to potentially show the most recent one
    const latestTopics = await getLatestTopics(); // Use the function from discourse.ts
    const latestTopic = latestTopics.length > 0 ? latestTopics[0] : null;

    // Frame properties
    const frameTitle = latestTopic ? `Latest: ${latestTopic.title}` : "Ethereum Magicians Forum";
    const frameImageUrl = `${FRAME_BASE_URL}/api/og?title=${encodeURIComponent(frameTitle)}`; // Dynamic OG image URL
    const postUrl = `${FRAME_BASE_URL}/api/frame`; // Post back to this endpoint
    const forumLatestUrl = `${DISCOURSE_BASE_URL}/latest`;

    // Handle POST requests for potential interactions (e.g., refresh)
    if (req.method === 'POST') {
      // In a more complex frame, you would read req.body to determine the action
      // For now, we just re-render the latest topic view
      console.log("Frame POST request received");
      // Potentially refresh data or handle button clicks here
    }

    // Return the Frame HTML
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${frameTitle}</title>
          <meta property="og:title" content="${frameTitle}">
          <meta property="og:image" content="${frameImageUrl}">
          <meta property="fc:frame" content="vNext">
          <meta property="fc:frame:image" content="${frameImageUrl}">
          <meta property="fc:frame:post_url" content="${postUrl}">
          <meta property="fc:frame:button:1" content="View Latest Topics">
          <meta property="fc:frame:button:1:action" content="link">
          <meta property="fc:frame:button:1:target" content="${forumLatestUrl}">
          <meta property="fc:frame:button:2" content="Refresh">
          <meta property="fc:frame:button:2:action" content="post">
          <!-- Add more buttons here if needed -->
        </head>
        <body>
          <h1>${frameTitle}</h1>
          <p>View the latest topics on <a href="${forumLatestUrl}" target="_blank" rel="noopener noreferrer">Ethereum Magicians</a>.</p>
          <p>This is the content users see if their client doesn't support Frames.</p>
          <p>Frame hosted at: ${FRAME_BASE_URL}</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error generating frame:", error);
    res.status(500).send('Error generating frame');
  }
} 