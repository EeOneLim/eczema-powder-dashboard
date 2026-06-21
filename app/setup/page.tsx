export default function SetupPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-lg w-full space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Connect Shopify</h1>
          <p className="text-sm text-gray-500 mt-1">
            This is a one-time setup to authorise the dashboard to read your Shopify orders.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Before clicking the button below, make sure you have added{' '}
          <strong>{process.env.NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback</strong>{' '}
          as a redirect URL in your Shopify Dev Dashboard app settings.
        </div>

        <a
          href="/api/auth/shopify"
          className="block w-full bg-indigo-600 text-white text-center py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Connect Shopify Store →
        </a>

        <p className="text-xs text-gray-400 text-center">
          You&apos;ll be redirected to Shopify to approve access, then brought back here with your token.
        </p>

        <div className="border-t border-gray-100 pt-4">
          <a href="/" className="text-sm text-indigo-600 hover:underline">← Back to dashboard</a>
        </div>
      </div>
    </div>
  )
}
