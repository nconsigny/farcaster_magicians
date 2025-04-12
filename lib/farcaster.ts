import {
  getSSLHubRpcClient,
  getInsecureHubRpcClient,
  makeCastAdd,
  NobleEd25519Signer,
  FarcasterNetwork,
  HubRpcClient
} from "@farcaster/hub-web";
import { hexToBytes } from "@noble/hashes/utils";

// --- Configuration --- Get these from environment variables
const HUB_URL = process.env.FARCASTER_HUB_URL || ""; // e.g., nemes.farcaster.xyz:2283 or IP address
const HUB_SSL = process.env.FARCASTER_HUB_SSL === "true"; // Set to true if hub uses SSL
const BOT_ACCOUNT_FID = parseInt(process.env.FARCASTER_BOT_FID || "0");
// IMPORTANT: Keep your private key secure! Use environment variables or a secret manager.
const BOT_ACCOUNT_PRIVATE_KEY_HEX = process.env.FARCASTER_BOT_PRIVATE_KEY || "";
// --- End Configuration ---

if (!BOT_ACCOUNT_FID || !BOT_ACCOUNT_PRIVATE_KEY_HEX || !HUB_URL) {
  console.warn(
    "Missing Farcaster environment variables (FARCASTER_HUB_URL, FARCASTER_BOT_FID, FARCASTER_BOT_PRIVATE_KEY)"
  );
  // Depending on usage, you might throw an error here instead
}

let hubClient: HubRpcClient | undefined;
let ed25519Signer: NobleEd25519Signer | undefined;

if (BOT_ACCOUNT_PRIVATE_KEY_HEX) {
    try {
        const privateKeyBytes = hexToBytes(BOT_ACCOUNT_PRIVATE_KEY_HEX);
        ed25519Signer = new NobleEd25519Signer(privateKeyBytes);
    } catch (error) {
        console.error("Failed to initialize Farcaster signer:", error);
    }
}

if (HUB_URL) {
    hubClient = HUB_SSL
        ? getSSLHubRpcClient(HUB_URL)
        : getInsecureHubRpcClient(HUB_URL);
}

/**
 * Posts a cast to Farcaster.
 * @param text The text content of the cast.
 * @param embeds Optional array of embed URLs (e.g., the Frame URL).
 * @param parentCastId Optional parent cast details for replying.
 * @returns The result from the Hub API.
 */
export async function postCast(text: string, embeds?: { url: string }[], parentCastId?: { fid: number; hash: string }) {
  if (!hubClient || !ed25519Signer || !BOT_ACCOUNT_FID) {
    throw new Error(
      "Farcaster client not initialized. Check environment variables."
    );
  }

  const dataOptions = {
    fid: BOT_ACCOUNT_FID,
    network: FarcasterNetwork.MAINNET, // Or TESTNET
  };

  const castAddBody = {
    text: text,
    embeds: embeds || [],
    mentions: [],
    mentionsPositions: [],
    parentUrl: parentCastId ? undefined : undefined, // TODO: Add parent URL support if needed
    parentCastId: parentCastId,
  };

  const castAddResult = await makeCastAdd(
    castAddBody,
    dataOptions,
    ed25519Signer
  );

  if (castAddResult.isErr()) {
      console.error("Failed to create cast message:", castAddResult.error);
      throw castAddResult.error;
  }

  const message = castAddResult.value;

  const result = await hubClient.submitMessage(message);

  if (result.isErr()) {
    console.error("Failed to submit cast to hub:", result.error);
    throw result.error;
  }

  console.log("Successfully submitted cast:", result.value);
  return result;
} 