import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import type { FilterFn } from '@tanstack/react-table'
import { csvParse } from 'd3'
import { useState, type ReactNode } from 'react'

/** Turn a genre label into a safe column name: e.g. "Sci-Fi" -> "isSciFi" */
function genreToColumnName(genre: string): string {
  const cleaned = genre
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
    .replace(/\W/g, '')
  return 'is' + cleaned
}

/** Preprocess rows: expand Genre into boolean is{Genre} columns */
function preprocessGenres(
  rows: Record<string, string>[],
  columns: string[]
): { rows: Record<string, string>[]; columns: string[] } {
  const genreSet = new Set<string>()
  for (const row of rows) {
    const raw = row.Genre ?? ''
    for (const g of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      genreSet.add(g)
    }
  }
  const genreColumns = [...genreSet].sort().map(genreToColumnName)
  const genreByKey = new Map<string, string>()
  genreSet.forEach((g) => genreByKey.set(genreToColumnName(g), g))

  const preprocessedRows = rows.map((row) => {
    const next: Record<string, string> = { ...row }
    const rowGenres = new Set(
      (row.Genre ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(genreToColumnName)
    )
    for (const key of genreColumns) {
      next[key] = rowGenres.has(key) ? 'true' : 'false'
    }
    return next
  })

  const newColumns = [...columns, ...genreColumns]
  return { rows: preprocessedRows, columns: newColumns }
}

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/nickmarcha/inf252/main'
const ASSIGNMENT_MD_URL = `${GITHUB_RAW_BASE}/Assignments/ProgrammingExercise02_Deceptive_Viz.md`

export const Route = createFileRoute('/assignments/deceptive-viz')({
  loader: async () => {
    const base = import.meta.env.BASE_URL
    const [csvRes, mdRes] = await Promise.all([
      fetch(`${base}data/imdb_top_1000.csv`),
      fetch(ASSIGNMENT_MD_URL),
    ])
    if (!csvRes.ok) throw new Error('Failed to load CSV')
    const text = await csvRes.text()
    const parsed = csvParse(text)
    const rawRows = parsed as unknown as Record<string, string>[]
    const rawColumns = parsed.columns ?? (rawRows.length ? Object.keys(rawRows[0]!) : [])
    const { rows, columns } = preprocessGenres(rawRows, rawColumns)
    const assignmentMarkdown = mdRes.ok ? await mdRes.text() : '*Assignment brief could not be loaded.*'
    return { rows, columns, assignmentMarkdown }
  },
  component: DeceptiveVizLayout,
})

// Single combined type line (attribute + scale where relevant)
const COLUMN_TYPE: Record<string, string> = {
  Poster_Link: '?',
  Series_Title: 'Categorical (nominal)',
  Released_Year: 'Temporal (Sequential)',
  Certificate: 'Categorical (ordinal)',
  Runtime: 'Continuous (quantitative) · Sequential',
  Genre: 'Categorical (nominal)',
  IMDB_Rating: 'Continuous (quantitative) · Sequential',
  Overview: 'Text/identifier',
  Meta_score: 'Continuous (quantitative) · Sequential',
  Director: 'Categorical (nominal)',
  Star1: 'Categorical (nominal)',
  Star2: 'Categorical (nominal)',
  Star3: 'Categorical (nominal)',
  Star4: 'Categorical (nominal)',
  No_of_Votes: 'Continuous (quantitative) · Sequential',
  Gross: 'Continuous (quantitative) · Sequential',
}

function getColumnType(name: string): string {
  if (COLUMN_TYPE[name]) return COLUMN_TYPE[name]
  if (name.startsWith('is') && name.length > 2) return 'Boolean (genre flag)'
  return 'Categorical (nominal)'
}

function getColumnDescription(name: string): string {
  if (COLUMN_DESCRIPTION[name]) return COLUMN_DESCRIPTION[name]
  if (name.startsWith('is') && name.length > 2) return 'Whether the movie has this genre.'
  return ''
}

const COLUMN_DESCRIPTION: Record<string, string> = {
  Poster_Link: 'Link of the poster that IMDB is using.',
  Series_Title: 'Name of the movie.',
  Released_Year: 'Year at which that movie released.',
  Certificate: 'Certificate earned by that movie.',
  Runtime: 'Total runtime of the movie.',
  Genre: 'Genre of the movie.',
  IMDB_Rating: 'Rating of the movie at IMDB site.',
  Overview: 'Mini story / summary.',
  Meta_score: 'Score earned by the movie.',
  Director: 'Name of the Director.',
  Star1: 'Name of a star.',
  Star2: 'Name of a star.',
  Star3: 'Name of a star.',
  Star4: 'Name of a star.',
  No_of_Votes: 'Total number of votes.',
  Gross: 'Money earned by that movie.',
}

function parseRuntime(s: string): number | null {
  if (!s) return null
  const m = s.trim().match(/^(\d+)\s*min/i)
  return m ? Number(m[1]) : null
}

function parseGross(s: string): number | null {
  if (!s) return null
  const n = Number(s.replace(/,/g, '').trim())
  return Number.isNaN(n) ? null : n
}

interface ColStats {
  name: string
  type: string
  description: string
  numeric?: {
    min: number
    max: number
    range: string
    mean: number
    median: number
    count: number
    missing: number
  }
  categorical?: {
    distinct: number
    sample: string[]
    sampleAsImages?: boolean
  }
  boolean?: { trueCount: number; falseCount: number }
  genreFlags?: { flags: { name: string; trueCount: number }[] }
  temporal?: { min: number; max: number; range: string }
}

export function computeColumnStats(
  rows: Record<string, string>[],
  columns: string[]
): ColStats[] {
  const genreCols = columns.filter((c) => c.startsWith('is') && c.length > 2)
  const nonGenreColumns = columns.filter((c) => !c.startsWith('is') || c.length <= 2)

  const baseStats = nonGenreColumns.map((name) => {
    const values = rows.map((r) => r[name]?.trim()).filter((v) => v != null && v !== '')
    const missing = rows.length - values.length

    if (name === 'Released_Year') {
      const nums = values.map(Number).filter((n) => !Number.isNaN(n))
      if (nums.length) {
        const min = Math.min(...nums)
        const max = Math.max(...nums)
        return {
          name,
          type: getColumnType(name),
          description: getColumnDescription(name),
          temporal: { min, max, range: `${min} – ${max}` },
        }
      }
    }

    if (name === 'Runtime') {
      const nums = rows.map((r) => parseRuntime(r[name] ?? '')).filter((n): n is number => n != null)
      if (nums.length) {
        const sorted = [...nums].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
        const sum = nums.reduce((a, b) => a + b, 0)
        return {
          name,
          type: getColumnType(name),
          description: getColumnDescription(name),
          numeric: {
            min: Math.min(...nums),
            max: Math.max(...nums),
            range: `${Math.min(...nums)} – ${Math.max(...nums)} min`,
            mean: Math.round((sum / nums.length) * 10) / 10,
            median: Math.round(median * 10) / 10,
            count: nums.length,
            missing,
          },
        }
      }
    }

    if (['IMDB_Rating', 'Meta_score', 'No_of_Votes'].includes(name)) {
      const nums = values.map((v) => (name === 'No_of_Votes' ? Number(v.replace(/,/g, '')) : Number(v))).filter((n) => !Number.isNaN(n))
      if (nums.length) {
        const sorted = [...nums].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
        const sum = nums.reduce((a, b) => a + b, 0)
        const mean = sum / nums.length
        const fmt = name === 'No_of_Votes' ? (n: number) => n.toLocaleString() : (n: number) => n.toFixed(1)
        return {
          name,
          type: getColumnType(name),
          description: getColumnDescription(name),
          numeric: {
            min: Math.min(...nums),
            max: Math.max(...nums),
            range: `${fmt(Math.min(...nums))} – ${fmt(Math.max(...nums))}`,
            mean: name === 'No_of_Votes' ? Math.round(mean) : Math.round(mean * 100) / 100,
            median: name === 'No_of_Votes' ? Math.round(median) : Math.round(median * 100) / 100,
            count: nums.length,
            missing,
          },
        }
      }
    }

    if (name === 'Gross') {
      const nums = rows.map((r) => parseGross(r[name] ?? '')).filter((n): n is number => n != null)
      if (nums.length) {
        const sorted = [...nums].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
        const sum = nums.reduce((a, b) => a + b, 0)
        const fmt = (n: number) => n.toLocaleString()
        return {
          name,
          type: getColumnType(name),
          description: getColumnDescription(name),
          numeric: {
            min: Math.min(...nums),
            max: Math.max(...nums),
            range: `${fmt(Math.min(...nums))} – ${fmt(Math.max(...nums))}`,
            mean: Math.round(sum / nums.length),
            median: Math.round(median),
            count: nums.length,
            missing,
          },
        }
      }
    }

    if (name === 'Genre') {
      const genres = values.flatMap((v) => v.split(',').map((g) => g.trim()).filter(Boolean))
      const distinctGenres = [...new Set(genres)]
      return {
        name,
        type: getColumnType(name),
        description: getColumnDescription(name),
        categorical: {
          distinct: distinctGenres.length,
          sample: distinctGenres.slice(0, 8),
        },
      }
    }

    const distinct = new Set(values).size
    const sample = [...new Set(values)].slice(0, 5)
    return {
      name,
      type: getColumnType(name),
      description: getColumnDescription(name),
      categorical: {
        distinct,
        sample,
        sampleAsImages: name === 'Poster_Link',
      },
    }
  })

  if (genreCols.length === 0) return baseStats

  const genreFlagsEntry: ColStats = {
    name: 'Genre (boolean flags)',
    type: 'Boolean (genre flag)',
    description: 'Whether the movie has each genre. One column per genre (isDrama, isCrime, …).',
    genreFlags: {
      flags: genreCols.map((col) => ({
        name: col,
        trueCount: rows.filter((r) => r[col] === 'true').length,
      })),
    },
  }
  return [...baseStats, genreFlagsEntry]
}

export const stringFilter: FilterFn<Record<string, string>> = (row, columnId, filterValue) => {
  const v = row.getValue(columnId) as string
  if (!filterValue) return true
  return String(v ?? '').toLowerCase().includes(String(filterValue).toLowerCase())
}

const NUMERIC_COLUMNS = [
  'Released_Year',
  'Runtime',
  'IMDB_Rating',
  'Meta_score',
  'No_of_Votes',
  'Gross',
] as const

function getNumericValue(row: Record<string, string>, col: string): number | null {
  const v = row[col]
  if (v == null || v === '') return null
  if (col === 'Runtime') return parseRuntime(v)
  if (col === 'Gross') return parseGross(v)
  if (col === 'No_of_Votes') return Number(v.replace(/,/g, '')) || null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

/** Sample covariance: sum((x - meanX)(y - meanY)) / (n - 1) */
function covariance(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += (x[i]! - meanX) * (y[i]! - meanY)
  }
  return sum / (n - 1)
}

/** Correlation matrix (normalized): values in [-1, 1], so colors are comparable */
export function computeCorrelationMatrix(
  rows: Record<string, string>[],
  allColumns: string[]
): { matrix: number[][]; columns: string[] } {
  const numericCols = [
    ...NUMERIC_COLUMNS.filter((c) => allColumns.includes(c)),
    ...allColumns.filter((c) => c.startsWith('is')),
  ]
  const colList = numericCols

  const data = colList.map((col) =>
    rows.map((row) => {
      if (row[col] === 'true') return 1
      if (row[col] === 'false') return 0
      return getNumericValue(row, col)
    })
  )

  const covMatrix: number[][] = colList.map((_, i) =>
    colList.map((_, j) => {
      const a: number[] = []
      const b: number[] = []
      for (let k = 0; k < rows.length; k++) {
        const vi = data[i]![k]
        const vj = data[j]![k]
        if (vi != null && vj != null) {
          a.push(vi)
          b.push(vj)
        }
      }
      return covariance(a, b)
    })
  )

  const std = colList.map((_, i) => Math.sqrt(Math.max(0, covMatrix[i]![i]!)))
  const corrMatrix: number[][] = colList.map((_, i) =>
    colList.map((_, j) => {
      const si = std[i]!
      const sj = std[j]!
      if (si < 1e-10 || sj < 1e-10) return i === j ? 1 : 0
      return covMatrix[i]![j]! / (si * sj)
    })
  )

  return { matrix: corrMatrix, columns: colList }
}

export function CollapsibleSection({
  id,
  title,
  children,
  defaultOpen = true,
  sectionClassName = '',
  open: controlledOpen,
  onToggle,
}: {
  id?: string
  title: string
  children: ReactNode
  defaultOpen?: boolean
  sectionClassName?: string
  /** When provided with onToggle, section is controlled (e.g. expand/collapse all) */
  open?: boolean
  onToggle?: () => void
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined && onToggle != null
  const open = isControlled ? controlledOpen : internalOpen
  const handleToggle = isControlled ? onToggle : () => setInternalOpen((o) => !o)
  return (
    <section
      id={id}
      className={`rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 ${sectionClassName}`.trim()}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left hover:bg-gray-100/80 dark:hover:bg-gray-700/50 rounded-t-lg transition-colors"
        aria-expanded={open}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <span
          className="shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-300 ease-out"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          ▼
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-5 pb-5 pt-0">{children}</div>
        </div>
      </div>
    </section>
  )
}

export type DeceptiveVizLoaderData = {
  rows: Record<string, string>[]
  columns: string[]
  assignmentMarkdown: string
}

function DeceptiveVizLayout() {
  const location = useLocation()
  const pathname = location.pathname
  const isBrief = !pathname.includes('data-exploration') && !pathname.includes('visualization')
  const isExploration = pathname.includes('data-exploration')
  const isVisualization = pathname.includes('visualization')

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
        Programming Exercise 02: Deceptive Visualization
      </h1>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Dataset: IMDB Top 1000. Explore the data, then build honest and
        misleading visualizations from the same dataset.
      </p>

      <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
        <Link
          to="/assignments/deceptive-viz"
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            isBrief
              ? 'bg-white text-gray-900 shadow dark:bg-white/10 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Assignment brief
        </Link>
        <Link
          to="/assignments/deceptive-viz/data-exploration"
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            isExploration
              ? 'bg-white text-gray-900 shadow dark:bg-white/10 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Data exploration
        </Link>
        <Link
          to="/assignments/deceptive-viz/visualization"
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            isVisualization
              ? 'bg-white text-gray-900 shadow dark:bg-white/10 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Visualization (task)
        </Link>
      </div>

      <Outlet />
    </div>
  )
}
