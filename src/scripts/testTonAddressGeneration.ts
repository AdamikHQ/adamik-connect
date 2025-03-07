import * as dotenv from "dotenv";
import * as path from "path";
import {
  AdamikCurve,
  AdamikHashFunction,
  AdamikSignatureFormat,
} from "../adamik/types";
import { LocalSigner } from "../signers/LocalSigner";
import { errorTerminal, infoTerminal, italicInfoTerminal } from "../utils";
import { encodePubKeyToAddress } from "../adamik/encodePubkeyToAddress";
import { ethers } from "ethers";
// Use require for TonWeb packages
const TonWeb = require("tonweb");
const tonMnemonic = require("tonweb-mnemonic");

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testTonAddressGeneration() {
  console.log("\n🔑 Starting TON Address Generation Test\n");

  // First verify environment
  if (!process.env.UNSECURE_LOCAL_SEED) {
    errorTerminal("UNSECURE_LOCAL_SEED is not set in .env.local");
    return;
  }

  infoTerminal("✓ Environment loaded");

  // Hardcode TON chain configuration
  const tonConfig = {
    chainId: "ton",
    signerSpec: {
      curve: AdamikCurve.ED25519,
      hashFunction: AdamikHashFunction.SHA256,
      signatureFormat: AdamikSignatureFormat.RS,
      coinType: "607",
    },
  };

  try {
    // Method 1: Using LocalSigner
    infoTerminal("\n📱 Method 1: Using LocalSigner");
    const signer = new LocalSigner(tonConfig.chainId, tonConfig.signerSpec);
    const pubkey = await signer.getPubkey();
    const address = await encodePubKeyToAddress(pubkey, tonConfig.chainId);

    console.log("Public Key (LocalSigner):", pubkey);
    console.log("Address (LocalSigner):", address);

    // Method 2: Using TonWeb
    infoTerminal("\n📱 Method 2: Using TonWeb");
    const words = process.env.UNSECURE_LOCAL_SEED!.split(" ");
    console.log("Number of words:", words.length);

    try {
      // Use ethers for sha256 since we know it works
      const seed = ethers
        .sha256(Buffer.from(process.env.UNSECURE_LOCAL_SEED!, "utf8"))
        .slice(2); // remove '0x' prefix

      const keyPair = TonWeb.utils.nacl.sign.keyPair.fromSeed(
        Buffer.from(seed, "hex").slice(0, 32)
      );
      const tonweb = new TonWeb();

      console.log(
        "Public Key (TonWeb):",
        TonWeb.utils.bytesToHex(keyPair.publicKey)
      );

      // Get different wallet versions
      const getWalletAddress = async (WalletClass: any, version: string) => {
        const wallet = new WalletClass(tonweb.provider, {
          publicKey: keyPair.publicKey,
        });
        const walletAddress = await wallet.getAddress();
        const formattedAddress = walletAddress
          .toString({ bounceable: true })
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
        console.log(`Address (${version}):`, formattedAddress);
        return formattedAddress;
      };

      await getWalletAddress(tonweb.wallet.all.v4R2, "v4R2"); // Latest version

      // Compare results
      infoTerminal("\n📊 Comparison Results:");
      await italicInfoTerminal(
        JSON.stringify(
          {
            localSigner: {
              publicKey: pubkey,
              address: address,
            },
            tonWeb: {
              publicKey: TonWeb.utils.bytesToHex(keyPair.publicKey),
              address: await getWalletAddress(tonweb.wallet.all.v4R2, "v4R2"),
            },
          },
          null,
          2
        )
      );
    } catch (error) {
      console.log("\n❌ Test failed");
      console.error("Error:", error);
    }
  } catch (error) {
    console.log("\n❌ Test failed");
    console.error("Error:", error);
  }
}

// Run the test with explicit error handling
infoTerminal("Starting TON address test...");
testTonAddressGeneration()
  .then(() => {
    infoTerminal("\n✨ Test completed");
    process.exit(0);
  })
  .catch((error) => {
    errorTerminal("\n💥 Fatal error:" + error);
    process.exit(1);
  });
