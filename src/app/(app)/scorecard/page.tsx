'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import GoogleMapView from '@/components/GoogleMapView'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Course = {
  id: string
  name: string
  region: string | null
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

type SavedRound = {
  id: string
  total_score: number | null
  created_at?: string | null
  played_at?: string | null
  tee_name?: string | null
  scorecard_orientation?: string | null
  golf_course_id?: string | null
  layout_id?: string | null
}

export default function ScorecardPage() {
  const [user, setUser] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const [courses, setCourses] = useState<Course[]>([])
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [holes, setHoles] = useState<Hole[]>([])
  const [myRounds, setMyRounds] = useState<SavedRound[]>([])

  const [message, setMessage] = useState('loading courses...')
  const [layoutMessage, setLayoutMessage] = useState('')
  const [holeMessage, setHoleMessage] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [roundListMessage, setRoundListMessage] = useState('')

  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedCourseName, setSelectedCourseName] = useState('')

  const [selectedLayoutId, setSelectedLayoutId] = useState('')
  const [selectedLayoutName, setSelectedLayoutName] = useState('')

  const [roundStarted, setRoundStarted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scores, setScores] = useState<HoleScoreMap>({})

  useEffect(() => {
    checkUser()
    loadCourses()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        loadMyRounds(currentUser.id)
      } else {
        setMyRounds([])
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (user?.id) {
      loadMyRounds(user.id)
    }
  }, [user?.id])

  async function checkUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.error(error)
      setAuthMessage(`ERROR: ${error.message}`)
      return
    }

    setUser(user ?? null)

    if (user?.id) {
      await loadMyRounds(user.id)
    }
  }

  async function handleLogin() {
    if (!email) {
      setAuthMessage('이메일을 입력하세요.')
      return
    }

    setAuthMessage('로그인 링크 전송중...')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/scorecard`,
      },
    })

    if (error) {
      console.error(error)
      setAuthMessage(`ERROR: ${error.message}`)
      return
    }

    setAuthMessage('이메일로 로그인 링크를 보냈습니다. 메일함을 확인하세요.')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setMyRounds([])
    setAuthMessage('로그아웃되었습니다.')
  }

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

  async function loadMyRounds(userId: string) {
    setRoundListMessage('내 기록 불러오는 중...')

    const { data, error } = await supabase
      .from('rounds')
      .select('id, total_score, created_at, played_at, tee_name, scorecard_orientation, golf_course_id, layout_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setRoundListMessage(`ERROR: ${error.message}`)
      return
    }

    setMyRounds(data || [])
    setRoundListMessage(`내 기록 ${data?.length || 0}건`)
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
      alert('먼저 골프장과 코스를 선택하세요.')
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
    return holes.reduce((sum, hole) => sum + (scores[hole.id] ?? 0), 0)
  }, [holes, scores])

  const totalPar = useMemo(() => {
    return holes.reduce((sum, hole) => sum + hole.par, 0)
  }, [holes])

  const overUnder = totalScore - totalPar

  const averageScore = useMemo(() => {
    const valid = myRounds.filter((round) => typeof round.total_score === 'number')
    if (valid.length === 0) return null

    const total = valid.reduce((sum, round) => sum + (round.total_score ?? 0), 0)
    return (total / valid.length).toFixed(1)
  }, [myRounds])

  function formatDate(value?: string | null) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  async function saveRound() {
    if (!roundStarted) {
      alert('먼저 라운드를 시작하세요.')
      return
    }

    if (!selectedCourseId || !selectedLayoutId) {
      alert('골프장과 코스를 먼저 선택하세요.')
      return
    }

    if (!user) {
      setSaveMessage('ERROR: 먼저 로그인하세요.')
      return
    }

    setSaving(true)
    setSaveMessage('Saving round...')

    try {
      const roundPayload = {
        user_id: user.id,
        golf_course_id: selectedCourseId,
        layout_id: selectedLayoutId,
        tee_name: 'White',
        scorecard_orientation: 'portrait',
        total_score: totalScore,
      }

      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .insert(roundPayload)
        .select('id')
        .single()

      if (roundError) {
        console.error('round insert error:', roundError)
        setSaveMessage(`ERROR(rounds): ${roundError.message}`)
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

      const { error: holeScoreError } = await supabase
        .from('round_hole_scores')
        .insert(holeRows)

      if (holeScoreError) {
        console.error('round_hole_scores insert error:', holeScoreError)
        setSaveMessage(`ERROR(round_hole_scores): ${holeScoreError.message}`)
        return
      }

      setSaveMessage(`Saved successfully. Round ID: ${roundId}`)
      await loadMyRounds(user.id)
    } catch (err: any) {
      console.error(err)
      setSaveMessage(`ERROR: ${err?.message || 'unexpected error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h1>🏌️ Scorecard</h1>

      <div
        style={{
          border: '1px solid #444',
          padding: 16,
          marginBottom: 24,
          borderRadius: 8,
        }}
      >
        <h2>🔐 로그인</h2>

        {user ? (
          <div>
            <p>로그인됨: {user.email}</p>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                border: '1px solid #666',
                background: '#111',
                color: '#fff',
              }}
            >
              로그아웃
            </button>
          </div>
        ) : (
          <div>
            <input
              type="email"
              placeholder="이메일 입력"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: 10,
                width: '100%',
                maxWidth: 320,
                marginRight: 12,
                marginBottom: 12,
                border: '1px solid #666',
              }}
            />
            <br />
            <button
              onClick={handleLogin}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                border: '1px solid #666',
                background: '#111',
                color: '#fff',
              }}
            >
              로그인 링크 보내기
            </button>
          </div>
        )}

        {authMessage && <p style={{ marginTop: 12 }}>{authMessage}</p>}
      </div>

      <div
        style={{
          border: '1px solid #444',
          padding: 16,
          marginBottom: 24,
          borderRadius: 8,
        }}
      >
        <h2>📊 내 기록 요약</h2>
        {user ? (
          <>
            <p>{roundListMessage}</p>
            <p>총 라운드: {myRounds.length}</p>
            <p>평균 스코어: {averageScore ?? '-'}</p>
          </>
        ) : (
          <p>로그인하면 내 기록과 평균 스코어를 볼 수 있습니다.</p>
        )}
      </div>

      <p>{message}</p>

      <div style={{ marginBottom: 30 }}>
        <h2>🏞️ 골프장 선택</h2>

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
            {course.name} {course.region ? `(${course.region})` : ''}
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
            <p style={{ marginBottom: 20, fontWeight: 'bold' }}>{saveMessage}</p>
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

      <div
        style={{
          border: '1px solid #444',
          padding: 16,
          marginTop: 32,
          marginBottom: 32,
          borderRadius: 8,
        }}
      >
        <h2>🧾 내 최근 라운드</h2>

        {!user ? (
          <p>로그인 후 확인 가능합니다.</p>
        ) : myRounds.length === 0 ? (
          <p>아직 저장된 라운드가 없습니다.</p>
        ) : (
          myRounds.map((round, index) => (
            <div
              key={round.id}
              style={{
                padding: '12px 0',
                borderBottom: index === myRounds.length - 1 ? 'none' : '1px solid #333',
              }}
            >
              <div>Round ID: {round.id}</div>
              <div>Score: {round.total_score ?? '-'}</div>
              <div>Date: {formatDate(round.played_at || round.created_at)}</div>
              <div>Tee: {round.tee_name || '-'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
