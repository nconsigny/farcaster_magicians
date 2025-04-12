import 'dotenv/config'; // Load .env file
import {
    createWalletClient,
    http,
    publicActions,
    Address,
    Hex,
    zeroAddress,
    decodeEventLog
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import {
    ID_GATEWAY_ADDRESS,
    idGatewayABI,
    ID_REGISTRY_ADDRESS, // Using the standard one for event decoding
    idRegistryABI
} from '@farcaster/hub-web';

// --- CONFIGURATION (Loaded from .env) ---
const REGISTERING_ACCOUNT_PRIVATE_KEY = process.env.CUSTODY_ACCOUNT_PRIVATE_KEY as Hex | undefined;

// Optional: Set a recovery address for the new FID. Can be set in .env or keep default.
const RECOVERY_ADDRESS = (process.env.RECOVERY_ADDRESS as Address) || zeroAddress;

const OP_RPC_URL = process.env.OP_RPC_URL;

// Use the standard Farcaster contract addresses
const IdGateway = {
    abi: idGatewayABI,
    address: ID_GATEWAY_ADDRESS,
    chain: optimism,
};
const IdContract = {
    // Use the specific registry where custodyOf was checked if needed for idOf, 
    // but standard one should work for event decoding after registration via gateway.
    abi: idRegistryABI,
    address: ID_REGISTRY_ADDRESS, // Standard registry address for event topic
    chain: optimism,
};
// --- END CONFIGURATION ---

async function registerNewFid() {
    // Validate required environment variables
    if (!REGISTERING_ACCOUNT_PRIVATE_KEY) {
        console.error("Missing CUSTODY_ACCOUNT_PRIVATE_KEY in .env file.");
        return;
    }
    if (!OP_RPC_URL) {
        console.error("Missing OP_RPC_URL in .env file.");
        return;
    }
    // Validate key formats AFTER checking they exist
    if (REGISTERING_ACCOUNT_PRIVATE_KEY.length !== 66) {
        console.error("Invalid CUSTODY_ACCOUNT_PRIVATE_KEY format in .env file.");
        return;
    }

    // 1. Setup Wallet Client for the registering address
    const account = privateKeyToAccount(REGISTERING_ACCOUNT_PRIVATE_KEY);
    const walletClient = createWalletClient({
        account,
        chain: optimism,
        transport: http(OP_RPC_URL),
    }).extend(publicActions);

    console.log(`Using address ${account.address} to register FID.`);
    if (RECOVERY_ADDRESS !== zeroAddress) {
      console.log(`Setting recovery address to: ${RECOVERY_ADDRESS}`);
    }

    // 2. Check if address already has an FID (using the standard registry for this check)
    // Note: We previously checked 0x...489b and it didn't own one.
    // Checking standard registry 0x...B216 just in case.
    try {
        console.log("Checking if address already owns an FID on standard registry...");
        const existingFid = await walletClient.readContract({
            address: ID_REGISTRY_ADDRESS, // Check standard registry
            abi: idRegistryABI,
            functionName: 'idOf',
            args: [account.address],
        }) as bigint;

        if (existingFid > 0n) {
            console.log(`✅ Address ${account.address} already owns FID: ${existingFid.toString()} on the standard registry. Exiting.`);
            // If it already exists, we print it and maybe update .env if needed.
            console.log(`Consider setting FARCASTER_BOT_FID=${existingFid.toString()} in your .env file.`);
            return parseInt(existingFid.toString());
        }
         console.log(`✅ Address does not own an FID on the standard registry. Proceeding with registration.`);
    } catch (err) {
        console.error("Error checking existing FID:", err);
        return;
    }

    // 3. Check Price and Balance
    let price: bigint;
    try {
        console.log("Fetching storage price...");
        price = await walletClient.readContract({
            ...IdGateway,
            functionName: 'price',
        }) as bigint;
        console.log(`Current storage price: ${price} wei`);

        const balance = await walletClient.getBalance({ address: account.address });
        console.log(`Current balance: ${balance} wei`);

        if (balance < price) {
            throw new Error(
                `Insufficient balance to rent storage. Required: ${price}, Balance: ${balance}`
            );
        }
    } catch (err) { 
        console.error("Error checking price or balance:", err);
        return;
    }

    // 4. Simulate and Register
    try {
        console.log("Simulating registration transaction...");
        const { request: registerRequest } = await walletClient.simulateContract({
            ...IdGateway,
            account: account, // Ensure account is passed
            functionName: 'register',
            args: [RECOVERY_ADDRESS],
            value: price, // Send the required ETH value
        });

        console.log("Simulation successful. Sending registration transaction...");
        const registerTxHash = await walletClient.writeContract(registerRequest);
        console.log(`Transaction sent: https://optimistic.etherscan.io/tx/${registerTxHash}`);

        console.log("Waiting for transaction receipt...");
        const registerTxReceipt = await walletClient.waitForTransactionReceipt({
            hash: registerTxHash,
        });

        console.log("Transaction confirmed:", registerTxReceipt.status);

        if (registerTxReceipt.status !== 'success') {
            throw new Error("Registration transaction failed.");
        }

        // 5. Extract FID from Logs
        console.log("Extracting FID from transaction logs...");
        let newFid: number | null = null;
        for (const log of registerTxReceipt.logs) {
             try {
                 // Attempt to decode log using IdRegistry ABI
                 const decodedLog = decodeEventLog({
                     abi: idRegistryABI, // Use standard ABI for Register event
                     data: log.data,
                     topics: log.topics,
                 });

                 // Check if it's the Register event
                 if (decodedLog.eventName === 'Register') {
                    newFid = parseInt(decodedLog.args['id'].toString());
                    console.log(`✅ Successfully registered and extracted new FID: ${newFid}`);
                    console.log(`IMPORTANT: Set FARCASTER_BOT_FID=${newFid} in your .env file.`);
                    break; // Exit loop once FID is found
                 }
             } catch (e) {
                 // Ignore logs that don't match the Register event signature
             }
         }

        if (newFid === null) {
            console.error("Could not find Register event log to extract FID. Check the transaction on Etherscan.");
        }
        return newFid;

    } catch (err) {
        console.error('Error during registration transaction:', err);
    }
}

registerNewFid(); 