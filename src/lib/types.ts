export type JobStatus = "Funded" | "Released" | "Cancelled";

export type EscrowJob = {
  id: number;
  title: string;
  client: string;
  provider: string;
  token: string;
  amount: string;
  status: JobStatus;
};

export type WalletState = {
  connected: boolean;
  address: string;
};

export type TxState =
  | { kind: "idle" }
  | { kind: "pending"; label: string }
  | { kind: "success"; label: string; hash?: string }
  | { kind: "error"; label: string };
