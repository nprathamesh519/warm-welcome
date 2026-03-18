import { getPhaseInfo } from "@/lib/menstrual-ml";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PhaseRingProps {
  dayInCycle: number;
  avgCycle: number;
}

export function PhaseRing({ dayInCycle, avgCycle }: PhaseRingProps) {
  const pct = Math.min(1, Math.max(0, dayInCycle / avgCycle));
  const r = 68, cx = 85, cy = 85;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const phase = getPhaseInfo(dayInCycle, avgCycle);

  // Phase segments for the outer visual ring
  const phases = [
    { name: "Menstruation", pct: 0.18, color: "hsl(var(--primary))" },
    { name: "Follicular", pct: 0.28, color: "hsl(var(--teal))" },
    { name: "Ovulation", pct: 0.10, color: "#2D7A5E" },
    { name: "Luteal", pct: 0.44, color: "hsl(var(--accent))" },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 170 170" className="w-full h-full">
          {/* Background track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" opacity="0.3" />
          
          {/* Phase segments (outer decorative ring) */}
          {(() => {
            let offset = 0;
            return phases.map((p, i) => {
              const segDash = p.pct * circ;
              const segOffset = -offset * circ / (circ / circ); // simplified
              const el = (
                <circle
                  key={i}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="8"
                  strokeDasharray={`${segDash} ${circ - segDash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  opacity="0.2"
                />
              );
              offset += segDash;
              return el;
            });
          })()}

          {/* Active progress */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={phase.color}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-all duration-1000 ease-out"
            filter="drop-shadow(0 0 4px rgba(200,86,107,0.3))"
          />

          {/* Dot indicator at current position */}
          {(() => {
            const angle = (pct * 360 - 90) * (Math.PI / 180);
            const dotX = cx + r * Math.cos(angle);
            const dotY = cy + r * Math.sin(angle);
            return (
              <>
                <circle cx={dotX} cy={dotY} r="6" fill={phase.color} className="transition-all duration-700" />
                <circle cx={dotX} cy={dotY} r="3" fill="white" className="transition-all duration-700" />
              </>
            );
          })()}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-4xl font-bold text-foreground">{Math.max(0, dayInCycle)}</span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">day</span>
        </div>
      </div>

      <Badge variant="secondary" className={cn("text-sm px-4 py-1.5 font-semibold", phase.bg, "text-foreground shadow-sm")}>
        {phase.name}
      </Badge>

      <div className="flex flex-wrap justify-center gap-2">
        {phase.tips.map((t, i) => (
          <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-primary/8 text-primary font-medium border border-primary/10">
            {t}
          </span>
        ))}
      </div>

      {/* Phase legend */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2">
        {phases.map(p => (
          <div key={p.name} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
            <span>{p.name}</span>
            <span className="ml-auto text-[10px] opacity-60">{Math.round(p.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
