import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { csvParse } from 'd3'

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/nickmarcha/inf252/main'
const ASSIGNMENT_MD_URL = `${GITHUB_RAW_BASE}/Assignments/ProgrammingExercise03_Exploratory_Vis.md`

export const Route = createFileRoute('/assignments/exploratory-vis')({
  loader: async () => {
    const base = import.meta.env.BASE_URL
    const [csvRes, mdRes] = await Promise.all([
      fetch(`${base}data/imdb_top_1000.csv`),
      fetch(ASSIGNMENT_MD_URL),
    ])
    if (!csvRes.ok) throw new Error('Failed to load CSV')
    const text = await csvRes.text()
    const parsed = csvParse(text)
    const rows = parsed as unknown as Record<string, string>[]
    const assignmentMarkdown = mdRes.ok ? await mdRes.text() : '*Assignment brief could not be loaded.*'
    return { rows, assignmentMarkdown }
  },
  component: ExploratoryVisLayout,
})

export type ExploratoryVisLoaderData = {
  rows: Record<string, string>[]
  assignmentMarkdown: string
}

function ExploratoryVisLayout() {
  const location = useLocation()
  const pathname = location.pathname
  const isBrief = !pathname.includes('data-exploration') && !pathname.includes('visualization')
  const isExploration = pathname.includes('data-exploration')
  const isVisualization = pathname.includes('visualization')

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
        Programming Exercise 03: Exploratory Visualization
      </h1>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Build an interactive visualization that facilitates understanding of a question for a dataset of your choice.
      </p>

      <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
        <Link
          to="/assignments/exploratory-vis"
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            isBrief
              ? 'bg-white text-gray-900 shadow dark:bg-white/10 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Assignment brief
        </Link>
        <Link
          to="/assignments/exploratory-vis/data-exploration"
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            isExploration
              ? 'bg-white text-gray-900 shadow dark:bg-white/10 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Data exploration
        </Link>
        <Link
          to="/assignments/exploratory-vis/visualization"
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
