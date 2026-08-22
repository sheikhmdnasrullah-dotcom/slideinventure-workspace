import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl!, supabaseKey!)

async function main() {
  const { data, error } = await supabase.storage.createBucket('documents', {
    public: true,
  })

  if (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate key value')) {
      console.log('Bucket already exists.')
    } else {
      console.error('Error creating bucket:', error)
    }
  } else {
    console.log('Bucket created successfully:', data)
  }
}

main()
