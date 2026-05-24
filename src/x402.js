export const PAYMENT_HEADER = 'x-payment'

export function paymentRequired({ amount = '0.10', asset = 'USDC', network = 'testnet', payTo = 'configured-by-deployer' } = {}) {
  return new Response(JSON.stringify({
    error: 'payment_required',
    x402Version: 1,
    accepts: [{ scheme: 'exact', amount, asset, network, payTo }],
  }), {
    status: 402,
    headers: { 'content-type': 'application/json', 'x-accepts-payment': 'x402' },
  })
}

export function verifyPayment(request, env = {}) {
  const payment = request.headers.get(PAYMENT_HEADER)
  if (!payment) return { ok: false, reason: 'missing x-payment header' }

  // Reference implementation deliberately uses a mock verifier so the repo is
  // runnable without private keys or payment-provider credentials. Production
  // deployments must replace this boundary with an x402 facilitator/verifier.
  // Mock proofs are accepted only when explicitly enabled by configuration.
  if (payment.startsWith('mock-paid:')) {
    if (env.ALLOW_MOCK_PAYMENTS !== 'true') {
      return { ok: false, reason: 'mock payment verifier disabled' }
    }
    return { ok: true, payer: payment.slice('mock-paid:'.length) || 'anonymous' }
  }
  return { ok: false, reason: 'payment proof rejected by mock verifier' }
}
