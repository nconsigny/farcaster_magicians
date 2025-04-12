import 'dotenv/config'; // Load .env file
import { createPublicClient, http, Address } from 'viem';
import { optimism } from 'viem/chains';
import { idRegistryABI } from '@farcaster/hub-web';

// --- CONFIGURATION ---
// Use the IdRegistry address confirmed to hold the FID record
const ID_REGISTRY_ADDRESS: Address = '0x00000000fc6c5f01fc30151999387bb99a9f489b';

// List of addresses to check - *can be overridden by command line arguments*
let ADDRESSES_TO_CHECK: Address[] = [
    // Default list if no args provided (can be empty)
    // '0x36e67f7b38744ea9e24d0a74d30e081eb965b60a',
];
const OP_RPC_URL = process.env.OP_RPC_URL;
// --- END CONFIGURATION ---

// Override addresses to check with command line arguments if provided
const args = process.argv.slice(2); // Remove 'node' and script path
if (args.length > 0) {
    ADDRESSES_TO_CHECK = args as Address[];
}

async function checkFids() {
  if (!OP_RPC_URL) {
      console.error("Missing OP_RPC_URL in .env file.");
      return;
  }
  if (ADDRESSES_TO_CHECK.length === 0) {
      console.error("No addresses provided to check. Either add defaults in the script or pass as command line arguments.");
      return;
  }

  const publicClient = createPublicClient({
    chain: optimism,
    transport: http(OP_RPC_URL),
  });

  console.log(`Using IdRegistry: ${ID_REGISTRY_ADDRESS}`);

  for (const addressToCheck of ADDRESSES_TO_CHECK) {
      // Basic address validation
      if (!/^0x[a-fA-F0-9]{40}$/.test(addressToCheck)) {
          console.warn(`\nSkipping invalid address format: ${addressToCheck}`);
          continue;
      }
      console.log(`\nChecking FID for address: ${addressToCheck}`);
      try {
          const fid = await publicClient.readContract({
              address: ID_REGISTRY_ADDRESS,
              abi: idRegistryABI,
              functionName: 'idOf',
              args: [addressToCheck],
            });

          const fidNumber = parseInt(fid.toString());

          if (fidNumber > 0) {
              console.log(`✅ Address ${addressToCheck} owns FID: ${fidNumber}`);
          } else {
              console.log(`ℹ️ Address ${addressToCheck} does not own an FID according to this IdRegistry.`);
          }

      } catch (error) {
          console.error(`Error querying IdRegistry for ${addressToCheck}:`, error);
      }
  }
}

checkFids(); 