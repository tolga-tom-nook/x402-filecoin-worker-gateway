# x402-to-Filecoin Storage Gateway on Cloudflare Workers

Reference implementation for a paywalled storage gateway: an HTTP client receives a `402 Payment Required` challenge, submits an x402-style payment proof, receives a short-lived upload session, then stores object metadata through a Filecoin/IPFS-compatible adapter boundary.

This repo is an early proof artifact for Filecoin devgrant proposal [filecoin-project/devgrants#2113](https://github.com/filecoin-project/devgrants/issues/2113). It is intentionally non-custodial: no private keys, seed phrases, or production storage credentials are committed or required for local tests.

## What works now

- Cloudflare Worker-style `fetch` handler.
- `POST /upload-session` returns `402 Payment Required` without an `x-payment` proof.
- Mock paid flow with `x-payment: mock-paid:<payer>`.
- Short-lived upload session tokens.
- Local in-memory Filecoin/IPFS adapter boundary.
- Metadata persistence tests using Node's built-in test runner.

## Run locally

```bash
npm install
npm test
```

Optional Worker dev server:

```bash
npm run start
```

## API sketch

```bash
# Payment challenge
curl -i -X POST http://localhost:8787/upload-session

# Mock paid session
curl -s -X POST http://localhost:8787/upload-session \
  -H 'x-payment: mock-paid:demo-agent'

# Upload after receiving uploadSession.token
curl -s -X POST http://localhost:8787/objects \
  -H 'x-upload-session: <token>' \
  -H 'content-type: text/plain' \
  --data 'hello filecoin'
```

## Production adapter boundary

Production deployments should replace the mock verifier and `InMemoryStorageAdapter` with:

1. an x402 facilitator/verifier for the selected chain/asset;
2. a Filecoin/IPFS-compatible storage provider API;
3. durable metadata storage for `cid`, payer, byte allowance, timestamps, and audit details;
4. secret handling via Worker bindings, never source control.

## Non-goals

- No custody of user funds.
- No private-key handling in the Worker.
- No trading, gambling, or token speculation.
- No production storage operation in this proof artifact.

## License

MIT/Apache-2 dual license intended for grant deliverables.
