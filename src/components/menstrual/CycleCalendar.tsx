import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CycleCalendarProps {
  lastPeriod: string;
  avgCycle: number;
  periodDuration: number;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CycleCalendar({ lastPeriod, avgCycle, periodDuration }: CycleCalendarProps) {
  const [yr, setYr] = useState(new Date().getFullYear());
  const [mo, setMo] = useState(new Date().getMonth());
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const dayStatus = (d: number) => {
    if (!lastPeriod) return "normal";
    const dt = new Date(yr, mo, d);
    const lp = new Date(lastPeriod + "T12:00:00");
    for (let c = 0; c < 4; c++) {
      const cs = new Date(lp);
      cs.setDate(cs.getDate() + c * avgCycle);
      const diff = Math.round((dt.getTime() - cs.getTime()) / 86400000);
      if (diff >= 0 && diff < periodDuration) return "period";
      if (diff >= -3 && diff < 0) return "predicted";
      const ov = Math.round(avgCycle * 0.46);
      if (diff === ov) return "ovulation";
    }
    return "normal";
  };

  const getDayTooltip = (d: number) => {
    const s = dayStatus(d);
    if (s === "period") return "Period day";
    if (s === "predicted") return "Period expected soon";
    if (s === "ovulation") return "Ovulation day — fertile window";
    return null;
  };

  const first = new Date(yr, mo, 1).getDay();
  const days = new Date(yr, mo + 1, 0).getDate();
  const today = new Date();

  const prev = () => { let m = mo - 1, y = yr; if (m < 0) { m = 11; y--; } setMo(m); setYr(y); };
  const next = () => { let m = mo + 1, y = yr; if (m > 11) { m = 0; y++; } setMo(m); setYr(y); };

  const statusClasses: Record<string, string> = {
    period: "bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/20",
    predicted: "bg-primary/15 text-primary border border-primary/30 font-medium",
    ovulation: "bg-teal/15 text-teal border border-teal/30 font-medium",
    normal: "text-muted-foreground hover:bg-muted/50",
  };

  // Count stats for this month
  const periodDays = Array.from({ length: days }, (_, i) => dayStatus(i + 1)).filter(s => s === "period").length;
  const ovulationDays = Array.from({ length: days }, (_, i) => dayStatus(i + 1)).filter(s => s === "ovulation").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={prev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <span className="font-heading text-lg font-semibold text-foreground">{MONTHS[mo]} {yr}</span>
          {lastPeriod && (
            <div className="flex gap-3 justify-center mt-1">
              <span className="text-[10px] text-primary font-medium">{periodDays} period days</span>
              {ovulationDays > 0 && <span className="text-[10px] text-teal font-medium">{ovulationDays} ovulation</span>}
            </div>
          )}
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={next}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pb-2">{d}</div>
        ))}
        {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const s = dayStatus(d);
          const isToday = new Date(yr, mo, d).toDateString() === today.toDateString();
          const tooltip = getDayTooltip(d);
          return (
            <div
              key={d}
              className={cn(
                "aspect-square flex items-center justify-center rounded-lg text-xs transition-all duration-200 cursor-default relative group",
                statusClasses[s],
                isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background font-bold"
              )}
              onMouseEnter={() => setHoveredDay(d)}
              onMouseLeave={() => setHoveredDay(null)}
              title={tooltip || undefined}
            >
              {d}
              {isToday && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip for hovered day */}
      {hoveredDay && getDayTooltip(hoveredDay) && (
        <div className="text-center text-xs text-muted-foreground bg-muted/50 rounded-lg py-1.5 px-3 animate-fade-up">
          Day {hoveredDay}: {getDayTooltip(hoveredDay)}
        </div>
      )}

      <div className="flex gap-4 flex-wrap pt-1 justify-center">
        {[
          { color: "bg-primary", label: "Period", desc: "Active bleeding" },
          { color: "bg-primary/20", label: "Predicted", desc: "Period expected" },
          { color: "bg-teal/20", label: "Ovulation", desc: "Fertile window" },
        ].map(({ color, label, desc }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={cn("w-3 h-3 rounded", color)} />
            <div>
              <span className="font-medium text-foreground">{label}</span>
              <span className="hidden sm:inline text-muted-foreground"> · {desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
