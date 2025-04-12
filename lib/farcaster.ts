import 'dotenv/config'; // Ensure environment variables are loaded
import {
    getHubRpcClient,
    HubRpcClient, // Type for the client
    FarcasterNetwork,
    NobleEd25519Signer, // Class for the signer
    makeCastAdd,
    CastAddBody, // Type for cast body
    Embed, // Type for embeds
    Message, // Type for the signed message
    HubAsyncResult, // Type for hub results
    CastId, // Import CastId type if replying
    MessageType, // Import MessageType
} from "@farcaster/hub-web";
import { hexToBytes } from '@noble/hashes/utils';

// --- Environment Variable Validation ---
const HUB_URL = process.env.FARCASTER_HUB_URL;
const HUB_SSL_STRING = process.env.FARCASTER_HUB_SSL?.toLowerCase();
const BOT_FID_STRING = process.env.FARCASTER_BOT_FID;
const BOT_PRIVATE_KEY = process.env.FARCASTER_BOT_PRIVATE_KEY;

if (!HUB_URL) throw new Error("FARCASTER_HUB_URL is not set in .env");
if (!BOT_FID_STRING) throw new Error("FARCASTER_BOT_FID is not set in .env");
if (!BOT_PRIVATE_KEY) throw new Error("FARCASTER_BOT_PRIVATE_KEY is not set in .env");

const BOT_FID = parseInt(BOT_FID_STRING);
if (isNaN(BOT_FID)) throw new Error("Invalid FARCASTER_BOT_FID in .env");
if (!BOT_PRIVATE_KEY.startsWith('0x') || BOT_PRIVATE_KEY.length !== 66) {
    throw new Error("Invalid FARCASTER_BOT_PRIVATE_KEY format in .env");
}

const HUB_SSL = HUB_SSL_STRING === 'true';

// --- Global Variables (Initialized Once) ---
let hubClient: HubRpcClient | undefined;
let botSigner: NobleEd25519Signer | undefined;

/**
 * Initializes and returns the Hub RPC Client.
 * Uses cached client after first initialization.
 */
function getClient(): HubRpcClient {
    if (!hubClient) {
        console.log(`Connecting to Farcaster Hub: ${HUB_URL} (SSL inferred from URL)`);
        hubClient = getHubRpcClient(HUB_URL!, {});
    }
    return hubClient;
}

/**
 * Initializes and returns the Ed25519 Signer for the bot.
 * Uses cached signer after first initialization.
 */
function getSigner(): NobleEd25519Signer {
    if (!botSigner) {
        console.log(`Initializing signer for FID: ${BOT_FID}`);
        try {
            const privateKeyBytes = hexToBytes(BOT_PRIVATE_KEY!.substring(2));
            botSigner = new NobleEd25519Signer(privateKeyBytes);
        } catch (e) {
            console.error("Failed to initialize signer:", e);
            throw new Error("Could not initialize signer from FARCASTER_BOT_PRIVATE_KEY.");
        }
    }
    return botSigner;
}

/**
 * Submits a cast message to the Farcaster Hub.
 *
 * @param text The text content of the cast.
 * @param embeds Optional array of embeds (e.g., URLs).
 * @param parentCastId Optional CastId object { fid: number; hash: Uint8Array } to reply to.
 * @returns A promise that resolves to the Hub's response or rejects on error.
 */
export async function submitCast(
    text: string,
    embeds?: Embed[],
    parentCastId?: CastId
): Promise<HubAsyncResult<Message>> {
    const client = getClient();
    const signer = getSigner();

    const dataOptions = {
        fid: BOT_FID,
        network: FarcasterNetwork.MAINNET, // Or FarcasterNetwork.TESTNET if needed
    };

    const castBody: CastAddBody = {
        type: MessageType.CAST_ADD,
        text: text,
        embeds: embeds ?? [],
        embedsDeprecated: [],
        mentions: [],
        mentionsPositions: [],
        parentCastId: parentCastId,
        parentUrl: undefined,
    };

    console.log(`Attempting to submit cast: "${text.substring(0, 50)}..."`);

    const castAddResult = await makeCastAdd(castBody, dataOptions, signer);

    if (castAddResult.isErr()) {
        console.error("Failed to create CastAdd message:", castAddResult.error);
        return castAddResult; // Propagate the error result
    }

    const message = castAddResult.value;

    const hubResult = await client.submitMessage(message);

    if (hubResult.isErr()) {
        console.error("Failed to submit message to Hub:", hubResult.error);
    } else {
        console.log("Successfully submitted cast to Hub.");
    }

    return hubResult;
}

// Optional: Function to close the client if needed (e.g., in serverless envs?)
// export function closeClient() {
//     if (hubClient) {
//         console.log("Closing Hub client connection.");
//         hubClient.close();
//         hubClient = undefined;
//     }
// } 