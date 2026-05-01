import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { readCachedJobs, updateCachedJobStatus, upsertCachedJob } from "./lib/cache";
import { config, isConfigured } from "./lib/config";
import { formatTokenAmount, parseTokenAmount, shortAddress, validateJobInput } from "./lib/format";
import { connectFreighter, invokeCancel, invokeCreateJob, invokeRelease } from "./lib/stellar";
import type { EscrowJob, TxState, WalletState } from "./lib/types";

const initialTx: TxState = { kind: "idle" };

function App() {
  const [wallet, setWallet] = useState<WalletState>({ connected: false, address: "" });
  const [jobs, setJobs] = useState<EscrowJob[]>(() => readCachedJobs());
  const [tx, setTx] = useState<TxState>(initialTx);
  const [form, setForm] = useState({
    title: "Website accessibility audit",
    provider: "",
    amount: "25",
    token: config.tokenContractId
  });

  const fundedTotal = useMemo(
    () =>
      jobs
        .filter((job) => job.status === "Funded")
        .reduce((sum, job) => sum + BigInt(job.amount), 0n),
    [jobs]
  );
  const validation = validateJobInput(form);
  const canSubmit = wallet.connected && !validation && form.token.trim().length > 0 && tx.kind !== "pending";

  async function connect() {
    try {
      setTx({ kind: "pending", label: "Connecting Freighter" });
      const address = await connectFreighter();
      setWallet({ connected: true, address });
      setTx({ kind: "success", label: "Wallet connected" });
    } catch (error) {
      setTx({ kind: "error", label: readableError(error) });
    }
  }

  async function createJob() {
    if (!canSubmit) return;
    try {
      setTx({ kind: "pending", label: "Funding escrow on Stellar" });
      const result = await invokeCreateJob({
        wallet: wallet.address,
        provider: form.provider,
        token: form.token,
        amount: form.amount,
        title: form.title
      });
      const job: EscrowJob = {
        id: result.id,
        title: form.title.trim(),
        client: wallet.address,
        provider: form.provider.trim(),
        token: form.token.trim(),
        amount: parseTokenAmount(form.amount).toString(),
        status: "Funded"
      };
      setJobs(upsertCachedJob(job));
      setTx({ kind: "success", label: `Job #${result.id} funded`, hash: result.hash });
    } catch (error) {
      setTx({ kind: "error", label: readableError(error) });
    }
  }

  async function settle(id: number, action: "release" | "cancel") {
    try {
      setTx({
        kind: "pending",
        label: action === "release" ? "Releasing escrow" : "Cancelling escrow"
      });
      const result = action === "release" ? await invokeRelease(wallet.address, id) : await invokeCancel(wallet.address, id);
      const nextStatus = action === "release" ? "Released" : "Cancelled";
      setJobs(updateCachedJobStatus(id, nextStatus));
      setTx({ kind: "success", label: `Job #${id} ${nextStatus.toLowerCase()}`, hash: result.hash });
    } catch (error) {
      setTx({ kind: "error", label: readableError(error) });
    }
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Stellar testnet mini-dApp</p>
          <h1>Service Escrow</h1>
        </div>
        <button className="walletButton" onClick={connect} disabled={tx.kind === "pending"}>
          <Wallet size={18} />
          {wallet.connected ? shortAddress(wallet.address) : "Connect Freighter"}
        </button>
      </section>

      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">For freelance work, repair deposits, and local services</p>
          <h2>Hold payment in Soroban until the work is approved.</h2>
          <p>
            Clients lock tokenized payment in a smart contract. Providers see that funds are
            reserved before starting, and the client can release or cancel from Freighter.
          </p>
        </div>
        <div className="metrics">
          <Metric icon={<LockKeyhole />} label="Active escrow" value={`${formatTokenAmount(fundedTotal)} tokens`} />
          <Metric icon={<ClipboardList />} label="Cached jobs" value={jobs.length.toString()} />
          <Metric icon={<ShieldCheck />} label="Network" value="Stellar testnet" />
        </div>
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Create funded job</p>
              <h3>New escrow</h3>
            </div>
            {!isConfigured() && (
              <span className="pill warning">
                <AlertCircle size={14} />
                Contract env needed
              </span>
            )}
          </div>

          <label>
            Service title
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Landing page audit"
            />
          </label>
          <label>
            Provider Stellar address
            <input
              value={form.provider}
              onChange={(event) => setForm({ ...form, provider: event.target.value })}
              placeholder="G..."
            />
          </label>
          <div className="gridTwo">
            <label>
              Amount
              <input
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                placeholder="25"
              />
            </label>
            <label>
              Token contract
              <input
                value={form.token}
                onChange={(event) => setForm({ ...form, token: event.target.value })}
                placeholder="C..."
              />
            </label>
          </div>
          {validation && <p className="hint">{validation}</p>}
          <button className="primary" onClick={createJob} disabled={!canSubmit}>
            <CircleDollarSign size={18} />
            Fund escrow
          </button>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Progress</p>
              <h3>Activity</h3>
            </div>
            <StatusBadge tx={tx} />
          </div>
          <div className="activity">
            {tx.kind === "idle" && <p>Connect Freighter and create a job to start.</p>}
            {tx.kind === "pending" && (
              <p>
                <Loader2 className="spin" size={17} />
                {tx.label}
              </p>
            )}
            {tx.kind === "success" && (
              <p>
                <CheckCircle2 size={17} />
                {tx.label}
              </p>
            )}
            {tx.kind === "error" && (
              <p>
                <AlertCircle size={17} />
                {tx.label}
              </p>
            )}
            {"hash" in tx && tx.hash && (
              <a href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`} target="_blank" rel="noreferrer">
                View transaction
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="jobs">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Cached locally for quick review</p>
            <h3>Escrow jobs</h3>
          </div>
          <button className="iconButton" onClick={() => setJobs(readCachedJobs())} title="Refresh cached jobs">
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="jobGrid">
          {jobs.length === 0 && <p className="empty">No jobs yet.</p>}
          {jobs.map((job) => (
            <article className="jobCard" key={job.id}>
              <div className="jobTop">
                <strong>#{job.id} {job.title}</strong>
                <span className={`status ${job.status.toLowerCase()}`}>{job.status}</span>
              </div>
              <dl>
                <div>
                  <dt>Provider</dt>
                  <dd>{shortAddress(job.provider)}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatTokenAmount(job.amount)}</dd>
                </div>
              </dl>
              <div className="actions">
                <button disabled={!wallet.connected || job.status !== "Funded"} onClick={() => settle(job.id, "release")}>
                  Release
                </button>
                <button disabled={!wallet.connected || job.status !== "Funded"} onClick={() => settle(job.id, "cancel")}>
                  Cancel
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ tx }: { tx: TxState }) {
  return <span className={`pill ${tx.kind}`}>{tx.kind}</span>;
}

function readableError(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    const message = String((error as { message?: unknown }).message);
    if (message.includes("404")) {
      return "This Stellar testnet account was not found. Fund the connected Freighter wallet with Friendbot, then retry.";
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default App;
