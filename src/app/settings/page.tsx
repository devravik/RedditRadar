import Link from 'next/link'

export default function SettingsHubPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/settings/subreddits"
          className="block bg-white border rounded-lg p-5 hover:border-gray-400 transition-colors"
        >
          <h2 className="font-semibold text-base">Subreddits</h2>
          <p className="text-sm text-gray-500 mt-1">Manage monitored subreddits, toggle on/off, set fetch intervals</p>
        </Link>

        <Link
          href="/settings/filters"
          className="block bg-white border rounded-lg p-5 hover:border-gray-400 transition-colors"
        >
          <h2 className="font-semibold text-base">Filter Words</h2>
          <p className="text-sm text-gray-500 mt-1">Block posts containing specific keywords from being imported</p>
        </Link>

        <Link
          href="/settings/profile"
          className="block bg-white border rounded-lg p-5 hover:border-gray-400 transition-colors"
        >
          <h2 className="font-semibold text-base">Engineer Profile</h2>
          <p className="text-sm text-gray-500 mt-1">Edit the engineer profile used to score posts during analysis</p>
        </Link>

        <Link
          href="/settings/fetch-age"
          className="block bg-white border rounded-lg p-5 hover:border-gray-400 transition-colors"
        >
          <h2 className="font-semibold text-base">Fetch Max Age</h2>
          <p className="text-sm text-gray-500 mt-1">Limit how old imported posts can be (in days)</p>
        </Link>

        <Link
          href="/settings/ai"
          className="block bg-white border rounded-lg p-5 hover:border-gray-400 transition-colors"
        >
          <h2 className="font-semibold text-base">AI Provider</h2>
          <p className="text-sm text-gray-500 mt-1">Switch between OpenAI, OpenRouter, or Groq for analysis</p>
        </Link>
      </div>
    </div>
  )
}
