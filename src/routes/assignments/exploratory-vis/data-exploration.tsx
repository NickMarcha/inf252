import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/assignments/exploratory-vis/data-exploration')({
  component: DataExplorationTab,
})

function DataExplorationTab() {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
        Data exploration
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Use this space to explore your chosen dataset before building your interactive visualization.
        The assignment suggests doing exploratory analysis first to determine what subset of the data
        is interesting for your question.
      </p>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
        You can add your exploration charts and analysis here.
      </p>
    </section>
  )
}
