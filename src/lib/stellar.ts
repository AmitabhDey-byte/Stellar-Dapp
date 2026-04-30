import {
  BASE_FEE,
  Contract,
  Networks,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative
} from "@stellar/stellar-sdk";
import { rpc as StellarRpc } from "@stellar/stellar-sdk";
import { requestAccess, signTransaction } from "@stellar/freighter-api";
import { config } from "./config";
import { parseTokenAmount } from "./format";
import type { EscrowJob } from "./types";

const CONTRACT_METHODS = {
  create: "create_job",
  release: "release",
  cancel: "cancel",
  get: "get_job"
};

export async function connectFreighter() {
  const result = await requestAccess();
  if (typeof result === "string") return result;
  if ("address" in result && result.address) return result.address;
  throw new Error("Freighter did not return a wallet address.");
}

export async function invokeCreateJob(input: {
  wallet: string;
  provider: string;
  token: string;
  amount: string;
  title: string;
}) {
  const result = await invokeContract({
    source: input.wallet,
    method: CONTRACT_METHODS.create,
    args: [
      nativeToScVal(input.wallet, { type: "address" }),
      nativeToScVal(input.provider.trim(), { type: "address" }),
      nativeToScVal(input.token.trim(), { type: "address" }),
      nativeToScVal(parseTokenAmount(input.amount), { type: "i128" }),
      nativeToScVal(input.title.trim(), { type: "string" })
    ]
  });

  return {
    id: Number(result.value),
    hash: result.hash
  };
}

export async function invokeRelease(wallet: string, id: number) {
  return invokeContract({
    source: wallet,
    method: CONTRACT_METHODS.release,
    args: [nativeToScVal(BigInt(id), { type: "u64" })]
  });
}

export async function invokeCancel(wallet: string, id: number) {
  return invokeContract({
    source: wallet,
    method: CONTRACT_METHODS.cancel,
    args: [nativeToScVal(BigInt(id), { type: "u64" })]
  });
}

export async function fetchJob(id: number): Promise<EscrowJob> {
  const result = await invokeContract({
    source: config.contractId,
    method: CONTRACT_METHODS.get,
    args: [nativeToScVal(BigInt(id), { type: "u64" })],
    readOnly: true
  });

  return result.value as EscrowJob;
}

async function invokeContract(input: {
  source: string;
  method: string;
  args: ReturnType<typeof nativeToScVal>[];
  readOnly?: boolean;
}) {
  if (!config.contractId) {
    throw new Error("Missing VITE_ESCROW_CONTRACT_ID.");
  }

  const server = new StellarRpc.Server(config.rpcUrl);
  const contract = new Contract(config.contractId);
  const account = await server.getAccount(input.source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase || Networks.TESTNET
  })
    .addOperation(contract.call(input.method, ...input.args))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(tx);

  if (input.readOnly) {
    const simulation = await server.simulateTransaction(prepared);
    if (StellarRpc.Api.isSimulationError(simulation)) {
      throw new Error(simulation.error);
    }
    if (!simulation.result?.retval) {
      throw new Error("Simulation did not return a contract value.");
    }
    return { value: scValToNative(simulation.result.retval), hash: undefined };
  }

  const signedXdr = await signTransaction(prepared.toXDR(), {
    networkPassphrase: config.networkPassphrase || Networks.TESTNET,
    address: input.source
  });
  const signedTx = new Transaction(
    typeof signedXdr === "string" ? signedXdr : signedXdr.signedTxXdr,
    config.networkPassphrase || Networks.TESTNET
  );
  const sent = await server.sendTransaction(signedTx);

  if (sent.status === "ERROR") {
    throw new Error(sent.errorResult?.toString() ?? "Transaction failed.");
  }

  const final = await pollTransaction(server, sent.hash);
  const value = final.returnValue ? scValToNative(final.returnValue) : undefined;
  return { value, hash: sent.hash };
}

async function pollTransaction(server: StellarRpc.Server, hash: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await server.getTransaction(hash);
    if (response.status === "SUCCESS") return response;
    if (response.status === "FAILED") {
      throw new Error("Transaction failed on Stellar testnet.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Timed out waiting for transaction confirmation.");
}
