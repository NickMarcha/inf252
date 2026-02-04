import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { createFileRoute, useMatch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  CollapsibleSection,
  computeColumnStats,
  computeCorrelationMatrix,
  stringFilter,
  type DeceptiveVizLoaderData,
} from '../deceptive-viz'
import {
  computeCriticsVsAudiencePoints,
  computeDisagreementByGenre,
  computeDisagreementByYear,
  computeLineSeries,
  computeScatterPoints,
  computeScatterPointsByGenre,
  CriticsVsAudienceScatter,
  DisagreementByGenreChart,
  DisagreementByYearChart,
  ExplorationLineChart,
  ExplorationScatter,
  genreDisplayName,
} from '../-exploration-charts'

const EXPLORATION_SECTIONS = [
  { id: 'data-overview', label: 'Data overview' },
  { id: 'which-years', label: 'Which years' },
  { id: 'runtime', label: 'Runtime vs rating' },
  { id: 'critics-vs-audiences', label: 'Critics vs audiences' },
  { id: 'disagreement', label: 'Biggest disagreements' },
  { id: 'gap-over-time', label: 'Gap over time' },
  { id: 'runtime-consensus', label: 'Runtime & consensus' },
  { id: 'box-office', label: 'Box office vs critics' },
  { id: 'genre-over-time', label: 'Genre over time' },
  { id: 'directors', label: 'Directors' },
  { id: 'data-table', label: 'Data table' },
  { id: 'correlation-matrix', label: 'Correlation matrix' },
] as const

export const Route = createFileRoute('/assignments/deceptive-viz/data-exploration')({
  component: DataExplorationTab,
})

function DataExplorationTab() {
  const { rows, columns } = useMatch({
    from: '/assignments/deceptive-viz',
    select: (d) => d.loaderData,
  }) as DeceptiveVizLoaderData

  /** Part 2: only rows with a valid Meta score (critics vs audiences comparison) */
  const rowsWithMeta = useMemo(
    () =>
      rows.filter((r) => {
        const m = r.Meta_score?.trim()
        return m !== '' && !Number.isNaN(Number(m))
      }),
    [rows]
  )
  const criticsVsAudiencePoints = useMemo(
    () => computeCriticsVsAudiencePoints(rowsWithMeta),
    [rowsWithMeta]
  )
  const disagreementByYear = useMemo(
    () => computeDisagreementByYear(rowsWithMeta),
    [rowsWithMeta]
  )
  const disagreementByGenre = useMemo(
    () => computeDisagreementByGenre(rowsWithMeta),
    [rowsWithMeta]
  )

  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EXPLORATION_SECTIONS.map((s) => [s.id, false]))
  )
  const setSection = (id: string, open: boolean) => {
    setSectionOpen((prev) => ({ ...prev, [id]: open }))
  }
  const expandAll = () => setSectionOpen(() => Object.fromEntries(EXPLORATION_SECTIONS.map((s) => [s.id, true])))
  const collapseAll = () => setSectionOpen(() => Object.fromEntries(EXPLORATION_SECTIONS.map((s) => [s.id, false])))

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      const el = document.getElementById(hash)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
    scrollToHash()
    window.addEventListener('hashchange', scrollToHash)
    return () => window.removeEventListener('hashchange', scrollToHash)
  }, [])

  const genreColumns = useMemo(() => columns.filter((c) => c.startsWith('is') && c.length > 2), [columns])
  const [lineMetric, setLineMetric] = useState<'imdb' | 'meta'>('imdb')
  const [lineVisible, setLineVisible] = useState<Set<string>>(() => new Set(['All']))
  const [lineDomain, setLineDomain] = useState<{ xMin: number; xMax: number; yMin: number; yMax: number } | null>(null)
  const [scatterUseTimeline, setScatterUseTimeline] = useState(false)
  const [scatterShowAllMovies, setScatterShowAllMovies] = useState(false)
  const [scatterMetric, setScatterMetric] = useState<'imdb' | 'meta'>('imdb')
  const scatterYears = useMemo(() => {
    const ys = rows.map((r) => Number(r.Released_Year)).filter((y) => !Number.isNaN(y))
    return [...new Set(ys)].sort((a, b) => a - b)
  }, [rows])
  const [scatterSelectedYear, setScatterSelectedYear] = useState(2020)

  const lineSeries = useMemo(
    () => computeLineSeries(rows, genreColumns, lineMetric),
    [rows, genreColumns, lineMetric]
  )
  const scatterPoints = useMemo(
    () => computeScatterPoints(rows, scatterMetric),
    [rows, scatterMetric]
  )
  const scatterPointsByGenre = useMemo(
    () => computeScatterPointsByGenre(rows, scatterMetric),
    [rows, scatterMetric]
  )

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
    <>
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-100/95 px-3 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
        <span className="mr-2 text-xs font-medium text-gray-600 dark:text-gray-400">Sections:</span>
        <button
          type="button"
          onClick={expandAll}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Collapse all
        </button>
        <span className="mx-1 text-gray-400">|</span>
        {EXPLORATION_SECTIONS.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
          >
            {label}
          </a>
        ))}
      </div>

      <CollapsibleSection
        id="data-overview"
        title="Data overview — all columns"
        sectionClassName="mb-8"
        open={sectionOpen['data-overview']}
        onToggle={() => setSection('data-overview', !sectionOpen['data-overview'])}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          <strong>Rows:</strong> {rows.length.toLocaleString()} · <strong>Columns:</strong> {columns.length}
        </p>
        <div className="space-y-6">
          {columnStats.map((col) => (
            <div
              key={col.name}
              className="rounded border border-gray-200 bg-white p-4 dark:border-gray-600 dark:bg-gray-800/50"
            >
              <h3 className="mb-2 font-medium text-gray-900 dark:text-white">{col.name.replace(/_/g, ' ')}</h3>
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
                      <strong>Mean:</strong>{' '}
                      {typeof col.numeric.mean === 'number' && col.numeric.mean % 1 !== 0
                        ? col.numeric.mean.toFixed(2)
                        : col.numeric.mean.toLocaleString()}
                    </li>
                    <li>
                      <strong>Median:</strong>{' '}
                      {typeof col.numeric.median === 'number' && col.numeric.median % 1 !== 0
                        ? col.numeric.median.toFixed(2)
                        : col.numeric.median.toLocaleString()}
                    </li>
                    <li>
                      <strong>Count (non-missing):</strong> {col.numeric.count}
                      {col.numeric.missing > 0 && (
                        <>
                          {' '}
                          · <strong>Missing:</strong> {col.numeric.missing}
                        </>
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
                        <strong>Sample:</strong> {col.categorical.sample.slice(0, 5).join(', ')}
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

      <CollapsibleSection
        id="which-years"
        title="Which years have better movies?"
        sectionClassName="mb-8"
        open={sectionOpen['which-years']}
        onToggle={() => setSection('which-years', !sectionOpen['which-years'])}
      >
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

      <CollapsibleSection
        id="runtime"
        title="How does runtime affect the movie rating?"
        sectionClassName="mb-8"
        open={sectionOpen['runtime']}
        onToggle={() => setSection('runtime', !sectionOpen['runtime'])}
      >
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Scatter: runtime vs rating. Choose rating type (IMDB or Meta score), then view by genre average, all
              movies (colored by genre), or one year at a time.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-gray-700 dark:text-gray-300">Rating:</span>
                <select
                  value={scatterMetric}
                  onChange={(e) => setScatterMetric(e.target.value as 'imdb' | 'meta')}
                  className="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="imdb">IMDB Rating</option>
                  <option value="meta">Meta score</option>
                </select>
              </label>
              <span className="text-gray-500 dark:text-gray-400">|</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scatter-mode"
                  checked={!scatterShowAllMovies && !scatterUseTimeline}
                  onChange={() => {
                    setScatterShowAllMovies(false)
                    setScatterUseTimeline(false)
                  }}
                  className="rounded"
                />
                <span className="text-gray-800 dark:text-gray-200">By genre (avg)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scatter-mode"
                  checked={scatterShowAllMovies}
                  onChange={() => {
                    setScatterShowAllMovies(true)
                    setScatterUseTimeline(false)
                  }}
                  className="rounded"
                />
                <span className="text-gray-800 dark:text-gray-200">All movies</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scatter-mode"
                  checked={scatterUseTimeline}
                  onChange={() => {
                    setScatterShowAllMovies(false)
                    setScatterUseTimeline(true)
                  }}
                  className="rounded"
                />
                <span className="text-gray-800 dark:text-gray-200">By year</span>
              </label>
              {scatterUseTimeline && scatterYears.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Year:</span>
                  <input
                    type="range"
                    min={scatterYears[0]}
                    max={scatterYears[scatterYears.length - 1]}
                    value={Math.max(
                      scatterYears[0]!,
                      Math.min(scatterYears[scatterYears.length - 1]!, scatterSelectedYear)
                    )}
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
                showAllMovies={scatterShowAllMovies}
                metric={scatterMetric}
              />
            </div>
          </CollapsibleSection>

      <CollapsibleSection
        id="critics-vs-audiences"
        title="Exploration part 2: Critics vs audiences"
        sectionClassName="mb-8"
        open={sectionOpen['critics-vs-audiences']}
        onToggle={() => setSection('critics-vs-audiences', !sectionOpen['critics-vs-audiences'])}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Meta score comes from professional critics (Metacritic); IMDB rating is audience-driven. Not every film has a
          Meta score, so here we use only the <strong>{rowsWithMeta.length} movies</strong> that have both scores. Do
          critics and audiences agree? Points on the diagonal = agreement; above = audiences rate higher than critics;
          below = critics rate higher.
        </p>
        <div className="overflow-x-auto">
          <CriticsVsAudienceScatter points={criticsVsAudiencePoints} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="disagreement"
        title="Where do critics and audiences disagree most?"
        sectionClassName="mb-8"
        open={sectionOpen['disagreement']}
        onToggle={() => setSection('disagreement', !sectionOpen['disagreement'])}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Gap = IMDB rescaled from 1–10 to 0–100 minus Meta (positive = audiences rate higher than critics). Below: mean gap by release year, then
          by genre. Western and Film-Noir may look extreme due to few entries (check n).
        </p>
        <div className="space-y-8">
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
              Mean gap by release year
            </h3>
            <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              Zero line = agreement. Above = audiences rate higher on average that year; below = critics rate higher.
            </p>
            <div className="overflow-x-auto">
              <DisagreementByYearChart data={disagreementByYear} />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
              Mean gap by genre (diverging bars)
            </h3>
            <div className="overflow-x-auto">
              <DisagreementByGenreChart data={disagreementByGenre} />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="gap-over-time"
        title="Has the critic–audience gap changed over time?"
        sectionClassName="mb-8"
        open={sectionOpen['gap-over-time']}
        onToggle={() => setSection('gap-over-time', !sectionOpen['gap-over-time'])}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          By decade (or year): average IMDB, average Meta, and average gap for the {rowsWithMeta.length} movies with
          Meta. Answers “Among these audience favorites, have critics and audiences converged over time?” — selection is
          top 1000 by IMDB, so frame accordingly.
        </p>
        <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
          Visualization to be added.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        id="runtime-consensus"
        title="Do longer movies have stronger consensus?"
        sectionClassName="mb-8"
        open={sectionOpen['runtime-consensus']}
        onToggle={() => setSection('runtime-consensus', !sectionOpen['runtime-consensus'])}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Within the {rowsWithMeta.length} movies with Meta: bin by runtime (e.g. &lt;90, 90–120, 120–150, 150+ min) and
          compute mean gap or variance of gap between Meta and IMDB. Explores whether consensus (critic–audience
          agreement) varies with film length.
        </p>
        <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
          Visualization to be added.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        id="box-office"
        title="Box office vs critical reception"
        sectionClassName="mb-8"
        open={sectionOpen['box-office']}
        onToggle={() => setSection('box-office', !sectionOpen['box-office'])}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          For movies with Gross: scatter or binned view of box office (Gross) vs Meta score or vs gap to IMDB. Asks “Do
          blockbusters get better critic scores?” within this top-1000-by-IMDB set. Note: Gross has missing values.
        </p>
        <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
          Visualization to be added.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        id="genre-over-time"
        title="Genre representation over time"
        sectionClassName="mb-8"
        open={sectionOpen['genre-over-time']}
        onToggle={() => setSection('genre-over-time', !sectionOpen['genre-over-time'])}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Count or proportion of the top 1000 by genre by decade (or 5-year bins). Explores whether audience top-1000
          lists are dominated by certain genres in recent decades (e.g. more Action, Sci-Fi in the 2000s).
        </p>
        <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
          Visualization to be added.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        id="directors"
        title="Directors with multiple entries"
        sectionClassName="mb-8"
        open={sectionOpen['directors']}
        onToggle={() => setSection('directors', !sectionOpen['directors'])}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Which directors have the most films in the top 1000? For those with several films, compare average Meta vs
          average IMDB (or average gap). Asks whether some directors consistently get more critic vs audience love.
        </p>
        <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
          Visualization to be added.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        id="data-table"
        title="Data table — filter by column"
        open={sectionOpen['data-table']}
        onToggle={() => setSection('data-table', !sectionOpen['data-table'])}
      >
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

      <CollapsibleSection
        id="correlation-matrix"
        title="Correlation matrix"
        sectionClassName="mt-8"
        open={sectionOpen['correlation-matrix']}
        onToggle={() => setSection('correlation-matrix', !sectionOpen['correlation-matrix'])}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Correlation between numeric variables (including genre flags as 0/1). Normalized to [-1, 1] so colors are
          comparable. Red = negative, white = 0, blue = positive.
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
  )
}
