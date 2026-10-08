export interface BarDatum {
  label: string;
  value: number;
  /** Optional second series drawn beside the first (e.g. historical vs verified). */
  secondary?: number;
}

interface BarChartProps {
  title: string;
  data: BarDatum[];
  /** Unit appended to the accessible description, e.g. "hours". */
  unit?: string;
  primaryName?: string;
  secondaryName?: string;
}

/**
 * Dependency-free bar chart matching the hi-fi's simple navy bars. Each bar has a text equivalent
 * in the figure's accessible description so the data is not conveyed by height alone.
 */
export function BarChart({
  title,
  data,
  unit = '',
  primaryName = 'Value',
  secondaryName = 'Other',
}: BarChartProps) {
  const max = Math.max(1, ...data.flatMap((d) => [d.value, d.secondary ?? 0]));
  const description = data
    .map((d) => {
      const second = d.secondary === undefined ? '' : `, ${secondaryName} ${d.secondary}`;
      return `${d.label}: ${primaryName} ${d.value}${unit ? ` ${unit}` : ''}${second}`;
    })
    .join('; ');
  return (
    <figure className="chart" aria-label={title}>
      <figcaption className="chart__title">{title}</figcaption>
      <div className="chart__bars" role="img" aria-label={`${title}. ${description || 'No data'}`}>
        {data.map((d) => (
          <div
            key={d.label}
            className="chart__col"
            style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}
          >
            <div className="chart__bar" style={{ height: `${(d.value / max) * 100}%`, flex: 1 }} />
            {d.secondary !== undefined && (
              <div
                className="chart__bar chart__bar--secondary"
                style={{ height: `${(d.secondary / max) * 100}%`, flex: 1 }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="chart__labels" aria-hidden="true">
        {data.map((d) => (
          <span key={d.label} className="chart__label">
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
