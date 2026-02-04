import { createFileRoute, useMatch } from '@tanstack/react-router'
import Markdown from 'react-markdown'
import type { DeceptiveVizLoaderData } from '../deceptive-viz'

export const Route = createFileRoute('/assignments/deceptive-viz/')({
  component: BriefTab,
})

function BriefTab() {
  const { assignmentMarkdown } = useMatch({
    from: '/assignments/deceptive-viz',
    select: (d) => d.loaderData,
  }) as DeceptiveVizLoaderData
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="markdown-content text-gray-700 dark:text-gray-300 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_strong]:font-semibold">
        <Markdown>{assignmentMarkdown}</Markdown>
      </div>
    </section>
  )
}
