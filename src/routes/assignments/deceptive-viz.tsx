import { createFileRoute } from '@tanstack/react-router'
import {
  type ColumnDef,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { csvParse } from 'd3'
import { useMemo, useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import {
  computeLineSeries,
  computeScatterPoints,
  computeScatterPointsByGenre,
  ExplorationLineChart,
  ExplorationScatter,
  genreDisplayName,
} from './-exploration-charts'

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
  component: DeceptiveVizPage,
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

function computeColumnStats(
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

const stringFilter: FilterFn<Record<string, string>> = (row, columnId, filterValue) => {
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
function computeCorrelationMatrix(
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

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  sectionClassName = '',
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  sectionClassName?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section
      className={`rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 ${sectionClassName}`.trim()}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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

function DeceptiveVizPage() {
  const { rows, columns, assignmentMarkdown } = Route.useLoaderData() as {
    rows: Record<string, string>[]
    columns: string[]
    assignmentMarkdown: string
  }
  const [activeTab, setActiveTab] = useState<'brief' | 'exploration' | 'visualization'>('brief')

  const genreColumns = useMemo(() => columns.filter((c) => c.startsWith('is') && c.length > 2), [columns])
  const [lineMetric, setLineMetric] = useState<'imdb' | 'meta'>('imdb')
  const [lineVisible, setLineVisible] = useState<Set<string>>(() => new Set(['All']))
  const [lineDomain, setLineDomain] = useState<{ xMin: number; xMax: number; yMin: number; yMax: number } | null>(null)
  const [scatterUseTimeline, setScatterUseTimeline] = useState(false)
  const scatterYears = useMemo(() => {
    const ys = rows.map((r) => Number(r.Released_Year)).filter((y) => !Number.isNaN(y))
    return [...new Set(ys)].sort((a, b) => a - b)
  }, [rows])
  const [scatterSelectedYear, setScatterSelectedYear] = useState(2020)

  const lineSeries = useMemo(
    () => computeLineSeries(rows, genreColumns, lineMetric),
    [rows, genreColumns, lineMetric]
  )
  const scatterPoints = useMemo(() => computeScatterPoints(rows), [rows])
  const scatterPointsByGenre = useMemo(() => computeScatterPointsByGenre(rows), [rows])

  const toggleLineSeries = (key: string) => {
    setLineVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const columnStats = useMemo(() => computeColumnStats(rows, columns), [rows, columns])
  const corrResult = useMemo(() => computeCorrelationMatrix(rows, columns), [rows, columns])

  const tableColumns = useMemo<ColumnDef<Record<string, string>>[]>(
    () =>
      columns.map((colId) => ({
        id: colId,
        accessorKey: colId,
        header: colId.replace(/_/g, ' '),
        cell: (info) => {
          const v = info.getValue() as string
          const str = v ?? '—'
          return (
            <span className="block max-w-[180px] truncate" title={str}>
              {str}
            </span>
          )
        },
        filterFn: stringFilter,
      })),
    [columns]
  )

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

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
        <button
          type="button"
          onClick={() => setActiveTab('brief')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'brief'
              ? 'bg-white text-gray-900 shadow dark:bg-white/10 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Assignment brief
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exploration')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'exploration'
              ? 'bg-white text-gray-900 shadow dark:bg-white/10 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Data exploration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('visualization')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'visualization'
              ? 'bg-white text-gray-900 shadow dark:bg-white/10 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Visualization (task)
        </button>
      </div>

      {activeTab === 'brief' && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="markdown-content text-gray-700 dark:text-gray-300 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_strong]:font-semibold">
            <Markdown>{assignmentMarkdown}</Markdown>
          </div>
        </section>
      )}

      {activeTab === 'exploration' && (
        <>
          <CollapsibleSection title="Data overview — all columns" sectionClassName="mb-8">
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              <strong>Rows:</strong> {rows.length.toLocaleString()} ·{' '}
              <strong>Columns:</strong> {columns.length}
            </p>
            <div className="space-y-6">
              {columnStats.map((col) => (
                <div
                  key={col.name}
                  className="rounded border border-gray-200 bg-white p-4 dark:border-gray-600 dark:bg-gray-800/50"
                >
                  <h3 className="mb-2 font-medium text-gray-900 dark:text-white">
                    {col.name.replace(/_/g, ' ')}
                  </h3>
                  <ul className="mb-2 list-inside list-disc text-sm text-gray-700 dark:text-gray-300">
                    {col.description && (
                      <li>
                        <strong>Description:</strong> {col.description}
                      </li>
                    )}
                    <li>
                      <strong>Type:</strong> {col.type}
                    </li>
                    {col.numeric && (
                      <>
                        <li>
                          <strong>Range:</strong> {col.numeric.range}
                        </li>
                        <li>
                          <strong>Mean:</strong> {typeof col.numeric.mean === 'number' && col.numeric.mean % 1 !== 0 ? col.numeric.mean.toFixed(2) : col.numeric.mean.toLocaleString()}
                        </li>
                        <li>
                          <strong>Median:</strong> {typeof col.numeric.median === 'number' && col.numeric.median % 1 !== 0 ? col.numeric.median.toFixed(2) : col.numeric.median.toLocaleString()}
                        </li>
                        <li>
                          <strong>Count (non-missing):</strong> {col.numeric.count}
                          {col.numeric.missing > 0 && (
                            <> · <strong>Missing:</strong> {col.numeric.missing}</>
                          )}
                        </li>
                      </>
                    )}
                    {col.temporal && (
                      <li>
                        <strong>Range:</strong> {col.temporal.range}
                      </li>
                    )}
                    {col.boolean && (
                      <li>
                        <strong>Values:</strong> true ({col.boolean.trueCount}), false ({col.boolean.falseCount})
                      </li>
                    )}
                    {col.genreFlags && (
                      <li className="list-none">
                        <strong>Flags ({col.genreFlags.flags.length}):</strong>
                        <ul className="mt-1 ml-4 list-disc text-gray-600 dark:text-gray-400">
                          {col.genreFlags.flags.map((f) => (
                            <li key={f.name}>
                              {f.name}: true in {f.trueCount} rows
                            </li>
                          ))}
                        </ul>
                      </li>
                    )}
                    {col.categorical && (
                      <>
                        <li>
                          <strong>Distinct values:</strong> {col.categorical.distinct}
                        </li>
                        {col.categorical.sample.length > 0 && !col.categorical.sampleAsImages && (
                          <li>
                            <strong>Sample:</strong>{' '}
                            {col.categorical.sample.slice(0, 5).join(', ')}
                            {col.categorical.sample.length > 5 ? ' …' : ''}
                          </li>
                        )}
                        {col.categorical.sample.length > 0 && col.categorical.sampleAsImages && (
                          <li className="list-none">
                            <strong>Sample:</strong>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {col.categorical.sample.slice(0, 5).map((url) => (
                                <img
                                  key={url}
                                  src={url}
                                  alt=""
                                  className="h-20 w-auto rounded border border-gray-200 object-cover dark:border-gray-600"
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          </li>
                        )}
                      </>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Which years have better movies?" sectionClassName="mb-8">
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Average movie rating by release year. Toggle metric and genres; optionally set axis ranges.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-gray-700 dark:text-gray-300">Metric:</span>
                <select
                  value={lineMetric}
                  onChange={(e) => setLineMetric(e.target.value as 'imdb' | 'meta')}
                  className="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="imdb">IMDB Rating</option>
                  <option value="meta">Meta score</option>
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-700 dark:text-gray-300">Show:</span>
                {lineSeries.map((s) => (
                  <label key={s.key} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={lineVisible.has(s.key)}
                      onChange={() => toggleLineSeries(s.key)}
                      className="rounded"
                    />
                    <span className="text-gray-800 dark:text-gray-200">{genreDisplayName(s.key)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Axis range (optional):</span>
              <input
                type="number"
                placeholder="Year min"
                className="w-24 rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={lineDomain?.xMin ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  if (v === null || Number.isNaN(v)) return
                  setLineDomain((d) => ({ ...(d ?? { xMin: 1920, xMax: 2030, yMin: 0, yMax: 10 }), xMin: v }))
                }}
              />
              <input
                type="number"
                placeholder="Year max"
                className="w-24 rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={lineDomain?.xMax ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  if (v === null || Number.isNaN(v)) return
                  setLineDomain((d) => ({ ...(d ?? { xMin: 1920, xMax: 2030, yMin: 0, yMax: 10 }), xMax: v }))
                }}
              />
              <input
                type="number"
                step={0.5}
                placeholder="Y min"
                className="w-20 rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={lineDomain?.yMin ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  if (v === null || Number.isNaN(v)) return
                  setLineDomain((d) => ({ ...(d ?? { xMin: 1920, xMax: 2030, yMin: 0, yMax: 10 }), yMin: v }))
                }}
              />
              <input
                type="number"
                step={0.5}
                placeholder="Y max"
                className="w-20 rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={lineDomain?.yMax ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  if (v === null || Number.isNaN(v)) return
                  setLineDomain((d) => ({ ...(d ?? { xMin: 1920, xMax: 2030, yMin: 0, yMax: 10 }), yMax: v }))
                }}
              />
              <button
                type="button"
                onClick={() => setLineDomain(null)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                Reset axes
              </button>
            </div>
            <div className="overflow-x-auto">
              <ExplorationLineChart
                series={lineSeries}
                visibleKeys={lineVisible}
                metric={lineMetric}
                domain={lineDomain}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="How does runtime affect the movie rating?" sectionClassName="mb-8">
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Scatter: runtime vs IMDB rating. <strong>All years</strong>: one point per genre (average across all years). <strong>By year</strong>: one point per movie; axis ranges stay fixed across years.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!scatterUseTimeline}
                  onChange={() => setScatterUseTimeline(false)}
                  className="rounded"
                />
                <span className="text-gray-800 dark:text-gray-200">All years</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scatterUseTimeline}
                  onChange={() => setScatterUseTimeline(true)}
                  className="rounded"
                />
                <span className="text-gray-800 dark:text-gray-200">By year (timeline)</span>
              </label>
              {scatterUseTimeline && scatterYears.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Year:</span>
                  <input
                    type="range"
                    min={scatterYears[0]}
                    max={scatterYears[scatterYears.length - 1]}
                    value={Math.max(scatterYears[0]!, Math.min(scatterYears[scatterYears.length - 1]!, scatterSelectedYear))}
                    onChange={(e) => setScatterSelectedYear(Number(e.target.value))}
                    className="w-40"
                  />
                  <span className="font-medium text-gray-800 dark:text-gray-200">{scatterSelectedYear}</span>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <ExplorationScatter
                points={scatterPoints}
                pointsByGenre={scatterPointsByGenre}
                selectedYear={scatterUseTimeline ? scatterSelectedYear : null}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Data table — filter by column">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                    {table.getHeaderGroups().flatMap((hg) =>
                      hg.headers.map((h) => (
                        <th
                          key={h.id}
                          className="whitespace-nowrap border-r border-gray-200 px-2 py-2 last:border-r-0 dark:border-gray-600"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">
                            {h.column.columnDef.header as string}
                          </div>
                          <input
                            type="text"
                            value={(h.column.getFilterValue() as string) ?? ''}
                            onChange={(e) => h.column.setFilterValue(e.target.value)}
                            placeholder="Filter…"
                            className="mt-1 w-full max-w-[120px] rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 dark:border-gray-700 odd:bg-white even:bg-gray-50/50 dark:odd:bg-gray-900/50 dark:even:bg-gray-800/30"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="max-w-[160px] truncate border-r border-gray-100 px-2 py-1.5 text-gray-700 last:border-r-0 dark:border-gray-700 dark:text-gray-300"
                          title={String(cell.getValue() ?? '')}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-100 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}{' '}
                of {table.getFilteredRowModel().rows.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </span>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Next
                </button>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {[10, 20, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Correlation matrix" sectionClassName="mt-8">
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Correlation between numeric variables (including genre flags as 0/1). Normalized to [-1, 1] so colors are comparable. Red = negative, white = 0, blue = positive.
            </p>
            <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border border-gray-300 bg-gray-200 px-2 py-1.5 text-left font-medium dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    {corrResult.columns.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap border border-gray-300 bg-gray-200 px-2 py-1.5 font-medium text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corrResult.matrix.map((row, i) => (
                    <tr key={corrResult.columns[i]}>
                      <th className="sticky left-0 z-10 border border-gray-300 bg-gray-100 px-2 py-1 text-left font-medium dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                        {corrResult.columns[i]!.replace(/_/g, ' ')}
                      </th>
                      {row.map((val, j) => {
                        const t = Math.max(-1, Math.min(1, val))
                        const r = t <= 0 ? 255 : Math.round(255 * (1 - t))
                        const g = Math.round(255 * (1 - Math.abs(t)))
                        const b = t >= 0 ? 255 : Math.round(255 * (1 + t))
                        const bg = `rgb(${r},${g},${b})`
                        return (
                          <td
                            key={j}
                            className="border border-gray-200 px-1.5 py-0.5 text-right dark:border-gray-600"
                            style={{ backgroundColor: bg }}
                            title={`corr(${corrResult.columns[i]}, ${corrResult.columns[j]}) = ${val.toFixed(3)}`}
                          >
                            {val.toFixed(2)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </>
      )}

      {activeTab === 'visualization' && (
        <section className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center dark:border-gray-600 dark:bg-gray-800/50">
          <h2 className="mb-2 text-xl font-semibold text-gray-700 dark:text-gray-300">
            Visualization task — to be done
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create two non-interactive visualizations from this dataset: one
            honest and one intentionally misleading. Add your charts and
            rationale here.
          </p>
        </section>
      )}
    </div>
  )
}
