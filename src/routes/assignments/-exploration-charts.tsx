import * as d3 from 'd3'
import { useEffect, useRef } from 'react'

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

export function computeScatterPoints(rows: Record<string, string>[]): ScatterPoint[] {
  const points: ScatterPoint[] = []
  for (const row of rows) {
    const runtime = parseRuntime(row.Runtime ?? '')
    const rating = Number(row.IMDB_Rating)
    const year = Number(row.Released_Year)
    const genreStr = row.Genre ?? ''
    const firstGenre = genreStr.split(',')[0]?.trim() ?? 'Other'
    if (runtime == null || Number.isNaN(rating) || Number.isNaN(year)) continue
    points.push({ runtime, rating, genre: firstGenre, year })
  }
  return points
}

export function computeScatterPointsByGenre(rows: Record<string, string>[]): ScatterPointByGenre[] {
  const byGenre = new Map<string, { runtime: number[]; rating: number[] }>()
  for (const row of rows) {
    const runtime = parseRuntime(row.Runtime ?? '')
    const rating = Number(row.IMDB_Rating)
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
}

export function ExplorationScatter({ points, pointsByGenre, selectedYear }: ExplorationScatterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isByYear = selectedYear != null
  const displayPoints = isByYear
    ? points.filter((p) => p.year === selectedYear)
    : pointsByGenre.map((p) => ({ ...p, year: 0 }))
  const genres = [...new Set(displayPoints.map((p) => p.genre))].sort()
  const colorScale = d3.scaleOrdinal<string, string>().domain(genres).range(GENRE_COLORS)

  const xDomain = isByYear
    ? (d3.extent(points, (d) => d.runtime) as [number, number])
    : (d3.extent(pointsByGenre, (d) => d.runtime) as [number, number])
  const yDomain = isByYear
    ? (d3.extent(points, (d) => d.rating) as [number, number])
    : (d3.extent(pointsByGenre, (d) => d.rating) as [number, number])

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
          .text('↑ IMDB Rating')
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
      .attr('r', isByYear ? 3.5 : 6)
      .attr('fill', (d) => colorScale(d.genre))
      .attr('stroke', '#333')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('pointerenter pointermove', function (event, d) {
        tooltip.style('display', null)
        const [mx, my] = d3.pointer(event)
        tooltip.attr('transform', `translate(${mx + 12},${my + 12})`)
        const lines = isByYear
          ? [
              `Year: ${(d as ScatterPoint).year}`,
              `Runtime: ${d.runtime.toFixed(0)} min`,
              `Rating: ${d.rating.toFixed(1)}`,
              `Genre: ${d.genre}`,
            ]
          : [
              `Genre: ${d.genre}`,
              `Avg runtime: ${d.runtime.toFixed(0)} min`,
              `Avg rating: ${d.rating.toFixed(2)}`,
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
  }, [displayPoints, selectedYear, xDomain, yDomain, isByYear])

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
