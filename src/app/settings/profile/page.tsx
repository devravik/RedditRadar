import { prisma } from '@/lib/db'
import { ProfileEditor } from '@/components/profile-editor'

export default async function ProfilePage() {
  const setting = await prisma.setting.findUnique({ where: { key: 'ENGINEER_PROFILE' } })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Engineer Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          This profile is injected into the AI prompt when analyzing posts. It controls what signals are considered a match.
        </p>
      </div>

      <ProfileEditor initial={setting?.value ?? ''} />
    </div>
  )
}
