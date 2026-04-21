'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Page() {
  const [courses, setCourses] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data, error } = await supabase
      .from('golf_courses')
      .select('*')
      .order('name')

    if (error) {
      console.error(error)
    } else {
      setCourses(data)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>🏌️ Golf Courses</h1>

      {courses.map((c, i) => (
        <div key={i}>
          {c.name} ({c.region})
        </div>
      ))}
    </div>
  )
}
