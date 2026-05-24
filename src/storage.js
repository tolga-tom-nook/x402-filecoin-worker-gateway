function toHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export class InMemoryStorageAdapter {
  constructor() {
    this.objects = new Map()
    this.sessions = new Map()
  }

  async createSession({ payer, maxBytes, ttlSeconds = 300 }) {
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    this.sessions.set(token, { payer, maxBytes, expiresAt, used: false })
    return { token, expiresAt, maxBytes }
  }

  async putObject({ token, bytes, contentType = 'application/octet-stream' }) {
    const session = this.sessions.get(token)
    if (!session) throw new Error('invalid upload session')
    if (session.used) throw new Error('upload session already used')
    if (new Date(session.expiresAt).getTime() < Date.now()) throw new Error('expired upload session')
    if (bytes.byteLength > session.maxBytes) throw new Error('object exceeds paid byte allowance')

    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const cid = `mock-bafy-${toHex(new Uint8Array(digest)).slice(0, 48)}`
    const metadata = {
      cid,
      size: bytes.byteLength,
      contentType,
      payer: session.payer,
      storedAt: new Date().toISOString(),
    }
    session.used = true
    this.objects.set(cid, { bytes, metadata })
    return metadata
  }
}
