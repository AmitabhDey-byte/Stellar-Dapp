export const config = {
  rpcUrl: import.meta.env.VITE_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org",
  networkPassphrase:
    import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  contractId: import.meta.env.VITE_ESCROW_CONTRACT_ID ?? "",
  tokenContractId: import.meta.env.VITE_TOKEN_CONTRACT_ID ?? ""
};

export function isConfigured() {
  return config.contractId.length > 0 && !config.contractId.startsWith("REPLACE");
}
