import { createFileRoute, Link, useMatch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  computeStarCooccurrenceMatrix,
  getConnectionCountRange,
  StarChordChart,
} from '../-exploration-charts'
import type { ExploratoryVisLoaderData } from '../exploratory-vis'

export const Route = createFileRoute('/assignments/exploratory-vis/data-exploration')({
  component: DataExplorationTab,
})

function DataExplorationTab() {
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

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
        Data exploration
      </h2>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Use this space to explore your chosen dataset before building your interactive visualization.
        The assignment suggests doing exploratory analysis first to determine what subset of the data
        is interesting for your question.
      </p>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 italic">
        Note: I previously explored this IMDB dataset in the deceptive visualization assignment (
        <Link to="/assignments/deceptive-viz/data-exploration" className="underline hover:text-gray-700 dark:hover:text-gray-300">
          /assignments/deceptive-viz/data-exploration
        </Link>
        ), which informed my choice of the star co-occurrence question for this exercise.
      </p>

      <div className="space-y-8">
        <div>
          <h3 className="mb-3 text-base font-medium text-gray-800 dark:text-gray-200">
            Star relationships — chord diagram
          </h3>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Which actors appear together in movies? Ribbons connect actors who have co-starred; ribbon
            width is proportional to the number of films they share. Filter by year range and minimum
            movies per connection (only show pairs with at least N films together). Right-click a ribbon to copy.
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
          </div>
          <div className="overflow-x-auto">
            <StarChordChart data={starChordData} />
          </div>
        </div>

      </div>
    </section>
  )
}
