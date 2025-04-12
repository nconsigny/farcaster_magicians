import 'dotenv/config';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchNewDiscourseTopics } from '../../lib/discourse.js';
import { submitCast } from '../../lib/farcaster.js';
import { Embed } from '@farcaster/hub-web';

const DISCOURSE_BASE_URL = process.env.DISCOURSE_BASE_URL || 'https://ethereum-magicians.org';

// Simple delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Optional: Basic security check (e.g., check for a secret header)
    // const cronSecret = req.headers['x-vercel-cron-secret'];
    // if (cronSecret !== process.env.VERCEL_CRON_SECRET) {
    //     return res.status(401).send('Unauthorized');
    // }

    console.log('Starting Discourse to Farcaster sync job...');

    try {
        const newTopics = await fetchNewDiscourseTopics();

        if (newTopics.length === 0) {
            console.log('No new Discourse topics found.');
            return res.status(200).send('No new topics to process.');
        }

        console.log(`Found ${newTopics.length} new topics. Processing...`);
        let successCount = 0;
        let errorCount = 0;

        for (const topic of newTopics) {
            const topicUrl = `${DISCOURSE_BASE_URL}/t/${topic.slug}/${topic.id}`;
            const castText = `New post in ${topic.category_id}: "${topic.title}"`; // You might want to fetch category name later
            const embeds: Embed[] = [{ url: topicUrl }];

            console.log(`Attempting to cast topic ID ${topic.id}: ${topic.title}`);

            try {
                const result = await submitCast(castText, embeds);
                if (result.isOk()) {
                    console.log(`Successfully casted topic ID ${topic.id}`);
                    successCount++;
                } else {
                    console.error(`Failed to cast topic ID ${topic.id}:`, result.error);
                    errorCount++;
                    // Decide if you want to stop processing on first error or continue
                }
                // Add a small delay between posts to avoid rate limits
                await delay(500); // 500ms delay
            } catch (error) {
                console.error(`Unhandled error casting topic ID ${topic.id}:`, error);
                errorCount++;
            }
        }

        const summary = `Sync finished. Success: ${successCount}, Errors: ${errorCount}`;
        console.log(summary);
        return res.status(200).send(summary);

    } catch (error) {
        console.error('Error fetching or processing Discourse topics:', error);
        return res.status(500).send('Internal Server Error');
    }
} 