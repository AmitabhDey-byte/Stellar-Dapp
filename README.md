deployed link: https://riseinproject.netlify.app/

Contract id: CDFISOTR7RO4KEVV55WPVXYFLOERV4NTKDLQY3YBOEY6AICXW5TAJKNV

<img width="1919" height="972" alt="Screenshot 2026-05-01 113742" src="https://github.com/user-attachments/assets/9725a047-7499-4d99-a6ab-5784b4232b41" />

<img width="1910" height="859" alt="Screenshot 2026-05-01 114749" src="https://github.com/user-attachments/assets/908169bc-e80e-4f89-8517-d23c356be13b" />

Demo Video Link:  https://drive.google.com/file/d/1AWCM5_P-6mkAKbH-M3JsOS8D2ATmWX0y/view?usp=sharing

# Stellar Service Escrow

Stellar Service Escrow is a Soroban and Freighter mini-dApp for small service payments. A client funds a job into a Soroban escrow contract, the provider can see that payment is reserved before starting work, and the client can release or cancel the escrow from Freighter.

## Real-world use case

Small freelancers, repair shops, local service providers, and community contractors often have the same trust problem: the provider wants proof that the client can pay, while the client does not want to pay before the work is delivered. This dApp creates a simple escrow workflow for that situation.

Stellar adds value because payments settle quickly, transaction fees are low, and Soroban can enforce the escrow rules transparently. The contract holds tokenized value until the client signs a release or cancellation transaction. Freighter gives users a familiar wallet signing flow without private keys touching the app.

## Features

- Freighter wallet connection on Stellar testnet
- Soroban smart contract for funded service jobs
- Create escrow, release funds, and cancel/refund flows
- Loading states for wallet connection and transactions
- Local job cache so the dashboard stays useful after refresh
- Frontend unit tests for validation, formatting, and caching
- Soroban contract tests for create, release, cancel, and validation rules

## Tech stack

- React, TypeScript, Vite
- Soroban SDK for Rust
- Stellar JavaScript SDK
- Freighter API
- Vitest and Testing Library

## Project structure

```text
contracts/service-escrow   Soroban escrow contract and Rust tests
src/lib                    Stellar, cache, formatting, and validation helpers
src/App.tsx                Main dApp interface
src/*.test.ts              Frontend tests
```

## Prerequisites

- Node.js 22 or newer
- Rust 1.85 or newer
- Stellar CLI 25 or newer
- Freighter browser extension configured for testnet

## Local setup

```bash
npm install
cp .env.example .env
npm run contracts:test
npm test
npm run build
npm run dev
```

Update `.env` after deploying the Soroban contract:

```bash
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_ESCROW_CONTRACT_ID=your_deployed_escrow_contract_id
VITE_TOKEN_CONTRACT_ID=your_testnet_token_contract_id
```

## Contract workflow

1. `create_job(client, provider, token, amount, title)`
   - Requires client authorization.
   - Transfers the token amount from the client into the contract.
   - Stores the job as `Funded`.

2. `release(job_id)`
   - Requires client authorization.
   - Transfers escrowed tokens from the contract to the provider.
   - Marks the job as `Released`.

3. `cancel(job_id)`
   - Requires client authorization.
   - Refunds escrowed tokens from the contract to the client.
   - Marks the job as `Cancelled`.

4. `get_job(job_id)`
   - Returns job details for display or verification.

## Build and deploy the contract

```bash
npm run contracts:build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/service_escrow.wasm \
  --source your_stellar_cli_identity \
  --network testnet
```


For the token field, use a Stellar asset contract ID on testnet. You can deploy or use a test asset contract, then paste the token contract address into `VITE_TOKEN_CONTRACT_ID`.

## Tests

Run the frontend tests:

```bash
npm test
```

Run the Soroban contract tests:

```bash
npm run contracts:test
```

Current expected coverage:

- Token amount parsing and formatting
- Form validation before wallet signing
- Local cache upsert and settlement updates
- Contract escrow funding
- Contract release to provider
- Contract cancellation/refund
- Contract invalid amount rejection

## Submission links

Replace these before submitting:

- Live demo: https://your-deployment-url.example
- Demo video: https://your-demo-video-url.example
- Test output screenshot: `docs/test-output.png`

## Demo video outline

Keep the video close to one minute:

1. Show the problem: service work needs payment trust.
2. Connect Freighter on testnet.
3. Create a job with provider address, token contract, and amount.
4. Show loading state and transaction confirmation.
5. Release or cancel the funded job.
6. Show tests passing in the terminal.

## Suggested meaningful commits

If you want the repository history to match the Orange Belt checklist, use at least three focused commits:

```bash
git add contracts/service-escrow
git commit -m "feat: add Soroban service escrow contract"

git add src package.json vite.config.ts tsconfig*.json eslint.config.js index.html
git commit -m "feat: build Freighter escrow dashboard"

git add README.md .env.example .gitignore
git commit -m "docs: document escrow dapp submission"
```

## Notes for reviewers

This project is intentionally narrow: it solves payment trust for small service jobs. It is not a marketplace. Stellar is used for wallet identity, low-cost token settlement, and Soroban-enforced escrow rules.
