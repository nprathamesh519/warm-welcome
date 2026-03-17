import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const first = new Date(yr, mo, 1).getDay();
  const days = new Date(yr, mo + 1, 0).getDate();
  const today = new Date();

  const prev = () => { let m = mo - 1, y = yr; if (m < 0) { m = 11; y--; } setMo(m); setYr(y); };
  const next = () => { let m = mo + 1, y = yr; if (m > 11) { m = 0; y++; } setMo(m); setYr(y); };

  const statusClasses: Record<string, string> = {
    period: "bg-primary text-primary-foreground font-semibold",
    predicted: "bg-primary/15 text-primary border border-primary/30",
    ovulation: "bg-teal/15 text-teal border border-teal/30",
    normal: "text-muted-foreground",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={prev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-heading text-base font-semibold text-foreground">{MONTHS[mo]} {yr}</span>
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={next}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground uppercase tracking-wide pb-1.5">{d}</div>
        ))}
        {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const s = dayStatus(d);
          const isToday = new Date(yr, mo, d).toDateString() === today.toDateString();
          return (
            <div
              key={d}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs transition-colors
                ${statusClasses[s]}
                ${isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-background font-bold" : ""}
              `}
            >
              {d}
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 flex-wrap pt-1">
        {[
          { color: "bg-primary", label: "Period" },
          { color: "bg-primary/20", label: "Predicted" },
          { color: "bg-teal/20", label: "Ovulation" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
