import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorker } from '../src/worker.js'
import { InMemoryStorageAdapter } from '../src/storage.js'

const env = { ALLOW_MOCK_PAYMENTS: 'true', MAX_UPLOAD_BYTES: '32' }
function worker() { return createWorker({ storage: new InMemoryStorageAdapter() }) }

async function createSession(w) {
  const sessionRes = await w.fetch(new Request('https://example.test/upload-session', {
    method: 'POST',
    headers: { 'x-payment': 'mock-paid:agent-demo' },
  }), env)
  assert.equal(sessionRes.status, 200)
  return (await sessionRes.json()).uploadSession
}

test('health endpoint reports ready', async () => {
  const res = await worker().fetch(new Request('https://example.test/health'))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).ok, true)
})

test('upload-session returns 402 without payment proof', async () => {
  const res = await worker().fetch(new Request('https://example.test/upload-session', { method: 'POST' }), env)
  assert.equal(res.status, 402)
  const body = await res.json()
  assert.equal(body.error, 'payment_required')
  assert.equal(res.headers.get('x-accepts-payment'), 'x402')
})

test('mock payments fail closed unless explicitly enabled', async () => {
  const res = await worker().fetch(new Request('https://example.test/upload-session', {
    method: 'POST',
    headers: { 'x-payment': 'mock-paid:agent-demo' },
  }))
  assert.equal(res.status, 402)
})

test('paid flow mints session and stores object metadata', async () => {
  const w = worker()
  const uploadSession = await createSession(w)
  assert.ok(uploadSession.token)

  const objectRes = await w.fetch(new Request('https://example.test/objects', {
    method: 'POST',
    headers: { 'x-upload-session': uploadSession.token, 'content-type': 'text/plain' },
    body: 'hello filecoin builders',
  }), env)
  assert.equal(objectRes.status, 201)
  const { object } = await objectRes.json()
  assert.match(object.cid, /^mock-bafy-/)
  assert.equal(object.payer, 'agent-demo')
  assert.equal(object.size, 'hello filecoin builders'.length)
})

test('upload session is single-use', async () => {
  const w = worker()
  const uploadSession = await createSession(w)

  const first = await w.fetch(new Request('https://example.test/objects', {
    method: 'POST',
    headers: { 'x-upload-session': uploadSession.token, 'content-type': 'text/plain' },
    body: 'first',
  }), env)
  assert.equal(first.status, 201)

  const second = await w.fetch(new Request('https://example.test/objects', {
    method: 'POST',
    headers: { 'x-upload-session': uploadSession.token, 'content-type': 'text/plain' },
    body: 'second',
  }), env)
  assert.equal(second.status, 400)
  assert.equal((await second.json()).error, 'upload session already used')
})

test('oversized upload is rejected before storage', async () => {
  const w = worker()
  const uploadSession = await createSession(w)

  const res = await w.fetch(new Request('https://example.test/objects', {
    method: 'POST',
    headers: {
      'x-upload-session': uploadSession.token,
      'content-type': 'text/plain',
      'content-length': '100',
    },
    body: 'this body is not read because content-length is too large',
  }), env)
  assert.equal(res.status, 413)
})

test('object upload fails without upload session', async () => {
  const res = await worker().fetch(new Request('https://example.test/objects', { method: 'POST', body: 'x' }), env)
  assert.equal(res.status, 401)
})
