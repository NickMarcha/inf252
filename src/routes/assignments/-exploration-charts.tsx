import * as d3 from 'd3'
import { useEffect, useMemo, useRef } from 'react'

function parseRuntime(s: string): number | null {
  if (!s) return null
  const m = s.trim().match(/^(\d+)\s*min/i)
  return m ? Number(m[1]) : null
}

export interface LineSeriesDatum {
  year: number
  value: number
}

export interface LineSeries {
  key: string
  values: LineSeriesDatum[]
}

export function computeLineSeries(
  rows: Record<string, string>[],
  genreColumns: string[],
  metric: 'imdb' | 'meta'
): LineSeries[] {
  const key = metric === 'imdb' ? 'IMDB_Rating' : 'Meta_score'
  const series: LineSeries[] = []

  const yearValues = new Map<number, number[]>()
  for (const row of rows) {
    const y = Number(row.Released_Year)
    const v = Number(row[key])
    if (Number.isNaN(y) || Number.isNaN(v)) continue
    if (!yearValues.has(y)) yearValues.set(y, [])
    yearValues.get(y)!.push(v)
  }
  const allPoints = [...yearValues.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, vals]) => ({ year, value: vals.reduce((a, b) => a + b, 0) / vals.length }))
  series.push({ key: 'All', values: allPoints })

  for (const col of genreColumns) {
    const yearValuesG = new Map<number, number[]>()
    for (const row of rows) {
      if (row[col] !== 'true') continue
      const y = Number(row.Released_Year)
      const v = Number(row[key])
      if (Number.isNaN(y) || Number.isNaN(v)) continue
      if (!yearValuesG.has(y)) yearValuesG.set(y, [])
      yearValuesG.get(y)!.push(v)
    }
    const points = [...yearValuesG.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, vals]) => ({ year, value: vals.reduce((a, b) => a + b, 0) / vals.length }))
    if (points.length > 0) series.push({ key: col, values: points })
  }
  return series
}

export interface ScatterPoint {
  runtime: number
  rating: number
  genre: string
  year: number
}

/** One point per genre: average runtime and rating across all years */
export interface ScatterPointByGenre {
  genre: string
  runtime: number
  rating: number
  count: number
}

export function computeScatterPoints(
  rows: Record<string, string>[],
  metric: 'imdb' | 'meta' = 'imdb'
): ScatterPoint[] {
  const key = metric === 'imdb' ? 'IMDB_Rating' : 'Meta_score'
  const points: ScatterPoint[] = []
  for (const row of rows) {
    const runtime = parseRuntime(row.Runtime ?? '')
    const rating = Number(row[key])
    const year = Number(row.Released_Year)
    const genreStr = row.Genre ?? ''
    const firstGenre = genreStr.split(',')[0]?.trim() ?? 'Other'
    if (runtime == null || Number.isNaN(rating) || Number.isNaN(year)) continue
    points.push({ runtime, rating, genre: firstGenre, year })
  }
  return points
}

export function computeScatterPointsByGenre(
  rows: Record<string, string>[],
  metric: 'imdb' | 'meta' = 'imdb'
): ScatterPointByGenre[] {
  const key = metric === 'imdb' ? 'IMDB_Rating' : 'Meta_score'
  const byGenre = new Map<string, { runtime: number[]; rating: number[] }>()
  for (const row of rows) {
    const runtime = parseRuntime(row.Runtime ?? '')
    const rating = Number(row[key])
    const genreStr = row.Genre ?? ''
    const genre = genreStr.split(',')[0]?.trim() ?? 'Other'
    if (runtime == null || Number.isNaN(rating)) continue
    if (!byGenre.has(genre)) byGenre.set(genre, { runtime: [], rating: [] })
    byGenre.get(genre)!.runtime.push(runtime)
    byGenre.get(genre)!.rating.push(rating)
  }
  return [...byGenre.entries()]
    .map(([genre, { runtime, rating }]) => ({
      genre,
      runtime: runtime.reduce((a, b) => a + b, 0) / runtime.length,
      rating: rating.reduce((a, b) => a + b, 0) / rating.length,
      count: runtime.length,
    }))
    .sort((a, b) => a.genre.localeCompare(b.genre))
}

export function genreDisplayName(key: string): string {
  if (key === 'All') return 'All'
  const withoutIs = key.startsWith('is') ? key.slice(2) : key
  return withoutIs.charAt(0).toUpperCase() + withoutIs.slice(1)
}

/** One point per movie with both Meta score and IMDB rating (critics vs audiences) */
export interface CriticsVsAudiencePoint {
  meta: number
  imdb: number
  genre: string
  title: string
}

export function computeCriticsVsAudiencePoints(
  rows: Record<string, string>[]
): CriticsVsAudiencePoint[] {
  const points: CriticsVsAudiencePoint[] = []
  for (const row of rows) {
    const meta = Number(row.Meta_score?.trim())
    const imdb = Number(row.IMDB_Rating?.trim())
    const genreStr = row.Genre ?? ''
    const firstGenre = genreStr.split(',')[0]?.trim() ?? 'Other'
    const title = row.Series_Title ?? 'Unknown'
    if (Number.isNaN(meta) || Number.isNaN(imdb)) continue
    points.push({ meta, imdb, genre: firstGenre, title })
  }
  return points
}

/** Rescale IMDB from [1,10] to [0,100] then gap = that − Meta. Positive = audiences rate higher. */
const IMDB_TO_100 = (imdb: number) => ((imdb - 1) / 9) * 100

export interface DisagreementByYearDatum {
  year: number
  meanGap: number
  meanMeta: number
  meanImdbRescaled: number
  /** Average of meanMeta and meanImdbRescaled (midline for difference chart) */
  meanAvg: number
  count: number
}

export function computeDisagreementByYear(
  rows: Record<string, string>[]
): DisagreementByYearDatum[] {
  const byYear = new Map<
    number,
    { metas: number[]; imdbRescaled: number[]; gaps: number[] }
  >()
  for (const row of rows) {
    const meta = Number(row.Meta_score?.trim())
    const imdb = Number(row.IMDB_Rating?.trim())
    const year = Number(row.Released_Year)
    if (Number.isNaN(meta) || Number.isNaN(imdb) || Number.isNaN(year)) continue
    const imdbRescaled = IMDB_TO_100(imdb)
    const gap = imdbRescaled - meta
    if (!byYear.has(year))
      byYear.set(year, { metas: [], imdbRescaled: [], gaps: [] })
    const entry = byYear.get(year)!
    entry.metas.push(meta)
    entry.imdbRescaled.push(imdbRescaled)
    entry.gaps.push(gap)
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, { metas, imdbRescaled, gaps }]) => {
      const meanMeta = metas.reduce((a, b) => a + b, 0) / metas.length
      const meanImdbRescaled =
        imdbRescaled.reduce((a, b) => a + b, 0) / imdbRescaled.length
      return {
        year,
        meanGap: gaps.reduce((a, b) => a + b, 0) / gaps.length,
        meanMeta,
        meanImdbRescaled,
        meanAvg: (meanMeta + meanImdbRescaled) / 2,
        count: gaps.length,
      }
    })
}

export interface DisagreementByGenreDatum {
  genre: string
  meanGap: number
  count: number
}

export function computeDisagreementByGenre(
  rows: Record<string, string>[]
): DisagreementByGenreDatum[] {
  const byGenre = new Map<string, number[]>()
  for (const row of rows) {
    const meta = Number(row.Meta_score?.trim())
    const imdb = Number(row.IMDB_Rating?.trim())
    const genreStr = row.Genre ?? ''
    const genre = genreStr.split(',')[0]?.trim() ?? 'Other'
    if (Number.isNaN(meta) || Number.isNaN(imdb)) continue
    const gap = IMDB_TO_100(imdb) - meta
    if (!byGenre.has(genre)) byGenre.set(genre, [])
    byGenre.get(genre)!.push(gap)
  }
  return [...byGenre.entries()]
    .map(([genre, gaps]) => ({
      genre,
      meanGap: gaps.reduce((a, b) => a + b, 0) / gaps.length,
      count: gaps.length,
    }))
    .sort((a, b) => a.meanGap - b.meanGap)
}

/** Pearson correlation coefficient */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX
    const dy = y[i]! - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  return den < 1e-10 ? 0 : num / den
}

/** Linear regression y = slope * x + intercept (minimizes SSE) */
export function linearRegression(
  x: number[],
  y: number[]
): { slope: number; intercept: number } {
  const n = Math.min(x.length, y.length)
  if (n < 2) return { slope: 0, intercept: 0 }
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX
    num += dx * (y[i]! - meanY)
    den += dx * dx
  }
  const slope = den < 1e-10 ? 0 : num / den
  const intercept = meanY - slope * meanX
  return { slope, intercept }
}

const CHART_WIDTH = 928
const LINE_CHART_HEIGHT = 500
const SCATTER_HEIGHT = 600
const M = { top: 25, right: 30, bottom: 35, left: 45 }

export interface ExplorationLineChartProps {
  series: LineSeries[]
  visibleKeys: Set<string>
  metric: 'imdb' | 'meta'
  domain: { xMin: number; xMax: number; yMin: number; yMax: number } | null
}

const GENRE_COLORS = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
]

function getSeriesColor(key: string, index: number): string {
  return key === 'All' ? '#333' : GENRE_COLORS[index % GENRE_COLORS.length]
}

export function ExplorationLineChart({
  series,
  visibleKeys,
  metric,
  domain,
}: ExplorationLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || series.length === 0) return
    const visible = series.filter((s) => visibleKeys.has(s.key))
    if (visible.length === 0) return

    const allYears = visible.flatMap((s) => s.values.map((d) => d.year))
    const allValues = visible.flatMap((s) => s.values.map((d) => d.value))
    const dataXMin = Math.min(...allYears)
    const dataXMax = Math.max(...allYears)
    const dataYMin = Math.min(...allValues)
    const dataYMax = Math.max(...allValues)
    const xMin = domain && !Number.isNaN(domain.xMin) ? domain.xMin : dataXMin
    const xMax = domain && !Number.isNaN(domain.xMax) ? domain.xMax : dataXMax
    const yMin = domain && !Number.isNaN(domain.yMin) ? domain.yMin : dataYMin
    const yMax = domain && !Number.isNaN(domain.yMax) ? domain.yMax : dataYMax

    const x = d3
      .scaleLinear()
      .domain([xMin, xMax])
      .range([M.left, CHART_WIDTH - M.right])
    const y = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .range([LINE_CHART_HEIGHT - M.bottom, M.top])

    const line = d3
      .line<LineSeriesDatum>()
      .x((d) => x(d.year))
      .y((d) => y(d.value))

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', [0, 0, CHART_WIDTH, LINE_CHART_HEIGHT])
      .attr('style', 'max-width: 100%; height: auto; font: 10px sans-serif;')
      .style('overflow', 'visible')
      .style('-webkit-tap-highlight-color', 'transparent')

    svg
      .append('g')
      .attr('transform', `translate(0,${LINE_CHART_HEIGHT - M.bottom})`)
      .call(d3.axisBottom(x).ticks(Math.min(20, xMax - xMin + 1)).tickSizeOuter(0))

    svg
      .append('g')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(LINE_CHART_HEIGHT / 50))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('.tick line')
          .clone()
          .attr('x2', CHART_WIDTH - M.left - M.right)
          .attr('stroke-opacity', 0.1)
      )
      .call((g) =>
        g
          .append('text')
          .attr('x', -M.left)
          .attr('y', 10)
          .attr('fill', 'currentColor')
          .attr('text-anchor', 'start')
          .text(`↑ Avg ${metric === 'imdb' ? 'IMDB Rating' : 'Meta score'}`)
      )

    visible.forEach((s, i) => {
      const color = getSeriesColor(s.key, i)
      svg
        .append('path')
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', s.key === 'All' ? 2.5 : 1.5)
        .attr('d', line(s.values) ?? '')
    })

    const tooltip = svg.append('g').attr('pointer-events', 'none').style('display', 'none')

    function pointermoved(event: MouseEvent) {
      const px = d3.pointer(event)[0]
      const yearVal = x.invert(px)
      tooltip.style('display', null)
      const allYears = visible.flatMap((s) => s.values.map((d) => d.year))
      const sortedYears = [...new Set(allYears)].sort((a, b) => a - b)
      const i = d3.bisectCenter(sortedYears, yearVal)
      const nearestYear = sortedYears[Math.max(0, Math.min(i, sortedYears.length - 1))] ?? sortedYears[0]
      const tx = x(nearestYear)
      const firstSeries = visible.find((s) => s.values.some((d) => d.year === nearestYear))
      const ty = firstSeries
        ? y(firstSeries.values.find((d) => d.year === nearestYear)!.value)
        : LINE_CHART_HEIGHT / 2
      tooltip.attr('transform', `translate(${tx},${ty})`)
      const lines: string[] = [`Year: ${nearestYear}`]
      visible.forEach((s) => {
        const pt = s.values.find((d) => d.year === nearestYear)
        if (pt) lines.push(`${genreDisplayName(s.key)}: ${pt.value.toFixed(2)}`)
      })
      const path = tooltip
        .selectAll('path')
        .data([1])
        .join('path')
        .attr('fill', 'white')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
      const text = tooltip
        .selectAll('text')
        .data([1])
        .join('text')
        .call((t) =>
          t
            .selectAll('tspan')
            .data(lines)
            .join('tspan')
            .attr('x', 0)
            .attr('y', (_, i) => `${i * 1.1}em`)
            .attr('font-weight', (_: string, i: number) => (i === 0 ? 'bold' : null))
            .text((d) => d)
        )
      const node = text.node()
      if (node) {
        const b = (node as SVGTextElement).getBBox()
        text.attr('transform', `translate(${-b.width / 2},${15 - b.y})`)
        path.attr(
          'd',
          `M${-b.width / 2 - 10},5H-5l5,-5l5,5H${b.width / 2 + 10}v${b.height + 20}h-${b.width + 20}z`
        )
      }
    }
    function pointerleft() {
      tooltip.style('display', 'none')
    }
    svg.on('pointerenter pointermove', pointermoved).on('pointerleave', pointerleft)
    return () => {
      svg.on('pointerenter pointermove', null).on('pointerleave', null)
    }
  }, [series, visibleKeys, metric, domain])

  const visible = series.filter((s) => visibleKeys.has(s.key))
  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <svg ref={svgRef} width={CHART_WIDTH} height={LINE_CHART_HEIGHT} className="overflow-visible" />
      <div className="flex flex-wrap gap-4 text-xs">
        {visible.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ backgroundColor: getSeriesColor(s.key, i), height: s.key === 'All' ? 3 : 2 }}
            />
            <span className="text-gray-700 dark:text-gray-300">{genreDisplayName(s.key)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export interface ExplorationScatterProps {
  points: ScatterPoint[]
  pointsByGenre: ScatterPointByGenre[]
  /** null = show one point per genre (avg); number = filter to that year, one point per movie */
  selectedYear: number | null
  /** true = one point per movie, all years, colored by genre */
  showAllMovies?: boolean
  metric?: 'imdb' | 'meta'
}

export function ExplorationScatter({
  points,
  pointsByGenre,
  selectedYear,
  showAllMovies = false,
  metric = 'imdb',
}: ExplorationScatterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isByYear = selectedYear != null && !showAllMovies
  const displayPoints = showAllMovies
    ? points
    : isByYear
      ? points.filter((p) => p.year === selectedYear)
      : pointsByGenre.map((p) => ({ ...p, year: 0 }))
  const genres = [...new Set(displayPoints.map((p) => p.genre))].sort()
  const colorScale = d3.scaleOrdinal<string, string>().domain(genres).range(GENRE_COLORS)

  const xDomain = (showAllMovies || isByYear
    ? d3.extent(points, (d) => d.runtime)
    : d3.extent(pointsByGenre, (d) => d.runtime)) as [number, number]
  const yDomain = (showAllMovies || isByYear
    ? d3.extent(points, (d) => d.rating)
    : d3.extent(pointsByGenre, (d) => d.rating)) as [number, number]

  useEffect(() => {
    if (!svgRef.current) return

    const x = d3
      .scaleLinear()
      .domain(xDomain)
      .nice()
      .range([M.left, CHART_WIDTH - M.right])
    const y = d3
      .scaleLinear()
      .domain(yDomain)
      .nice()
      .range([SCATTER_HEIGHT - M.bottom, M.top])

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', [0, 0, CHART_WIDTH, SCATTER_HEIGHT])
      .attr('style', 'max-width: 100%; height: auto; font: 10px sans-serif;')
      .style('overflow', 'visible')

    svg
      .append('g')
      .attr('transform', `translate(0,${SCATTER_HEIGHT - M.bottom})`)
      .call(d3.axisBottom(x).ticks(CHART_WIDTH / 80))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .append('text')
          .attr('x', CHART_WIDTH)
          .attr('y', M.bottom - 4)
          .attr('fill', 'currentColor')
          .attr('text-anchor', 'end')
          .text('Runtime (min) →')
      )

    svg
      .append('g')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .append('text')
          .attr('x', -M.left)
          .attr('y', 10)
          .attr('fill', 'currentColor')
          .attr('text-anchor', 'start')
          .text(metric === 'imdb' ? '↑ IMDB Rating' : '↑ Meta score')
      )

    svg
      .append('g')
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.1)
      .call((g) =>
        g
          .append('g')
          .selectAll('line')
          .data(x.ticks())
          .join('line')
          .attr('x1', (d) => 0.5 + x(d))
          .attr('x2', (d) => 0.5 + x(d))
          .attr('y1', M.top)
          .attr('y2', SCATTER_HEIGHT - M.bottom)
      )
      .call((g) =>
        g
          .append('g')
          .selectAll('line')
          .data(y.ticks())
          .join('line')
          .attr('y1', (d) => 0.5 + y(d))
          .attr('y2', (d) => 0.5 + y(d))
          .attr('x1', M.left)
          .attr('x2', CHART_WIDTH - M.right)
      )

    const tooltip = svg.append('g').attr('pointer-events', 'none').style('display', 'none')

    svg
      .append('g')
      .selectAll('circle')
      .data(displayPoints.length > 0 ? displayPoints : [])
      .join('circle')
      .attr('cx', (d) => x(d.runtime))
      .attr('cy', (d) => y(d.rating))
      .attr('r', isByYear || showAllMovies ? 3.5 : 6)
      .attr('fill', (d) => colorScale(d.genre))
      .attr('stroke', '#333')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('pointerenter pointermove', function (event, d) {
        tooltip.style('display', null)
        const [mx, my] = d3.pointer(event)
        tooltip.attr('transform', `translate(${mx + 12},${my + 12})`)
        const ratingLabel = metric === 'imdb' ? 'IMDB' : 'Meta'
        const lines = isByYear || showAllMovies
          ? [
              ...(isByYear ? [`Year: ${(d as ScatterPoint).year}`] : []),
              `Runtime: ${d.runtime.toFixed(0)} min`,
              `${ratingLabel}: ${d.rating.toFixed(1)}`,
              `Genre: ${d.genre}`,
            ]
          : [
              `Genre: ${d.genre}`,
              `Avg runtime: ${d.runtime.toFixed(0)} min`,
              `Avg ${ratingLabel.toLowerCase()} rating: ${d.rating.toFixed(2)}`,
              `Movies: ${'count' in d ? d.count : ''}`,
            ]
        const path = tooltip
          .selectAll('path')
          .data([1])
          .join('path')
          .attr('fill', 'white')
          .attr('stroke', 'black')
          .attr('stroke-width', 1)
        const text = tooltip
          .selectAll('text')
          .data([1])
          .join('text')
          .call((t) =>
            t
              .selectAll('tspan')
              .data(lines)
              .join('tspan')
              .attr('x', 0)
              .attr('y', (_, i) => `${i * 1.1}em`)
              .attr('font-weight', (_: string, i: number) => (i === 0 ? 'bold' : null))
              .text((line) => line)
          )
        const node = text.node() as SVGTextElement | null
        if (node && node.getBBox) {
          const b = node.getBBox()
          text.attr('transform', `translate(0,${-b.y})`)
          path.attr('d', `M0,0h${b.width + 16}v${b.height + 12}h-${b.width + 16}z`)
        }
      })
      .on('pointerleave', () => {
        tooltip.style('display', 'none')
      })
  }, [displayPoints, selectedYear, xDomain, yDomain, isByYear, showAllMovies, metric])

  return (
    <div className="flex flex-col gap-2">
      <svg ref={svgRef} width={CHART_WIDTH} height={SCATTER_HEIGHT} className="overflow-visible" />
      <div className="flex flex-wrap gap-4 text-xs">
        {genres.map((g) => (
          <span key={g} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full border border-gray-700"
              style={{ backgroundColor: colorScale(g) }}
            />
            <span className="text-gray-700 dark:text-gray-300">{g}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

const CRITICS_VS_AUDIENCE_HEIGHT = 560

export interface CriticsVsAudienceScatterProps {
  points: CriticsVsAudiencePoint[]
}

export function CriticsVsAudienceScatter({ points }: CriticsVsAudienceScatterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const genres = useMemo(
    () => [...new Set(points.map((p) => p.genre))].sort(),
    [points]
  )
  const colorScale = d3.scaleOrdinal<string, string>().domain(genres).range(GENRE_COLORS)
  const correlation = useMemo(
    () => pearsonCorrelation(points.map((p) => p.meta), points.map((p) => p.imdb)),
    [points]
  )
  const trendLinesByGenre = useMemo(() => {
    const byGenre = new Map<string, { slope: number; intercept: number }>()
    for (const genre of genres) {
      const subset = points.filter((p) => p.genre === genre)
      if (subset.length >= 2) {
        const xs = subset.map((p) => p.meta)
        const ys = subset.map((p) => p.imdb)
        byGenre.set(genre, linearRegression(xs, ys))
      }
    }
    return byGenre
  }, [points, genres])
  const xDomain = d3.extent(points, (d) => d.meta) as [number, number]
  const yDomain = d3.extent(points, (d) => d.imdb) as [number, number]

  useEffect(() => {
    if (!svgRef.current || points.length === 0) return

    const x = d3
      .scaleLinear()
      .domain(xDomain)
      .nice()
      .range([M.left, CHART_WIDTH - M.right])
    const y = d3
      .scaleLinear()
      .domain(yDomain)
      .nice()
      .range([CRITICS_VS_AUDIENCE_HEIGHT - M.bottom, M.top])

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', [0, 0, CHART_WIDTH, CRITICS_VS_AUDIENCE_HEIGHT])
      .attr('style', 'max-width: 100%; height: auto; font: 10px sans-serif;')
      .style('overflow', 'visible')

    svg
      .append('g')
      .attr('transform', `translate(0,${CRITICS_VS_AUDIENCE_HEIGHT - M.bottom})`)
      .call(d3.axisBottom(x).ticks(CHART_WIDTH / 80))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .append('text')
          .attr('x', CHART_WIDTH)
          .attr('y', M.bottom - 4)
          .attr('fill', 'currentColor')
          .attr('text-anchor', 'end')
          .text('Meta score (critics) →')
      )

    svg
      .append('g')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .append('text')
          .attr('x', -M.left)
          .attr('y', 10)
          .attr('fill', 'currentColor')
          .attr('text-anchor', 'start')
          .text('↑ IMDB Rating (audiences)')
      )

    svg
      .append('g')
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.1)
      .call((g) =>
        g
          .append('g')
          .selectAll('line')
          .data(x.ticks())
          .join('line')
          .attr('x1', (d) => 0.5 + x(d))
          .attr('x2', (d) => 0.5 + x(d))
          .attr('y1', M.top)
          .attr('y2', CRITICS_VS_AUDIENCE_HEIGHT - M.bottom)
      )
      .call((g) =>
        g
          .append('g')
          .selectAll('line')
          .data(y.ticks())
          .join('line')
          .attr('y1', (d) => 0.5 + y(d))
          .attr('y2', (d) => 0.5 + y(d))
          .attr('x1', M.left)
          .attr('x2', CHART_WIDTH - M.right)
      )

    const tooltip = svg.append('g').attr('pointer-events', 'none').style('display', 'none')

    const xMin = x.domain()[0] ?? 0
    const xMax = x.domain()[1] ?? 100
    trendLinesByGenre.forEach((line, genre) => {
      const yAtMin = line.slope * xMin + line.intercept
      const yAtMax = line.slope * xMax + line.intercept
      const g = svg.append('g').attr('class', 'trend-line-group').style('cursor', 'pointer')
      g.append('line')
        .attr('x1', x(xMin))
        .attr('x2', x(xMax))
        .attr('y1', y(yAtMin))
        .attr('y2', y(yAtMax))
        .attr('stroke', 'transparent')
        .attr('stroke-width', 16)
      g.append('line')
        .attr('x1', x(xMin))
        .attr('x2', x(xMax))
        .attr('y1', y(yAtMin))
        .attr('y2', y(yAtMax))
        .attr('stroke', colorScale(genre))
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.85)
      g.append('title').text(`${genre} trend line`)
      g.on('pointerenter pointermove', function (event) {
        tooltip.style('display', null)
        const [mx, my] = d3.pointer(event)
        tooltip.attr('transform', `translate(${mx + 12},${my + 12})`)
        const path = tooltip
          .selectAll('path')
          .data([1])
          .join('path')
          .attr('fill', 'white')
          .attr('stroke', 'black')
          .attr('stroke-width', 1)
        const text = tooltip
          .selectAll('text')
          .data([1])
          .join('text')
          .call((t) =>
            t
              .selectAll('tspan')
              .data([`${genre} (trend line)`])
              .join('tspan')
              .attr('x', 0)
              .attr('y', 0)
              .attr('font-weight', 'bold')
              .text((label) => label)
          )
        const node = text.node() as SVGTextElement | null
        if (node && node.getBBox) {
          const b = node.getBBox()
          text.attr('transform', `translate(0,${-b.y})`)
          path.attr('d', `M0,0h${b.width + 16}v${b.height + 12}h-${b.width + 16}z`)
        }
      })
      g.on('pointerleave', () => tooltip.style('display', 'none'))
    })

    svg
      .append('g')
      .selectAll('circle')
      .data(points)
      .join('circle')
      .attr('cx', (d) => x(d.meta))
      .attr('cy', (d) => y(d.imdb))
      .attr('r', 3.5)
      .attr('fill', (d) => colorScale(d.genre))
      .attr('stroke', '#333')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('pointerenter pointermove', function (event, d) {
        tooltip.style('display', null)
        const [mx, my] = d3.pointer(event)
        tooltip.attr('transform', `translate(${mx + 12},${my + 12})`)
        const lines = [
          d.title,
          `Meta: ${d.meta.toFixed(0)}`,
          `IMDB: ${d.imdb.toFixed(1)}`,
          d.genre,
        ]
        const path = tooltip
          .selectAll('path')
          .data([1])
          .join('path')
          .attr('fill', 'white')
          .attr('stroke', 'black')
          .attr('stroke-width', 1)
        const text = tooltip
          .selectAll('text')
          .data([1])
          .join('text')
          .call((t) =>
            t
              .selectAll('tspan')
              .data(lines)
              .join('tspan')
              .attr('x', 0)
              .attr('y', (_, i) => `${i * 1.1}em`)
              .attr('font-weight', (_: string, i: number) => (i === 0 ? 'bold' : null))
              .text((line) => line)
          )
        const node = text.node() as SVGTextElement | null
        if (node && node.getBBox) {
          const b = node.getBBox()
          text.attr('transform', `translate(0,${-b.y})`)
          path.attr('d', `M0,0h${b.width + 16}v${b.height + 12}h-${b.width + 16}z`)
        }
      })
      .on('pointerleave', () => {
        tooltip.style('display', 'none')
      })
  }, [points, xDomain, yDomain, genres, trendLinesByGenre])

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Pearson r = {correlation.toFixed(3)}. Dashed lines = linear trend per genre (IMDB on Meta); colors match legend.
        Points above a genre’s line = audiences rate higher than critics for that genre; below = critics rate higher.
      </p>
      <svg
        ref={svgRef}
        width={CHART_WIDTH}
        height={CRITICS_VS_AUDIENCE_HEIGHT}
        className="overflow-visible"
      />
      <div className="flex flex-wrap gap-4 text-xs">
        {genres.map((g) => (
          <span key={g} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full border border-gray-700"
              style={{ backgroundColor: colorScale(g) }}
            />
            <span className="text-gray-700 dark:text-gray-300">{g}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

const DISAGREEMENT_LINE_HEIGHT = 420
const BAR_HEIGHT = 22
const DISAGREEMENT_BAR_MARGIN = { top: 24, right: 50, bottom: 16, left: 90 }
const DISAGREEMENT_IMDB_COLOR = '#e6550d' // orange — audiences (IMDB)
const DISAGREEMENT_META_COLOR = '#3182bd' // blue — critics (Meta)

export interface DisagreementByYearChartProps {
  data: DisagreementByYearDatum[]
}

export function DisagreementByYearChart({ data }: DisagreementByYearChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const xDomain = d3.extent(data, (d) => d.year) as [number, number]
  const yDomain: [number, number] = [
    Math.min(
      d3.min(data, (d) => Math.min(d.meanMeta, d.meanImdbRescaled)) ?? 0,
      0
    ),
    Math.max(
      d3.max(data, (d) => Math.max(d.meanMeta, d.meanImdbRescaled)) ?? 100,
      100
    ),
  ]
  const height = DISAGREEMENT_LINE_HEIGHT

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return
    const x = d3
      .scaleLinear()
      .domain(xDomain)
      .range([M.left, CHART_WIDTH - M.right])
    const y = d3
      .scaleLinear()
      .domain(yDomain)
      .range([height - M.bottom, M.top])

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', [0, 0, CHART_WIDTH, height])
      .attr('style', 'max-width: 100%; height: auto; font: 10px sans-serif;')
      .style('overflow', 'visible')

    // X axis
    svg
      .append('g')
      .attr('transform', `translate(0,${height - M.bottom})`)
      .call(d3.axisBottom(x).ticks(CHART_WIDTH / 80).tickSizeOuter(0))
      .call((g) => g.select('.domain').remove())

    // Y axis with grid
    svg
      .append('g')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('.tick line')
          .clone()
          .attr('x2', CHART_WIDTH - M.left - M.right)
          .attr('stroke-opacity', 0.1)
      )
      .call((g) =>
        g
          .select('.tick:last-of-type text')
          .clone()
          .attr('x', -M.left)
          .attr('y', -24)
          .attr('fill', 'currentColor')
          .attr('text-anchor', 'start')
          .text('↑ Score (0–100)')
      )

    // Band: midline → IMDB (orange = audiences rating)
    svg
      .append('path')
      .attr('fill', DISAGREEMENT_IMDB_COLOR)
      .attr('fill-opacity', 0.4)
      .attr(
        'd',
        d3
          .area<DisagreementByYearDatum>()
          .curve(d3.curveStep)
          .x((d) => x(d.year))
          .y0((d) => y(d.meanAvg))
          .y1((d) => y(d.meanImdbRescaled))(data)
      )

    // Band: midline → Meta (blue = critics rating)
    svg
      .append('path')
      .attr('fill', DISAGREEMENT_META_COLOR)
      .attr('fill-opacity', 0.4)
      .attr(
        'd',
        d3
          .area<DisagreementByYearDatum>()
          .curve(d3.curveStep)
          .x((d) => x(d.year))
          .y0((d) => y(d.meanAvg))
          .y1((d) => y(d.meanMeta))(data)
      )

    // Black line: average of both (midline)
    svg
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr(
        'd',
        d3
          .line<DisagreementByYearDatum>()
          .curve(d3.curveStep)
          .x((d) => x(d.year))
          .y((d) => y(d.meanAvg))(data)
      )

    // Line: IMDB (audiences) — orange
    svg
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', DISAGREEMENT_IMDB_COLOR)
      .attr('stroke-width', 1.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr(
        'd',
        d3
          .line<DisagreementByYearDatum>()
          .curve(d3.curveStep)
          .x((d) => x(d.year))
          .y((d) => y(d.meanImdbRescaled))(data)
      )

    // Line: Meta (critics) — blue
    svg
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', DISAGREEMENT_META_COLOR)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr(
        'd',
        d3
          .line<DisagreementByYearDatum>()
          .curve(d3.curveStep)
          .x((d) => x(d.year))
          .y((d) => y(d.meanMeta))(data)
      )

    // Points on midline with tooltips
    svg
      .append('g')
      .selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', (d) => x(d.year))
      .attr('cy', (d) => y(d.meanAvg))
      .attr('r', 3)
      .attr('fill', 'black')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .append('title')
      .text(
        (d) =>
          `${d.year}: avg ${d.meanAvg.toFixed(1)}, IMDB ${d.meanImdbRescaled.toFixed(1)}, Meta ${d.meanMeta.toFixed(1)} (n=${d.count})`
      )

    // Legend: black = average, orange = IMDB, blue = Meta
    const legend = svg
      .append('g')
      .attr('transform', `translate(${CHART_WIDTH - M.right - 160},${M.top})`)
    legend
      .append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5)
    legend.append('text').attr('x', 24).attr('y', 4).text('Average (both)')
    legend
      .append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 16)
      .attr('y2', 16)
      .attr('stroke', DISAGREEMENT_IMDB_COLOR)
      .attr('stroke-width', 1.5)
    legend.append('text').attr('x', 24).attr('y', 20).text('IMDB (audiences, 0–100)')
    legend
      .append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 32)
      .attr('y2', 32)
      .attr('stroke', DISAGREEMENT_META_COLOR)
      .attr('stroke-dasharray', '4,3')
      .attr('stroke-width', 1.5)
    legend.append('text').attr('x', 24).attr('y', 36).text('Meta (critics, 0–100)')
  }, [data, xDomain, yDomain])

  return (
    <svg
      ref={svgRef}
      width={CHART_WIDTH}
      height={DISAGREEMENT_LINE_HEIGHT}
      className="overflow-visible"
    />
  )
}

const BAR_FILL_POSITIVE = '#3182bd'
const BAR_FILL_NEGATIVE = '#e34a33'
/** Magnitude-based fill: 0–2 green, 2–4 yellow, 4+ red (by |meanGap|). */
const BAR_MAGNITUDE_GREEN = '#22c55e'
const BAR_MAGNITUDE_YELLOW = '#eab308'
const BAR_MAGNITUDE_RED = '#e34a33'

function barFill(d: DisagreementByGenreDatum): string {
  return d.meanGap > 0 ? BAR_FILL_POSITIVE : BAR_FILL_NEGATIVE
}

function barFillByMagnitude(d: DisagreementByGenreDatum): string {
  const abs = Math.abs(d.meanGap)
  if (abs < 2) return BAR_MAGNITUDE_GREEN
  if (abs < 4) return BAR_MAGNITUDE_YELLOW
  return BAR_MAGNITUDE_RED
}

/** Opacity scales with n up to this cap; n >= cap gets full opacity. */
const OPACITY_COUNT_CAP = 100

function barFillOpacity(d: DisagreementByGenreDatum): number {
  const t = Math.max(0, Math.min(1, d.count / OPACITY_COUNT_CAP))
  return 0.4 + 0.6 * t
}

export interface DisagreementByGenreChartProps {
  data: DisagreementByGenreDatum[]
  /** When false, bar labels show only the gap (no "n=..."). Default true. */
  showCount?: boolean
  /** Optional caption below the chart. When null, no caption is shown. */
  caption?: string | null
  /** When true, draw a stroke around each bar. Default false. */
  barOutline?: boolean
  /** When true, bar fill opacity scales with n (low n = more transparent). Default false. */
  opacityByCount?: boolean
  /** When true, bold genre and value labels where |meanGap| >= threshold (emphasizes "controversial" genres). */
  boldLabelsByGap?: boolean
  /** When true and showCount, bold the count when n=1 (emphasizes tiny samples). */
  boldCountWhenOne?: boolean
  /** When true, draw a prominent zero line and axis-side labels (critics vs audiences). */
  highlightZeroLine?: boolean
  /** When true, color bars by |meanGap|: 0–2 green, 2–4 yellow, 4+ red (hides direction). */
  colorBarsByMagnitude?: boolean
}

const LARGE_GAP_THRESHOLD = 3

export function DisagreementByGenreChart({
  data,
  showCount = true,
  caption,
  barOutline = false,
  opacityByCount = false,
  boldLabelsByGap = false,
  boldCountWhenOne = false,
  highlightZeroLine = false,
  colorBarsByMagnitude = false,
}: DisagreementByGenreChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const xExtent = d3.extent(data, (d) => d.meanGap) as [number, number]
  const xDomain: [number, number] = [
    Math.min(xExtent[0], 0),
    Math.max(xExtent[1], 0),
  ]
  const height =
    Math.ceil((data.length + 0.1) * BAR_HEIGHT) +
    DISAGREEMENT_BAR_MARGIN.top +
    DISAGREEMENT_BAR_MARGIN.bottom
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return
    const x = d3
      .scaleLinear()
      .domain(xDomain)
      .rangeRound([DISAGREEMENT_BAR_MARGIN.left, CHART_WIDTH - DISAGREEMENT_BAR_MARGIN.right])
    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.genre))
      .rangeRound([DISAGREEMENT_BAR_MARGIN.top, height - DISAGREEMENT_BAR_MARGIN.bottom])
      .padding(0.1)

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', [0, 0, CHART_WIDTH, height])
      .attr('style', 'max-width: 100%; height: auto; font: 10px sans-serif;')
      .style('overflow', 'visible')

    const rects = svg
      .append('g')
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('fill', (d) =>
        colorBarsByMagnitude ? barFillByMagnitude(d) : barFill(d)
      )
      .attr('x', (d) => x(Math.min(d.meanGap, 0)))
      .attr('y', (d) => y(d.genre)!)
      .attr('width', (d) => Math.abs(x(d.meanGap) - x(0)))
      .attr('height', y.bandwidth())

    if (opacityByCount) {
      rects.attr('fill-opacity', (d) => barFillOpacity(d))
    }
    if (barOutline) {
      rects
        .attr('stroke', 'currentColor')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.4)
    }

    const valueLabels = svg
      .append('g')
      .attr('font-size', 10)
      .selectAll('text')
      .data(data)
      .join('text')
      .attr('text-anchor', (d) => (d.meanGap < 0 ? 'end' : 'start'))
      .attr('x', (d) => x(d.meanGap) + (d.meanGap < 0 ? -4 : 4))
      .attr('y', (d) => y(d.genre)! + y.bandwidth() / 2)
      .attr('dy', '0.35em')

    valueLabels.each(function (d) {
      const el = d3.select(this)
      if (boldCountWhenOne && showCount && d.count === 1) {
        el.append('tspan').text(`${d.meanGap >= 0 ? '+' : ''}${d.meanGap.toFixed(1)} (n=`)
        el.append('tspan').attr('font-weight', 'bold').text('1')
        el.append('tspan').text(')')
      } else {
        el.text(
          showCount
            ? `${d.meanGap >= 0 ? '+' : ''}${d.meanGap.toFixed(1)} (n=${d.count})`
            : `${d.meanGap >= 0 ? '+' : ''}${d.meanGap.toFixed(1)}`
        )
      }
    })
    if (boldLabelsByGap) {
      valueLabels.attr(
        'font-weight',
        (d) =>
          (Math.abs(d.meanGap) >= LARGE_GAP_THRESHOLD ? 'bold' : 'normal')
      )
    }

    svg
      .append('g')
      .attr('transform', `translate(0,${DISAGREEMENT_BAR_MARGIN.top})`)
      .call(
        d3
          .axisTop(x)
          .ticks(CHART_WIDTH / 80)
          .tickFormat((v) => (Number(v) >= 0 ? `+${v}` : `${v}`))
      )
      .call((g) =>
        g
          .selectAll('.tick line')
          .clone()
          .attr('y2', height - DISAGREEMENT_BAR_MARGIN.top - DISAGREEMENT_BAR_MARGIN.bottom)
          .attr('stroke-opacity', 0.1)
      )
      .call((g) => g.select('.domain').remove())

    const leftAxis = svg
      .append('g')
      .attr('transform', `translate(${x(0)},0)`)
      .call(d3.axisLeft(y).tickSize(0).tickPadding(6))
    leftAxis
      .selectAll('.tick text')
      .filter((_d, i) => data[i]!.meanGap < 0)
      .attr('text-anchor', 'start')
      .attr('x', 6)
    if (boldLabelsByGap) {
      leftAxis.selectAll('.tick').each(function (_, i) {
        const row = data[i]
        d3.select(this)
          .select('text')
          .attr(
            'font-weight',
            row && Math.abs(row.meanGap) >= LARGE_GAP_THRESHOLD
              ? 'bold'
              : 'normal'
          )
      })
    }

    if (highlightZeroLine) {
      const zeroX = x(0)
      svg
        .append('line')
        .attr('x1', zeroX)
        .attr('x2', zeroX)
        .attr('y1', DISAGREEMENT_BAR_MARGIN.top)
        .attr('y2', height - DISAGREEMENT_BAR_MARGIN.bottom)
        .attr('stroke', 'currentColor')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.5)
      svg
        .append('text')
        .attr('x', zeroX)
        .attr('y', DISAGREEMENT_BAR_MARGIN.top - 6)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9)
        .attr('fill', 'currentColor')
        .text('0')
      svg
        .append('text')
        .attr('x', DISAGREEMENT_BAR_MARGIN.left)
        .attr('y', height - DISAGREEMENT_BAR_MARGIN.bottom + 14)
        .attr('text-anchor', 'start')
        .attr('font-size', 9)
        .attr('fill', 'currentColor')
        .attr('opacity', 0.7)
        .text('Critics higher ←')
      svg
        .append('text')
        .attr('x', CHART_WIDTH - DISAGREEMENT_BAR_MARGIN.right)
        .attr('y', height - DISAGREEMENT_BAR_MARGIN.bottom + 14)
        .attr('text-anchor', 'end')
        .attr('font-size', 9)
        .attr('fill', 'currentColor')
        .attr('opacity', 0.7)
        .text('→ Audiences higher')
    }
  }, [
    data,
    xDomain,
    height,
    showCount,
    barOutline,
    opacityByCount,
    boldLabelsByGap,
    boldCountWhenOne,
    highlightZeroLine,
    colorBarsByMagnitude,
  ])

  return (
    <div className="flex flex-col gap-1">
      {caption !== null && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {caption ??
            'Blue = audiences rate higher than critics on average; red = critics rate higher. Sorted by mean gap. n = number of movies in that genre (with Meta score).'}
        </p>
      )}
      <svg ref={svgRef} width={CHART_WIDTH} height={height} className="overflow-visible" />
    </div>
  )
}
