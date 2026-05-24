import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorker } from '../src/worker.js'
import { InMemoryStorageAdapter } from '../src/storage.js'

function worker() { return createWorker({ storage: new InMemoryStorageAdapter() }) }

test('health endpoint reports ready', async () => {
  const res = await worker().fetch(new Request('https://example.test/health'))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).ok, true)
})

test('upload-session returns 402 without payment proof', async () => {
  const res = await worker().fetch(new Request('https://example.test/upload-session', { method: 'POST' }))
  assert.equal(res.status, 402)
  const body = await res.json()
  assert.equal(body.error, 'payment_required')
  assert.equal(res.headers.get('x-accepts-payment'), 'x402')
})

test('paid flow mints session and stores object metadata', async () => {
  const w = worker()
  const sessionRes = await w.fetch(new Request('https://example.test/upload-session', {
    method: 'POST',
    headers: { 'x-payment': 'mock-paid:agent-demo' },
  }))
  assert.equal(sessionRes.status, 200)
  const { uploadSession } = await sessionRes.json()
  assert.ok(uploadSession.token)

  const objectRes = await w.fetch(new Request('https://example.test/objects', {
    method: 'POST',
    headers: { 'x-upload-session': uploadSession.token, 'content-type': 'text/plain' },
    body: 'hello filecoin builders',
  }))
  assert.equal(objectRes.status, 201)
  const { object } = await objectRes.json()
  assert.match(object.cid, /^mock-bafy-/)
  assert.equal(object.payer, 'agent-demo')
  assert.equal(object.size, 'hello filecoin builders'.length)
})

test('object upload fails without upload session', async () => {
  const res = await worker().fetch(new Request('https://example.test/objects', { method: 'POST', body: 'x' }))
  assert.equal(res.status, 401)
})
