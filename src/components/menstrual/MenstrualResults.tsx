import { MenstrualPrediction, MenstrualFormData, getBreakdownRows } from "@/lib/menstrual-ml";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, RotateCcw, Apple, Dumbbell, Moon, Stethoscope, TrendingUp, Calendar, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenstrualResultsProps {
  prediction: MenstrualPrediction;
  form: MenstrualFormData;
  apiUsed: boolean;
  onReset: () => void;
}

function ScoreRing({ score, maxScore = 15 }: { score: number; maxScore?: number }) {
  const pct = Math.min(1, score / maxScore);
  const r = 45, cx = 55, cy = 55;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = score < 3 ? "hsl(var(--teal))" : score < 6 ? "hsl(var(--accent))" : "hsl(var(--destructive))";
  const label = score < 3 ? "Low" : score < 6 ? "Moderate" : "High";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 110 110" className="w-full h-full">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">score</span>
        </div>
      </div>
      <span className="text-xs font-semibold mt-1" style={{ color }}>{label} Risk</span>
    </div>
  );
}

export function MenstrualResults({ prediction, form, apiUsed, onReset }: MenstrualResultsProps) {
  const isRegular = prediction.result === "Regular";
  const breakdown = getBreakdownRows(form);

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Hero Result */}
      <div className={cn(
        "relative rounded-3xl p-8 text-center overflow-hidden border-2 shadow-lg",
        isRegular
          ? "bg-gradient-to-br from-teal/10 via-teal/5 to-background border-teal/25 shadow-teal/10"
          : "bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/25 shadow-primary/10"
      )}>
        <div className={cn("absolute -top-16 -right-16 w-52 h-52 rounded-full opacity-[0.07]", isRegular ? "bg-teal" : "bg-primary")} />
        <div className={cn("absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-[0.05]", isRegular ? "bg-teal" : "bg-primary")} />

        <Badge variant="secondary" className={cn("mb-4 px-4 py-1.5 text-sm", isRegular ? "bg-teal/15 text-teal border-teal/20" : "bg-primary/15 text-primary border-primary/20")}>
          {isRegular ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <AlertTriangle className="w-4 h-4 mr-1.5" />}
          {prediction.result} Cycle
          {!isRegular && ` · ${prediction.severity} Severity`}
        </Badge>

        <h2 className={cn("font-heading text-4xl sm:text-5xl font-bold mb-3", isRegular ? "text-teal" : "text-primary")}>
          {isRegular ? "Looking Good! ✨" : "Needs Attention ⚠️"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
          {isRegular
            ? "Your menstrual cycle appears healthy and regular. Keep maintaining your balanced lifestyle!"
            : `Your cycle shows irregularity with ${prediction.severity.toLowerCase()} severity. Consider consulting a specialist for a proper evaluation.`}
        </p>

        <div className="inline-flex flex-col items-center bg-background/80 backdrop-blur-sm rounded-2xl px-8 py-5 shadow-md border border-border/50">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2 font-semibold">Next Period Expected</span>
          <span className="font-heading text-2xl font-bold text-foreground">{prediction.next_date}</span>
          <span className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> ~{prediction.predicted_cycle} day cycle
          </span>
        </div>
      </div>

      {/* Score + Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-primary/10">
          <CardContent className="p-4 flex items-center gap-4">
            <ScoreRing score={prediction.medical_score} />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Medical Score</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">Based on your health inputs and cycle data</p>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-rows-2 gap-3">
          <Card className="border-primary/10">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="font-heading text-lg font-bold text-primary">{prediction.predicted_cycle}d</div>
                <div className="text-[9px] text-muted-foreground uppercase">Predicted Cycle</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/10">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-accent" />
              </div>
              <div>
                <div className="font-heading text-lg font-bold text-accent">{prediction.variation}d</div>
                <div className="text-[9px] text-muted-foreground uppercase">Variation</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Metrics */}
      <Card className="border-primary/10">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            📊 Detailed Analysis
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Avg Cycle", value: `${prediction.mean_cycle.toFixed(1)}d`, ok: prediction.mean_cycle >= 24 && prediction.mean_cycle <= 35 },
              { label: "ML Result", value: prediction.ml_result, ok: prediction.ml_result === "Regular" },
              { label: "Severity", value: prediction.severity, ok: prediction.severity === "Moderate" },
              { label: "Source", value: apiUsed ? "ML API" : "Local", ok: true },
            ].map(m => (
              <div key={m.label} className={cn("p-3 rounded-xl text-center border", m.ok ? "bg-teal/5 border-teal/15" : "bg-primary/5 border-primary/15")}>
                <div className={cn("font-heading text-base font-bold", m.ok ? "text-teal" : "text-primary")}>{m.value}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      {breakdown.length > 0 && (
        <Card className="border-primary/10">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              🔍 Risk Breakdown
            </h3>
            <div className="space-y-1">
              {breakdown.map((row, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={cn("font-bold text-sm px-2 py-0.5 rounded-md", row.color, 
                    row.color === "text-destructive" ? "bg-destructive/10" : "bg-accent/10"
                  )}>{row.points}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground">Total Medical Score</span>
              <span className="font-heading text-xl font-bold text-primary">{prediction.medical_score}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Doctor Alert */}
      {!isRegular && (
        <div className="flex gap-3 items-start p-5 rounded-2xl bg-gradient-to-r from-destructive/5 to-destructive/10 border-2 border-destructive/15 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-destructive mb-1">🩺 Consult a Specialist</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Irregular cycles can indicate underlying conditions like PCOS, thyroid issues, or hormonal imbalances. We recommend scheduling an appointment with a gynecologist for proper evaluation.
            </p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2 px-1">
          💡 Personalized Recommendations
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: Apple, title: "🥗 Diet Plan", gradient: "from-teal/10 to-teal/5", border: "border-teal/15", dotColor: "bg-teal",
              items: ["Iron-rich foods (spinach, lentils)", "Lean protein intake daily", "Reduce refined sugar", "Stay hydrated (2L+ water daily)"],
            },
            {
              icon: Dumbbell, title: "🏃‍♀️ Exercise", gradient: "from-accent/10 to-accent/5", border: "border-accent/15", dotColor: "bg-accent",
              items: ["30min daily walking", "Yoga & stretching", "Light strength training", "Gentle movement during period"],
            },
            {
              icon: Moon, title: "🌙 Lifestyle", gradient: "from-primary/10 to-primary/5", border: "border-primary/15", dotColor: "bg-primary",
              items: ["Sleep 7–8 hours nightly", "Practice stress reduction", "Maintain consistent routine", "Track symptoms regularly"],
            },
          ].map((rec, idx) => (
            <Card key={rec.title} className={cn("border overflow-hidden", rec.border)} style={{ animationDelay: `${idx * 100}ms` }}>
              <div className={cn("h-1.5 bg-gradient-to-r", rec.gradient)} />
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">{rec.title}</h4>
                <ul className="space-y-2">
                  {rec.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5", rec.dotColor)} />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-3 items-start p-4 rounded-xl bg-accent/5 border border-accent/15">
        <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-accent mb-1">Medical Disclaimer</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This AI prediction is for educational purposes only and does not replace professional medical advice. Please consult a qualified healthcare provider for health concerns.
          </p>
        </div>
      </div>

      {/* Reset */}
      <Button variant="outline" className="w-full h-12 text-base" onClick={onReset}>
        <RotateCcw className="w-4 h-4 mr-2" /> Start New Assessment
      </Button>
    </div>
  );
}
