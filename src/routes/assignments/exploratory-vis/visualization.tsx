import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/assignments/exploratory-vis/visualization')({
  component: VisualizationTab,
})

function VisualizationTab() {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
        Interactive visualization
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Build an interactive visualization that facilitates understanding of a question for your
        chosen dataset. Consider interaction techniques such as zoom, pan, brush, filter,
        highlight, tooltips, and dynamic query filters.
      </p>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
        Design with Shneiderman&apos;s mantra in mind: &quot;Overview first, zoom and filter, details on demand.&quot;
      </p>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
        Add your interactive visualization implementation here.
      </p>
    </section>
  )
}
