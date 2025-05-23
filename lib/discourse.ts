import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// Read from environment variables, provide defaults if necessary
const DISCOURSE_BASE_URL = process.env.DISCOURSE_BASE_URL || 'https://ethereum-magicians.org';
const DISCOURSE_API_KEY = process.env.DISCOURSE_API_KEY;
// Discourse API often requires a username associated with the key, 'system' is common for global keys
const DISCOURSE_API_USERNAME = process.env.DISCOURSE_API_USERNAME || 'system';

const STATE_FILE = path.join(process.cwd(), '.discourse_last_topic_id.txt');

interface DiscourseTopic {
    id: number;
    title: string;
    fancy_title: string;
    slug: string;
    posts_count: number;
    reply_count: number;
    highest_post_number: number;
    image_url: string | null;
    created_at: string; // ISO 8601 Date string
    last_posted_at: string; // ISO 8601 Date string
    bumped: boolean;
    bumped_at: string; // ISO 8601 Date string
    archetype: string;
    unseen: boolean;
    pinned: boolean;
    unpinned: null | boolean;
    excerpt?: string;
    visible: boolean;
    closed: boolean;
    archived: boolean;
    bookmarked: null | boolean;
    liked: null | boolean;
    tags?: string[];
    tags_descriptions?: Record<string, string>;
    views: number;
    like_count: number;
    has_summary: boolean;
    last_poster_username?: string;
    category_id: number;
    pinned_globally: boolean;
    featured_link?: string;
    has_accepted_answer?: boolean;
    posters: any[]; // Define more strictly if needed
}

interface DiscourseLatestTopicsResponse {
    users: any[]; // Define more strictly if needed
    primary_groups: any[]; // Define more strictly if needed
    topic_list: {
        can_create_topic: boolean;
        more_topics_url?: string;
        draft?: any; // Define more strictly if needed
        draft_key: string;
        draft_sequence: number;
        per_page: number;
        topics: DiscourseTopic[];
    };
}

interface SimpleTopic {
    id: number;
    title: string;
    url: string;
}

async function readLastProcessedTopicId(): Promise<number> {
    try {
        const data = await fs.readFile(STATE_FILE, 'utf-8');
        const id = parseInt(data.trim(), 10);
        return isNaN(id) ? 0 : id;
    } catch (error: any) {
        // If file doesn't exist or other read error, start from 0
        if (error.code === 'ENOENT') {
            console.log('State file not found, starting from beginning.');
            return 0;
        }
        console.error('Error reading state file:', error);
        return 0; // Default to 0 on other errors
    }
}

async function writeLastProcessedTopicId(topicId: number): Promise<void> {
    try {
        await fs.writeFile(STATE_FILE, topicId.toString(), 'utf-8');
    } catch (error) {
        console.error('Error writing state file:', error);
    }
}

export async function fetchNewDiscourseTopics(): Promise<DiscourseTopic[]> {
    const lastProcessedId = await readLastProcessedTopicId();
    console.log(`Fetching topics newer than ID: ${lastProcessedId} from ${DISCOURSE_BASE_URL}`);

    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };
    if (DISCOURSE_API_KEY) {
        headers['Api-Key'] = DISCOURSE_API_KEY;
        headers['Api-Username'] = DISCOURSE_API_USERNAME;
    }

    try {
        const response = await axios.get<DiscourseLatestTopicsResponse>(
            `${DISCOURSE_BASE_URL}/latest.json`,
            { headers }
        );

        if (response.status !== 200 || !response.data?.topic_list?.topics) {
            console.error('Failed to fetch topics or invalid response format');
            return [];
        }

        const allTopics = response.data.topic_list.topics;
        // Filter for topics strictly newer than the last processed one
        const newTopics = allTopics.filter(topic => topic.id > lastProcessedId);

        // Sort by ID ascending to process in order
        newTopics.sort((a, b) => a.id - b.id);

        if (newTopics.length > 0) {
            console.log(`Found ${newTopics.length} new topics.`);
            // Update state with the ID of the newest topic fetched in this batch
            const latestIdInBatch = newTopics[newTopics.length - 1].id;
            await writeLastProcessedTopicId(latestIdInBatch);
        } else {
            console.log('No new topics found.');
        }

        return newTopics;

    } catch (error) {
        console.error('Error fetching Discourse topics:', error);
        return [];
    }
}

// Example of fetching full topic details (if needed later)
// export async function fetchTopicDetails(topicId: number, slug: string) {
//     const headers: Record<string, string> = { 'Accept': 'application/json' };
//     if (DISCOURSE_API_KEY) {
//         headers['Api-Key'] = DISCOURSE_API_KEY;
//         headers['Api-Username'] = DISCOURSE_API_USERNAME;
//     }
//     try {
//         const response = await axios.get(`${DISCOURSE_BASE_URL}/t/${slug}/${topicId}.json`, { headers });
//         return response.data;
//     } catch (error) {
//         console.error(`Error fetching details for topic ${topicId}:`, error);
//         return null;
//     }
// }

export async function getLatestTopics(): Promise<SimpleTopic[]> {
    const latestTopicsUrl = `${DISCOURSE_BASE_URL}/latest.json`;
    console.log(`Fetching latest topics from: ${latestTopicsUrl}`);

    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };
    if (DISCOURSE_API_KEY) {
        headers['Api-Key'] = DISCOURSE_API_KEY;
        headers['Api-Username'] = DISCOURSE_API_USERNAME;
    }

    try {
        const response = await fetch(latestTopicsUrl, { headers });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();

        // Extract the list of topics from the response
        // Adjust the path based on the actual Discourse API response structure
        const topics: DiscourseTopic[] = data?.topic_list?.topics || [];

        // Filter out potential pinned topics or categories if necessary (optional)
        // Example: Filter out topics that are pinned globally
        // const filteredTopics = topics.filter(topic => !topic.pinned_globally);

        // Map the fetched topics to the simplified structure we need
        const simplifiedTopics: SimpleTopic[] = topics.map(topic => ({
            id: topic.id,
            title: topic.title,
            url: `${DISCOURSE_BASE_URL}/t/${topic.slug}/${topic.id}`
        }));

        console.log(`Fetched ${simplifiedTopics.length} latest topics.`);
        return simplifiedTopics;

    } catch (error) {
        console.error('Error fetching Discourse topics:', error);
        // Return an empty array or re-throw the error depending on desired error handling
        return [];
    }
} 