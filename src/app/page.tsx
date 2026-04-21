'use client'

import { useEffect, useMemo, useState } from 'react'
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

type Hole = {
  id: string
  layout_id: string
  hole_number: number
  par: number
  yards: number | null
  handicap_index: number | null
  hole_name: string | null
}

type HoleScoreMap = Record<string, number>

export default function Page() {
  const [courses, setCourses] = useState<Course[]>([])
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [holes, setHoles] = useState<Hole[]>([])

  const [message, setMessage] = useState('loading courses...')
  const [layoutMessage, setLayoutMessage] = useState('')
  const [holeMessage, setHoleMessage] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedCourseName, setSelectedCourseName] = useState('')

  const [selectedLayoutId, setSelectedLayoutId] = useState('')
  const [selectedLayoutName, setSelectedLayoutName] = useState('')

  const [roundStarted, setRoundStarted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scores, setScores] = useState<HoleScoreMap>({})

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

    setSelectedLayoutId('')
    setSelectedLayoutName('')
    setLayouts([])
    setHoles([])
    setScores({})
    setRoundStarted(false)
    setSaveMessage('')
    setHoleMessage('')

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

  async function handleLayoutClick(layoutId: string, layoutName: string) {
    setSelectedLayoutId(layoutId)
    setSelectedLayoutName(layoutName)
    setHoles([])
    setScores({})
    setRoundStarted(false)
    setSaveMessage('')
    setHoleMessage('Loading holes...')

    const { data, error } = await supabase
      .from('golf_course_holes')
      .select('id, layout_id, hole_number, par, yards, handicap_index, hole_name')
      .eq('layout_id', layoutId)
      .order('hole_number')

    if (error) {
      console.error(error)
      setHoleMessage(`ERROR: ${error.message}`)
      return
    }

    setHoles(data || [])
    setHoleMessage(`Loaded ${data?.length || 0} holes`)
  }

  function startRound() {
    if (!selectedLayoutId || holes.length === 0) {
      alert('먼저 코스를 선택하세요.')
      return
    }

    const initialScores: HoleScoreMap = {}
    holes.forEach((hole) => {
      initialScores[hole.id] = hole.par
    })

    setScores(initialScores)
    setRoundStarted(true)
    setSaveMessage('')
  }

  function resetRound() {
    const initialScores: HoleScoreMap = {}
    holes.forEach((hole) => {
      initialScores[hole.id] = hole.par
    })
    setScores(initialScores)
    setSaveMessage('')
  }

  function changeScore(holeId: string, delta: number) {
    setScores((prev) => {
      const current = prev[holeId] ?? 0
      const next = Math.max(1, current + delta)
      return {
        ...prev,
        [holeId]: next,
      }
    })
  }

  const totalScore = useMemo(() => {
    return holes.reduce((sum, hole) => {
      return sum + (scores[hole.id] ?? 0)
    }, 0)
  }, [holes, scores])

  const totalPar = useMemo(() => {
    return holes.reduce((sum, hole) => sum + hole.par, 0)
  }, [holes])

  const overUnder = totalScore - totalPar

  async function saveRound() {
    if (!roundStarted) {
      alert('먼저 라운드를 시작하세요.')
      return
    }

    if (!selectedCourseId || !selectedLayoutId) {
      alert('골프장과 코스를 먼저 선택하세요.')
      return
    }

    setSaving(true)
    setSaveMessage('Saving round...')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error(userError)
        setSaveMessage(`ERROR: ${userError.message}`)
        setSaving(false)
        return
      }

      if (!user) {
        setSaveMessage('ERROR: 로그인된 사용자가 없습니다.')
        setSaving(false)
        return
      }

      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .insert({
          user_id: user.id,
          golf_course_id: selectedCourseId,
          layout_id: selectedLayoutId,
          tee_name: 'White',
          scorecard_orientation: 'portrait',
          total_score: totalScore,
        })
        .select('id')
        .single()

      if (roundError) {
        console.error(roundError)
        setSaveMessage(`ERROR: ${roundError.message}`)
        setSaving(false)
        return
      }

      const roundId = roundData.id

      const holeRows = holes.map((hole) => ({
        round_id: roundId,
        hole_id: hole.id,
        hole_number: hole.hole_number,
        par: hole.par,
        strokes: scores[hole.id] ?? hole.par,
      }))

      const { error: scoreError } = await supabase
        .from('round_hole_scores')
        .insert(holeRows)

      if (scoreError) {
        console.error(scoreError)
        setSaveMessage(`ERROR: ${scoreError.message}`)
        setSaving(false)
        return
      }

      setSaveMessage(`Saved successfully. Round ID: ${roundId}`)
    } catch (err) {
      console.error(err)
      setSaveMessage('ERROR: unexpected error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h1>🏌️ Golf Courses</h1>
      <p>{message}</p>

      <div style={{ marginBottom: 30 }}>
        {courses.map((course) => (
          <div
            key={course.id}
            onClick={() => handleCourseClick(course.id, course.name)}
            style={{
              cursor: 'pointer',
              marginBottom: 10,
              padding: '10px 0',
              borderBottom: '1px solid #333',
              fontWeight: selectedCourseId === course.id ? 'bold' : 'normal',
            }}
          >
            {course.name} ({course.region})
          </div>
        ))}
      </div>

      {selectedCourseId && (
        <div style={{ marginTop: 30, marginBottom: 30 }}>
          <h2>📍 Layouts for {selectedCourseName}</h2>
          <p>{layoutMessage}</p>

          {layouts.map((layout) => (
            <div
              key={layout.id}
              onClick={() => handleLayoutClick(layout.id, layout.layout_name)}
              style={{
                cursor: 'pointer',
                marginBottom: 10,
                padding: '10px 0',
                borderBottom: '1px solid #444',
                fontWeight: selectedLayoutId === layout.id ? 'bold' : 'normal',
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

      {selectedLayoutId && (
        <div style={{ marginTop: 30 }}>
          <h2>⛳ Holes for {selectedLayoutName}</h2>
          <p>{holeMessage}</p>

          <div style={{ marginBottom: 20 }}>
            {!roundStarted ? (
              <button
                onClick={startRound}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  border: '1px solid #666',
                  background: '#111',
                  color: '#fff',
                  marginRight: 12,
                }}
              >
                라운드 시작
              </button>
            ) : (
              <>
                <button
                  onClick={resetRound}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    border: '1px solid #666',
                    background: '#111',
                    color: '#fff',
                    marginRight: 12,
                  }}
                >
                  점수 초기화
                </button>

                <button
                  onClick={saveRound}
                  disabled={saving}
                  style={{
                    padding: '10px 16px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    border: '1px solid #666',
                    background: saving ? '#666' : '#0a7',
                    color: '#fff',
                    marginRight: 12,
                  }}
                >
                  {saving ? '저장중...' : '라운드 저장'}
                </button>

                <span style={{ fontSize: 18, fontWeight: 'bold' }}>
                  Total: {totalScore} / Par: {totalPar} / {overUnder === 0 ? 'E' : overUnder > 0 ? `+${overUnder}` : overUnder}
                </span>
              </>
            )}
          </div>

          {saveMessage && (
            <p style={{ marginBottom: 20, fontWeight: 'bold' }}>
              {saveMessage}
            </p>
          )}

          {holes.map((hole) => (
            <div
              key={hole.id}
              style={{
                marginBottom: 10,
                padding: '12px 0',
                borderBottom: '1px solid #555',
              }}
            >
              <div style={{ marginBottom: 6 }}>
                Hole {hole.hole_number}
                {hole.hole_name ? ` - ${hole.hole_name}` : ''}
              </div>

              <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 10 }}>
                Par: {hole.par} / Yards: {hole.yards || '-'} / HCP: {hole.handicap_index || '-'}
              </div>

              {roundStarted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => changeScore(hole.id, -1)}
                    style={{
                      width: 36,
                      height: 36,
                      cursor: 'pointer',
                      border: '1px solid #666',
                      background: '#111',
                      color: '#fff',
                    }}
                  >
                    -
                  </button>

                  <div style={{ minWidth: 40, textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>
                    {scores[hole.id]}
                  </div>

                  <button
                    onClick={() => changeScore(hole.id, 1)}
                    style={{
                      width: 36,
                      height: 36,
                      cursor: 'pointer',
                      border: '1px solid #666',
                      background: '#111',
                      color: '#fff',
                    }}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
