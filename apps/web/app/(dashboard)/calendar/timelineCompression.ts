export interface TimelinePeriod {
  from: number;
  to: number;
}

export interface TimelineCompressionGap extends TimelinePeriod {
  compressedHeight: number;
}

interface TimelineCompressionInput {
  compressedHeight?: number;
  hourHeight: number;
  minGapMinutes?: number;
  occupiedPeriods?: TimelinePeriod[];
  rangeEnd: number;
  rangeStart: number;
  workingPeriods: TimelinePeriod[];
}

function mergePeriods(periods: TimelinePeriod[]) {
  const sorted = periods
    .filter((period) => period.to > period.from)
    .sort((left, right) => left.from - right.from);
  const merged: TimelinePeriod[] = [];
  for (const period of sorted) {
    const last = merged.at(-1);
    if (!last || period.from > last.to) {
      merged.push({ ...period });
    } else {
      last.to = Math.max(last.to, period.to);
    }
  }
  return merged;
}

export function buildTimelineCompression({
  compressedHeight = 72,
  hourHeight,
  minGapMinutes = 60,
  occupiedPeriods = [],
  rangeEnd,
  rangeStart,
  workingPeriods,
}: TimelineCompressionInput) {
  const working = mergePeriods(workingPeriods.map((period) => ({
    from: Math.max(rangeStart, period.from),
    to: Math.min(rangeEnd, period.to),
  })));
  const globalGaps: TimelinePeriod[] = [];
  let cursor = rangeStart;
  for (const period of working) {
    if (period.from > cursor) globalGaps.push({ from: cursor, to: period.from });
    cursor = Math.max(cursor, period.to);
  }
  if (cursor < rangeEnd) globalGaps.push({ from: cursor, to: rangeEnd });

  const occupied = mergePeriods(occupiedPeriods);
  const gaps = globalGaps
    .filter((gap) => !occupied.some((period) => period.from < gap.to && period.to > gap.from))
    .filter((period) => period.to - period.from >= minGapMinutes)
    .map((period) => ({ ...period, compressedHeight }));

  const rawY = (minutes: number) => (minutes - rangeStart) / 60 * hourHeight;
  const timelineY = (minutes: number) => {
    let y = rawY(minutes);
    for (const gap of gaps) {
      const rawGapHeight = rawY(gap.to) - rawY(gap.from);
      if (minutes >= gap.to) {
        y -= rawGapHeight - gap.compressedHeight;
      } else if (minutes > gap.from) {
        const progress = (minutes - gap.from) / (gap.to - gap.from);
        y = rawY(gap.from) - gaps
          .filter((previous) => previous.to <= gap.from)
          .reduce((sum, previous) => sum + (rawY(previous.to) - rawY(previous.from) - previous.compressedHeight), 0)
          + progress * gap.compressedHeight;
        break;
      }
    }
    return y;
  };
  const minutesAtY = (y: number) => {
    for (const gap of gaps) {
      const gapTop = timelineY(gap.from);
      const gapBottom = gapTop + gap.compressedHeight;
      if (y >= gapTop && y <= gapBottom) {
        const progress = gap.compressedHeight === 0 ? 0 : (y - gapTop) / gap.compressedHeight;
        return gap.from + progress * (gap.to - gap.from);
      }
      if (y < gapTop) break;
    }
    let restoredY = y;
    for (const gap of gaps) {
      const gapBottom = timelineY(gap.from) + gap.compressedHeight;
      if (y > gapBottom) restoredY += rawY(gap.to) - rawY(gap.from) - gap.compressedHeight;
    }
    return rangeStart + restoredY / hourHeight * 60;
  };

  return {
    gaps,
    height: timelineY(rangeEnd),
    intervalPosition(from: number, to: number, minimumHeight = 0) {
      const top = Math.max(0, timelineY(from));
      const bottom = Math.min(timelineY(rangeEnd), timelineY(to));
      return { height: Math.max(minimumHeight, bottom - top), top };
    },
    minutesAtY,
    timelineY,
  };
}
