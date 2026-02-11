import { createFileRoute, useMatch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  computeStarCooccurrenceMatrix,
  filterChordDataByActors,
  getConnectionCountRange,
  StarChordChart,
} from '../-exploration-charts'
import type { ExploratoryVisLoaderData } from '../exploratory-vis'

export const Route = createFileRoute('/assignments/exploratory-vis/visualization')({
  component: VisualizationTab,
})

const cmpMovie = (sortBy: 'title' | 'year' | 'imdb' | 'meta') =>
  (a: Record<string, string>, b: Record<string, string>) => {
    if (sortBy === 'title') return (a.Series_Title ?? '').localeCompare(b.Series_Title ?? '')
    if (sortBy === 'year') return Number(a.Released_Year ?? 0) - Number(b.Released_Year ?? 0)
    if (sortBy === 'imdb') return Number(b.IMDB_Rating ?? 0) - Number(a.IMDB_Rating ?? 0)
    if (sortBy === 'meta') return Number(b.Meta_score ?? 0) - Number(a.Meta_score ?? 0)
    return 0
  }

function MoviePosterPanel({
  allMovies,
  filteredMovieIds,
  subtitle,
  sortBy,
  onSortChange,
  onMovieClick,
  selectedMovieId,
}: {
  allMovies: Record<string, string>[]
  filteredMovieIds: Set<string>
  subtitle: string
  sortBy: 'title' | 'year' | 'imdb' | 'meta'
  onSortChange: (s: 'title' | 'year' | 'imdb' | 'meta') => void
  onMovieClick?: (movieId: string) => void
  selectedMovieId?: string | null
}) {
  const sorted = useMemo(() => {
    const filtered = allMovies.filter((m) => filteredMovieIds.has(m.Series_Title ?? ''))
    const rest = allMovies.filter((m) => !filteredMovieIds.has(m.Series_Title ?? ''))
    const cmp = cmpMovie(sortBy)
    return [...filtered.sort(cmp), ...rest.sort(cmp)]
  }, [allMovies, filteredMovieIds, sortBy])

  const stats = useMemo(() => {
    const filtered = sorted.filter((m) => filteredMovieIds.has(m.Series_Title ?? ''))
    const withImdb = filtered.filter((m) => m.IMDB_Rating && !Number.isNaN(Number(m.IMDB_Rating)))
    const withMeta = filtered.filter((m) => m.Meta_score && !Number.isNaN(Number(m.Meta_score)))
    const avgImdb = withImdb.length
      ? withImdb.reduce((s, m) => s + Number(m.IMDB_Rating), 0) / withImdb.length
      : null
    const avgMeta = withMeta.length
      ? withMeta.reduce((s, m) => s + Number(m.Meta_score), 0) / withMeta.length
      : null
    return { count: filtered.length, avgImdb, avgMeta }
  }, [sorted, filteredMovieIds])

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="mb-0.5 font-semibold text-gray-800 dark:text-gray-200">
            {subtitle}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {stats.count} movie{stats.count !== 1 ? 's' : ''}
            {stats.avgImdb != null && ` · Avg IMDB: ${stats.avgImdb.toFixed(1)}`}
            {stats.avgMeta != null && ` · Avg Meta: ${stats.avgMeta.toFixed(1)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as 'title' | 'year' | 'imdb' | 'meta')}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="title">Title</option>
            <option value="year">Year</option>
            <option value="imdb">IMDB</option>
            <option value="meta">Meta</option>
          </select>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((m) => {
          const id = m.Series_Title ?? ''
          const isSelected = selectedMovieId != null && id === selectedMovieId
          const isFiltered = filteredMovieIds.has(id)
          return (
          <div
            key={id || m.Poster_Link || Math.random()}
            role={onMovieClick ? 'button' : undefined}
            tabIndex={onMovieClick ? 0 : undefined}
            onClick={onMovieClick ? () => onMovieClick(id) : undefined}
            onKeyDown={onMovieClick ? (e) => e.key === 'Enter' && onMovieClick(id) : undefined}
            className={`flex flex-col rounded-lg border p-2 transition-all ${
              isSelected
                ? 'cursor-pointer border-blue-500 bg-blue-50 ring-2 ring-blue-400 dark:border-blue-400 dark:bg-blue-900/30 dark:ring-blue-500'
                : isFiltered
                  ? 'cursor-pointer border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:border-gray-500 dark:hover:bg-gray-700/50'
                  : 'cursor-pointer border-gray-200 bg-gray-50 opacity-50 hover:opacity-70 dark:border-gray-600 dark:bg-gray-800/50'
            }`}
          >
            <img
              src={m.Poster_Link ?? ''}
              alt={m.Series_Title ?? 'Unknown'}
              className="aspect-[2/3] w-full rounded object-cover"
              loading="lazy"
            />
            <p className="mt-1.5 truncate text-xs font-medium text-gray-800 dark:text-gray-200">
              {m.Series_Title ?? 'Unknown'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {m.Released_Year ?? '?'} · IMDB: {m.IMDB_Rating ?? '—'} · Meta: {m.Meta_score ?? '—'}
            </p>
          </div>
        )})}
      </div>
    </div>
  )
}

function VisualizationTab() {
  const { rows } = useMatch({
    from: '/assignments/exploratory-vis',
    select: (d) => d.loaderData,
  }) as ExploratoryVisLoaderData

  const years = useMemo(() => {
    const ys = rows.map((r) => Number(r.Released_Year)).filter((y) => !Number.isNaN(y))
    return [...new Set(ys)].sort((a, b) => a - b)
  }, [rows])

  const [starYearMin, setStarYearMin] = useState(2000)
  const [starYearMax, setStarYearMax] = useState(2020)
  const [starMinConnectionSize, setStarMinConnectionSize] = useState(1)
  const [selectedConnection, setSelectedConnection] = useState<{
    actorA: string
    actorB: string
  } | null>(null)
  const [selectedMovie, setSelectedMovie] = useState<string | null>(null)
  const [posterSortBy, setPosterSortBy] = useState<'title' | 'year' | 'imdb' | 'meta'>('imdb')

  const { min: connMin, max: connMax } = useMemo(
    () => getConnectionCountRange(rows, starYearMin, starYearMax),
    [rows, starYearMin, starYearMax]
  )

  const effectiveMinConn = Math.max(connMin, Math.min(connMax, starMinConnectionSize))

  const starChordData = useMemo(
    () =>
      computeStarCooccurrenceMatrix(rows, {
        yearMin: starYearMin,
        yearMax: starYearMax,
        minConnectionSize: effectiveMinConn,
      }),
    [rows, starYearMin, starYearMax, effectiveMinConn]
  )

  useEffect(() => {
    if (starMinConnectionSize < connMin || starMinConnectionSize > connMax) {
      setStarMinConnectionSize(Math.max(connMin, Math.min(connMax, starMinConnectionSize)))
    }
  }, [connMin, connMax, starMinConnectionSize])

  const moviesById = useMemo(() => {
    const map = new Map<string, Record<string, string>>()
    for (const row of rows) {
      const id = row.Series_Title ?? ''
      if (id) map.set(id, row)
    }
    return map
  }, [rows])

  const displayMovies = useMemo(() => {
    if (selectedMovie) {
      const m = moviesById.get(selectedMovie)
      return m ? [m] : []
    }
    const ids = selectedConnection
      ? starChordData.connectionMovies.get(
          [selectedConnection.actorA, selectedConnection.actorB].sort().join('|')
        ) ?? []
      : starChordData.allFilteredMovieIds
    return ids
      .map((id) => moviesById.get(id))
      .filter((m): m is Record<string, string> => m != null)
  }, [selectedMovie, selectedConnection, starChordData, moviesById])

  const chordDataToShow = useMemo(() => {
    if (selectedMovie) {
      const row = moviesById.get(selectedMovie)
      if (!row) return starChordData
      const actors = new Set(
        [row.Star1, row.Star2, row.Star3, row.Star4]
          .map((s) => s?.trim())
          .filter((s): s is string => Boolean(s))
      )
      return filterChordDataByActors(starChordData, actors)
    }
    return starChordData
  }, [selectedMovie, starChordData, moviesById])

  const displaySubtitle = selectedMovie
    ? selectedMovie
    : selectedConnection
      ? `${selectedConnection.actorA} ↔ ${selectedConnection.actorB}`
      : 'All movies (filtered)'

  const allMoviesForPanel = useMemo(() => {
    return starChordData.allFilteredMovieIds
      .map((id) => moviesById.get(id))
      .filter((m): m is Record<string, string> => m != null)
  }, [starChordData.allFilteredMovieIds, moviesById])

  const filteredMovieIds = useMemo(() => {
    const ids = displayMovies.map((m) => m.Series_Title ?? '').filter(Boolean)
    return new Set(ids)
  }, [displayMovies])

  const selectedMovieRow = selectedMovie ? moviesById.get(selectedMovie) : null

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <h2 className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
        Which actors appear together, and what movies do they share?
      </h2>
      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
        Based on IMDB&apos;s top 1000 movies sorted by rating.
      </p>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Click a ribbon to filter movies for that actor pair, or click a movie to filter the chord to show only that movie&apos;s actors. Only one filter can be active at a time. Use &quot;Clear selection&quot; to reset.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-700 dark:text-gray-300">Year:</span>
          <input
            type="number"
            value={starYearMin}
            onChange={(e) => setStarYearMin(Number(e.target.value) || 1920)}
            min={years[0] ?? 1920}
            max={starYearMax}
            className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <span className="text-gray-500">–</span>
          <input
            type="number"
            value={starYearMax}
            onChange={(e) => setStarYearMax(Number(e.target.value) || 2024)}
            min={starYearMin}
            max={years[years.length - 1] ?? 2024}
            className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-700 dark:text-gray-300">Min movies per connection:</span>
          <input
            type="range"
            min={connMin}
            max={connMax}
            value={effectiveMinConn}
            onChange={(e) => setStarMinConnectionSize(Number(e.target.value))}
            className="w-24"
          />
          <span className="font-medium text-gray-800 dark:text-gray-200">{effectiveMinConn}</span>
        </div>
        {(selectedConnection || selectedMovie) && (
          <button
            type="button"
            onClick={() => {
              setSelectedConnection(null)
              setSelectedMovie(null)
            }}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="shrink-0">
          <StarChordChart
            data={chordDataToShow}
            onConnectionClick={(a, b) => {
              setSelectedMovie(null)
              setSelectedConnection((prev) => {
                const key = [a, b].sort().join('|')
                const prevKey = prev ? [prev.actorA, prev.actorB].sort().join('|') : ''
                return key === prevKey ? null : { actorA: a, actorB: b }
              })
            }}
            selectedConnection={selectedMovie ? null : selectedConnection}
          />
        </div>
        <div className="flex max-h-[760px] min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-600 dark:bg-gray-800/30">
          <MoviePosterPanel
            allMovies={allMoviesForPanel}
            filteredMovieIds={filteredMovieIds}
            subtitle={displaySubtitle}
            sortBy={posterSortBy}
            onSortChange={setPosterSortBy}
            onMovieClick={(id) => {
              setSelectedConnection(null)
              setSelectedMovie((prev) => (prev === id ? null : id))
            }}
            selectedMovieId={selectedMovie}
          />
        </div>
      </div>

      {selectedMovieRow && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/30">
          <h4 className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
            {selectedMovieRow.Series_Title ?? 'Unknown'} ({selectedMovieRow.Released_Year ?? '?'})
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Starring: {[selectedMovieRow.Star1, selectedMovieRow.Star2, selectedMovieRow.Star3, selectedMovieRow.Star4]
              .filter((s) => s?.trim())
              .join(' · ')}
          </p>
        </div>
      )}

      <div className="mt-8 space-y-4 border-t border-gray-200 pt-6 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400">
        <p>
          Rationale. The visualization asks which actors appear together and what movies they share. The target tasks are to identify actors who have been in top movies together and to get basic info about the movies they did together (mean IMDB, Meta). The two views feed into each other: clicking a movie shows its actors in the chord; clicking a connection then reveals whether those actors have more movies together. Overview first, filter by ribbon or movie, details on demand.
        </p>
        <p>
          I chose a chord diagram because it encodes pairwise relationships well. With hundreds of actors the chord becomes unreadable, so I limited it by link size (minimum movies per connection). The chord uses D3&apos;s Tableau 10 palette: each actor has one edge colour and each connection has one colour (ribbons blend the two actors at 50%). In a directed diagram colours would signal direction; here the relationship is symmetric so a single colour per connection keeps it simple. I kept the interaction minimal across the two views: mutually exclusive selection (ribbon or movie), reduced opacity for non-filtered movies to preserve context, starring info when a movie is selected. This limits cognitive cost while supporting the tasks.
        </p>
        <p>
          Trade-offs. Compared with spring-adjusted network diagrams, chord clusters are less clear, but you can still identify some groupings. Actor pairs below the connection threshold are hidden. An expansion could show which actors have more connections overall, but for this limited dataset (top 1000) that would mostly reflect who appeared most frequently. When setting min movies per connection to 3, most connections involve popular franchises (Harry Potter, LOTR, Avengers). Outliers like The Prestige (2006) and Zodiac (2007) show up because their actors (e.g. Robert Downey Jr, Mark Ruffalo, Michael Caine, Christian Bale) are also part of Batman and Avengers.
        </p>
      </div>
    </section>
  )
}
