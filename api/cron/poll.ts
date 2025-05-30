import 'dotenv/config';
// import { VercelRequest, VercelResponse } from '@vercel/node'; // Removed import
import { fetchNewDiscourseTopics } from '../../lib/discourse.js';
import { submitCast } from '../../lib/farcaster.js';
import { Embed } from '@farcaster/hub-web';

// TODO: Replace with your actual domain
const FRAME_BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
const DISCOURSE_BASE_URL = process.env.DISCOURSE_BASE_URL || 'https://ethereum-magicians.org';

// Use 'any' for request and response types
export default async function handler(req: any, res: any) {
  // Optional: Add security check - e.g., check for a secret header/query param
  // if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).send('Unauthorized');
  // }

  console.log('Running Discourse polling cron job...');

  try {
    const newTopics = await fetchNewDiscourseTopics();

    for (const topic of newTopics) {
      const frameUrl = `${FRAME_BASE_URL}/api/frame?topicId=${topic.id}&topicSlug=${topic.slug}`;
      const castText = `New Forum Post: ${topic.title}`; // Keep it concise

      console.log(`Posting cast for topic ${topic.id}: ${topic.title}`);

      try {
        await submitCast(castText, [{ url: frameUrl }]);
        // Optional: Add a small delay between posts to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (castError) {
        console.error(`Failed to post cast for topic ${topic.id}:`, castError);
        // Decide if you want to stop or continue on error
      }
    }

    console.log('Discourse polling cron job finished.');
    res.status(200).send(`Processed ${newTopics.length} new topics.`);

  } catch (error) {
    console.error('Error during cron job execution:', error);
    res.status(500).send('Cron job failed');
  }
} 