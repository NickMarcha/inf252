import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { DisagreementByGenreChart } from '../-exploration-charts'
import type { DisagreementByGenreDatum } from '../-exploration-charts'

/** Static data: mean gap (IMDB rescaled 0–100 minus Meta) by genre, with count. */
const GENRE_GAP_DATA: DisagreementByGenreDatum[] = [
  { genre: 'Film-Noir', meanGap: -18.3, count: 3 },
  { genre: 'Thriller', meanGap: -5.4, count: 1 },
  { genre: 'Animation', meanGap: -4.1, count: 75 },
  { genre: 'Family', meanGap: -3.4, count: 2 },
  { genre: 'Horror', meanGap: -3.2, count: 11 },
  { genre: 'Drama', meanGap: -2.6, count: 241 },
  { genre: 'Comedy', meanGap: -2.3, count: 125 },
  { genre: 'Adventure', meanGap: -1.4, count: 64 },
  { genre: 'Mystery', meanGap: -0.9, count: 8 },
  { genre: 'Crime', meanGap: 0.6, count: 87 },
  { genre: 'Biography', meanGap: 0.7, count: 79 },
  { genre: 'Western', meanGap: 3.4, count: 4 },
  { genre: 'Action', meanGap: 3.6, count: 143 },
]

export const Route = createFileRoute('/assignments/deceptive-viz/visualization')({
  component: VisualizationTab,
})

const CHART_WRAPPER_CLASS =
  'rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/50'

function VisualizationTab() {
  const chart1Data = useMemo(() => [...GENRE_GAP_DATA], [])
  const chart2Data = useMemo(
    () =>
      [...GENRE_GAP_DATA].sort(
        (a, b) => Math.abs(b.meanGap) - Math.abs(a.meanGap)
      ),
    []
  )

  return (
    <section className="space-y-12">
      <div className="space-y-8">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Visualization task
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Two non-interactive visualizations from the same IMDB/Meta dataset.
          See rationale below for design choices and which is which.
        </p>

        <div className="grid gap-10 lg:grid-cols-1">
          <div className={CHART_WRAPPER_CLASS}>
            <h3 className="mb-3 text-base font-medium text-gray-800 dark:text-gray-200">
              Where do audiences and critics disagree? Mean gap by genre.
            </h3>
            <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              Mean gap = average per genre of (IMDB rating rescaled 1–10 → 0–100) − (Meta score). Positive = audiences rate higher than critics; negative = critics rate higher.
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[#3182bd]" aria-hidden />
                Audiences rate higher (positive gap)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[#e34a33]" aria-hidden />
                Critics rate higher (negative gap)
              </span>
            </div>
            <DisagreementByGenreChart
              data={chart1Data}
              showCount={true}
              barOutline={true}
              opacityByCount={true}
              boldCountWhenOne={true}
              highlightZeroLine={true}
              caption="Bar opacity reflects sample size up to n=100 (more transparent = fewer films). Bold n = very small sample (n=1). n = number of movies in that genre (with Meta score). Interpret with caution for genres with fewer than 12 films."
            />
          </div>

          <div className={CHART_WRAPPER_CLASS}>
            <h3 className="mb-3 text-base font-medium text-gray-800 dark:text-gray-200">
              Which genres are most controversial? Audience–critic gap by genre.
            </h3>
            <DisagreementByGenreChart
              data={chart2Data}
              showCount={false}
              caption={null}
              boldLabelsByGap={true}
              colorBarsByMagnitude={true}
            />
          </div>
        </div>

        <div className={`${CHART_WRAPPER_CLASS} border-dashed`}>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Rationale
          </h3>
          <div className="prose prose-sm max-w-none text-gray-600 dark:prose-invert dark:text-gray-400">
            <p>
              <strong>Questions.</strong> Chart 1: “Where do audiences and
              critics disagree? Mean gap by genre.” Chart 2: “Which genres are
              most controversial?” Both use the same data (mean gap, IMDB
              rescaled 0–100 minus Meta, by genre; 843 films with Meta scores).
            </p>
            <p>
              <strong>Which is deceptive?</strong> The <em>second</em> chart.
              It looks legitimate but steers viewers to overinterpret large
              gaps in genres with very few films (e.g. Film-Noir n=3, Thriller
              n=1).
            </p>
            <p>
              <strong>Honest design (first).</strong> Sorted by mean gap; every
              bar shows n. Opacity encodes sample size (paler = fewer films);
              n=1 is bolded. Zero line and axis labels (“Critics higher ←”,
              “→ Audiences higher”) make direction clear. Caption explains
              encoding and warns about genres with &lt;12 films. Blue =
              audiences higher, red = critics higher.
            </p>
            <p>
              <strong>Deceptive design (second).</strong> Data re-sorted by
              |gap| so “controversial” genres appear first. n is omitted. Bars
              are colored by distance from zero (green 0–2, yellow 2–4, red 4+),
              so large gaps look “bad” and direction (audiences vs critics) is
              hidden. Labels for large |gap| are bolded. No caption. Looks fair
              but encourages misreading.
            </p>
            <p>
              <strong>Color.</strong> Honest: blue/red encode direction; opacity
              encodes n. Deceptive: green–yellow–red by |gap| highlights
              “controversy” and obscures who rates higher; no n.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
