import { createFileRoute } from '@tanstack/react-router'
import { csvParse } from 'd3'
import { useMemo, useState } from 'react'

export const Route = createFileRoute('/assignments/deceptive-viz')({
  loader: async () => {
    const base = import.meta.env.BASE_URL
    const res = await fetch(`${base}data/imdb_top_1000.csv`)
    if (!res.ok) throw new Error('Failed to load CSV')
    const text = await res.text()
    const rows = csvParse(text)
    const columns = rows.columns ?? (rows.length ? Object.keys(rows[0] as object) : [])
    return { rows, columns }
  },
  component: DeceptiveVizPage,
})

const PAGE_SIZE = 15
const TABLE_COLUMNS = [
  'Series_Title',
  'Released_Year',
  'Genre',
  'IMDB_Rating',
  'Runtime',
  'Director',
] as const

function DeceptiveVizPage() {
  const { rows, columns } = Route.useLoaderData() as {
    rows: Record<string, string>[]
    columns: string[]
  }
  const [page, setPage] = useState(0)

  const stats = useMemo(() => {
    const years = rows
      .map((r) => Number(r.Released_Year))
      .filter((y) => !Number.isNaN(y))
    const ratings = rows
      .map((r) => Number(r.IMDB_Rating))
      .filter((r) => !Number.isNaN(r))
    return {
      rowCount: rows.length,
      columnCount: columns.length,
      yearMin: years.length ? Math.min(...years) : null,
      yearMax: years.length ? Math.max(...years) : null,
      ratingMin: ratings.length ? Math.min(...ratings).toFixed(1) : null,
      ratingMax: ratings.length ? Math.max(...ratings).toFixed(1) : null,
    }
  }, [rows, columns])

  const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1
  const start = page * PAGE_SIZE
  const pageRows = rows.slice(start, start + PAGE_SIZE)

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
        Programming Exercise 02: Deceptive Visualization
      </h1>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Dataset: IMDB Top 1000. Use the table below to explore the data before
        building honest and misleading visualizations.
      </p>

      <section className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Data overview
        </h2>
        <ul className="grid gap-1 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
          <li>
            <strong>Rows:</strong> {stats.rowCount.toLocaleString()}
          </li>
          <li>
            <strong>Columns:</strong> {stats.columnCount}
          </li>
          <li>
            <strong>Columns:</strong>{' '}
            {columns.slice(0, 8).join(', ')}
            {columns.length > 8 ? ` … (+${columns.length - 8} more)` : ''}
          </li>
          {stats.yearMin != null && stats.yearMax != null && (
            <li>
              <strong>Released year range:</strong> {stats.yearMin} – {stats.yearMax}
            </li>
          )}
          {stats.ratingMin != null && stats.ratingMax != null && (
            <li>
              <strong>IMDB rating range:</strong> {stats.ratingMin} – {stats.ratingMax}
            </li>
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="border-b border-gray-200 bg-gray-100 px-4 py-3 text-lg font-semibold dark:border-gray-700 dark:bg-gray-800 dark:text-white">
          Data table (paginated)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                {TABLE_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2 font-medium text-gray-900 dark:text-white"
                  >
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 dark:border-gray-700 odd:bg-white even:bg-gray-50/50 dark:odd:bg-gray-900/50 dark:even:bg-gray-800/30"
                >
                  {TABLE_COLUMNS.map((col) => (
                    <td
                      key={col}
                      className="max-w-[200px] truncate px-4 py-2 text-gray-700 dark:text-gray-300"
                      title={row[col]}
                    >
                      {row[col] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-100 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Showing {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of{' '}
            {rows.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Previous
            </button>
            <span className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
