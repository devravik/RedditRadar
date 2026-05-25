import { prisma } from '@/lib/db'
import { SenderNameEditor } from '@/components/sender-name-editor'

export default async function SenderNamePage() {
  const setting = await prisma.setting.findUnique({ where: { key: 'SENDER_NAME' } })

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sender Name</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Your name or handle, included in AI-generated outreach messages. Leave empty for a generic sender.
        </p>
      </div>

      <div className="bg-white border rounded-lg p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
        <SenderNameEditor initialName={setting?.value ?? ''} />
      </div>
    </div>
  )
}
