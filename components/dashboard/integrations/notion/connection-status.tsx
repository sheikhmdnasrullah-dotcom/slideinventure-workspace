import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FileText, Settings, X } from 'lucide-react'

export function ConnectionStatus() {
  const router = useRouter()
  const [searchParams] = useSearchParams()
  const [connected, setConnected] = useState(false)
  const [workspaceName, setWorkspaceName] = useState<string>('')

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('notion_connections')
          .select('workspace_name, status')
          .eq('status', 'active')
          .limit(1)

        if (data && data.length > 0) {
          setConnected(true)
          setWorkspaceName(data[0].workspace_name || 'Notion Workspace')
        }
      } catch (e) {
        console.error('Connection check error:', e)
      }
    }

    checkConnection()
  }, [])

  const handleConnect = async () => {
    router.replace('/dashboard?notion_connect=start')
  }

  const handleDisconnect = async () => {
    try {
      const supabase = createClient()
      await supabase
        .from('notion_connections')
        .update({ status: 'revoked' })
        .eq('status', 'active')
      setConnected(false)
      setWorkspaceName('')
      toast.success('Notion disconnected')
    } catch (e) {
      toast.error('Failed to disconnect')
    }
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <FileText className="size-4 text-green-500" />
        <span className="font-medium text-foreground">{workspaceName}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDisconnect}
          className="p-1"
        >
          <X className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={handleConnect}
        title="Connect Notion"
      >
        <Settings className="size-4" />
      </Button>
      <span className="text-xs text-muted-foreground">Notion</span>
    </div>
  )
}