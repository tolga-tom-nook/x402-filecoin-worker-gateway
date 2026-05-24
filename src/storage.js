import { createHash, randomUUID } from 'node:crypto'

export class InMemoryStorageAdapter {
  constructor() {
    this.objects = new Map()
    this.sessions = new Map()
  }

  async createSession({ payer, maxBytes, ttlSeconds = 300 }) {
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    this.sessions.set(token, { payer, maxBytes, expiresAt })
    return { token, expiresAt, maxBytes }
  }

  async putObject({ token, bytes, contentType = 'application/octet-stream' }) {
    const session = this.sessions.get(token)
    if (!session) throw new Error('invalid upload session')
    if (new Date(session.expiresAt).getTime() < Date.now()) throw new Error('expired upload session')
    if (bytes.byteLength > session.maxBytes) throw new Error('object exceeds paid byte allowance')

    const cid = `mock-bafy-${createHash('sha256').update(bytes).digest('hex').slice(0, 48)}`
    const metadata = {
      cid,
      size: bytes.byteLength,
      contentType,
      payer: session.payer,
      storedAt: new Date().toISOString(),
    }
    this.objects.set(cid, { bytes, metadata })
    return metadata
  }
}
