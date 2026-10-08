interface StepProgressProps {
  current: number;
  total: number;
  /** Name of the current step, e.g. "Policy detail". */
  title: string;
}

/**
 * "Step 2 of 4" with a segmented bar. The counter is always true to the flow (critique
 * Interaction #3) and written in sentence case (Interaction #4).
 */
export function StepProgress({ current, total, title }: StepProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`Step ${current} of ${total}: ${title}`}
    >
      <div className="steps__label">
        <span>
          Step {current} of {total}
        </span>
        <span>{title}</span>
      </div>
      <div className="steps__bar" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`steps__segment${index < current ? ' steps__segment--done' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
