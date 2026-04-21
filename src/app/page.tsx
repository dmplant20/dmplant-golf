'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Course = {
  id: string
  name: string
  region: string
}

export default function Page() {
  const [courses, setCourses] = useState<Course[]>([])
  const [message, setMessage] = useState('loading...')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data, error } = await supabase
      .from('golf_courses')
      .select('id, name, region')
      .order('name')

    if (error) {
      console.error(error)
      setMessage(`ERROR: ${error.message}`)
      return
    }

    setCourses(data || [])
    setMessage(`Loaded ${data?.length || 0} courses`)
  }

  function handleCourseClick(courseId: string) {
    alert(`Selected course ID: ${courseId}`)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>🏌️ Golf Courses</h1>
      <p>{message}</p>

      {courses.map((c) => (
        <div
          key={c.id}
          onClick={() => handleCourseClick(c.id)}
          style={{
            cursor: 'pointer',
            marginBottom: 10,
            padding: '8px 0',
            borderBottom: '1px solid #333',
          }}
        >
          {c.name} ({c.region})
        </div>
      ))}
    </div>
  )
}
