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

type Layout = {
  id: string
  golf_course_id: string
  layout_name: string
  tee_name: string | null
  total_holes: number | null
  total_par: number | null
  total_yards: number | null
}

export default function Page() {
  const [courses, setCourses] = useState<Course[]>([])
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [message, setMessage] = useState('loading...')
  const [layoutMessage, setLayoutMessage] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedCourseName, setSelectedCourseName] = useState('')

  useEffect(() => {
    loadCourses()
  }, [])

  async function loadCourses() {
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

  async function handleCourseClick(courseId: string, courseName: string) {
    setSelectedCourseId(courseId)
    setSelectedCourseName(courseName)
    setLayouts([])
    setLayoutMessage('Loading layouts...')

    const { data, error } = await supabase
      .from('golf_course_layouts')
      .select('id, golf_course_id, layout_name, tee_name, total_holes, total_par, total_yards')
      .eq('golf_course_id', courseId)
      .order('layout_name')

    if (error) {
      console.error(error)
      setLayoutMessage(`ERROR: ${error.message}`)
      return
    }

    setLayouts(data || [])
    setLayoutMessage(`Loaded ${data?.length || 0} layouts`)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>🏌️ Golf Courses</h1>
      <p>{message}</p>

      <div style={{ marginBottom: 30 }}>
        {courses.map((c) => (
          <div
            key={c.id}
            onClick={() => handleCourseClick(c.id, c.name)}
            style={{
              cursor: 'pointer',
              marginBottom: 10,
              padding: '8px 0',
              borderBottom: '1px solid #333',
              fontWeight: selectedCourseId === c.id ? 'bold' : 'normal',
            }}
          >
            {c.name} ({c.region})
          </div>
        ))}
      </div>

      {selectedCourseId && (
        <div style={{ marginTop: 30 }}>
          <h2>📍 Layouts for {selectedCourseName}</h2>
          <p>{layoutMessage}</p>

          {layouts.map((layout) => (
            <div
              key={layout.id}
              style={{
                marginBottom: 10,
                padding: '10px 0',
                borderBottom: '1px solid #444',
              }}
            >
              <div>{layout.layout_name}</div>
              <div style={{ fontSize: 14, opacity: 0.8 }}>
                Tee: {layout.tee_name || '-'} / Holes: {layout.total_holes || '-'} / Par: {layout.total_par || '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
