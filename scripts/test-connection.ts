import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { count, error } = await supabase
    .from('knowledge_items')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Connection failed:', error.message)
    process.exit(1)
  }

  console.log('Connected. knowledge_items count:', count)
}

main()
