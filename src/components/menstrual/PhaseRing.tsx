import { getPhaseInfo } from "@/lib/menstrual-ml";
import { Badge } from "@/components/ui/badge";

interface PhaseRingProps {
  dayInCycle: number;
  avgCycle: number;
}

export function PhaseRing({ dayInCycle, avgCycle }: PhaseRingProps) {
  const pct = Math.min(1, Math.max(0, dayInCycle / avgCycle));
  const r = 63, cx = 80, cy = 80;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const phase = getPhaseInfo(dayInCycle, avgCycle);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 160 160" className="w-full h-full">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={phase.color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset="0"
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-3xl font-bold text-foreground">{Math.max(0, dayInCycle)}</span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">day</span>
        </div>
      </div>
      <Badge variant="secondary" className={`${phase.bg} text-foreground`}>
        {phase.name}
      </Badge>
      <div className="flex flex-wrap justify-center gap-1.5">
        {phase.tips.map((t, i) => (
          <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
