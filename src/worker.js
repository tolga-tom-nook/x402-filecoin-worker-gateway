import { InMemoryStorageAdapter } from './storage.js'
import { paymentRequired, verifyPayment } from './x402.js'

const defaultStorage = new InMemoryStorageAdapter()

export function createWorker({ storage = defaultStorage } = {}) {
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url)
      if (request.method === 'GET' && url.pathname === '/health') {
        return Response.json({ ok: true, service: 'x402-filecoin-worker-gateway' })
      }

      if (request.method === 'POST' && url.pathname === '/upload-session') {
        const payment = verifyPayment(request)
        if (!payment.ok) {
          return paymentRequired({
            amount: env.X402_AMOUNT || '0.10',
            asset: env.X402_ASSET || 'USDC',
            network: env.X402_NETWORK || 'testnet',
            payTo: env.X402_PAY_TO || 'configured-by-deployer',
          })
        }
        const session = await storage.createSession({ payer: payment.payer, maxBytes: Number(env.MAX_UPLOAD_BYTES || 1048576) })
        return Response.json({ uploadSession: session })
      }

      if (request.method === 'POST' && url.pathname === '/objects') {
        const token = request.headers.get('x-upload-session')
        if (!token) return Response.json({ error: 'missing upload session' }, { status: 401 })
        const bytes = new Uint8Array(await request.arrayBuffer())
        try {
          const metadata = await storage.putObject({ token, bytes, contentType: request.headers.get('content-type') || undefined })
          return Response.json({ object: metadata }, { status: 201 })
        } catch (err) {
          return Response.json({ error: err.message }, { status: 400 })
        }
      }

      return Response.json({ error: 'not found' }, { status: 404 })
    },
  }
}

export default createWorker()
