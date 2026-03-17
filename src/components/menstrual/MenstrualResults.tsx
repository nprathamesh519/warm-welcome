import { MenstrualPrediction, MenstrualFormData, getBreakdownRows } from "@/lib/menstrual-ml";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, RotateCcw, Apple, Dumbbell, Moon, Stethoscope } from "lucide-react";

interface MenstrualResultsProps {
  prediction: MenstrualPrediction;
  form: MenstrualFormData;
  apiUsed: boolean;
  onReset: () => void;
}

export function MenstrualResults({ prediction, form, apiUsed, onReset }: MenstrualResultsProps) {
  const isRegular = prediction.result === "Regular";
  const breakdown = getBreakdownRows(form);

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Hero Result */}
      <div className={`relative rounded-2xl p-8 text-center overflow-hidden border ${
        isRegular 
          ? "bg-gradient-to-br from-teal/10 to-teal/5 border-teal/20" 
          : "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20"
      }`}>
        <div className={`absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-10 ${isRegular ? "bg-teal" : "bg-primary"}`} />
        
        <Badge variant="secondary" className={`mb-4 ${isRegular ? "bg-teal/15 text-teal" : "bg-primary/15 text-primary"}`}>
          {isRegular ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
          {prediction.result} Cycle
        </Badge>

        <h2 className={`font-heading text-4xl sm:text-5xl font-bold mb-2 ${isRegular ? "text-teal" : "text-primary"}`}>
          {isRegular ? "Looking Good!" : "Needs Attention"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
          {isRegular
            ? "Your menstrual cycle appears healthy. Maintain a balanced lifestyle."
            : `Your cycle shows irregularity with ${prediction.severity.toLowerCase()} severity. Consider consulting a specialist.`}
        </p>

        <div className="inline-flex flex-col items-center bg-background rounded-xl px-7 py-4 shadow-sm">
          <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-1">Next Period Expected</span>
          <span className="font-heading text-xl font-semibold text-foreground">{prediction.next_date}</span>
          <span className="text-[11px] text-muted-foreground mt-1">~{prediction.predicted_cycle} day cycle</span>
        </div>
      </div>

      {/* Score Details */}
      <div className="flex gap-4 flex-wrap p-4 rounded-xl bg-primary/5 border border-primary/10">
        {[
          { label: "Medical Score", value: prediction.medical_score },
          { label: "ML Result", value: prediction.ml_result },
          { label: "Avg Cycle", value: `${prediction.mean_cycle.toFixed(1)}d` },
          { label: "Variation", value: `${prediction.variation}d` },
        ].map(item => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{item.label}</span>
            <span className="font-heading text-lg font-semibold text-primary">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: prediction.predicted_cycle, label: "Predicted Cycle" },
          { value: prediction.medical_score, label: "Risk Score" },
          { value: prediction.variation, label: "Variation Days" },
        ].map(stat => (
          <Card key={stat.label} className="text-center">
            <CardContent className="p-4">
              <div className="font-heading text-2xl font-bold text-primary">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Breakdown */}
      {breakdown.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Risk Breakdown</h3>
            {breakdown.map((row, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={`font-semibold text-sm ${row.color}`}>{row.points}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Doctor Alert for Irregular */}
      {!isRegular && (
        <div className="flex gap-3 items-start p-4 rounded-xl bg-destructive/5 border border-destructive/15">
          <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-destructive mb-1">Consult a Specialist</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Irregular cycles can indicate underlying conditions. We recommend scheduling an appointment with a gynecologist.
            </p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: Apple, title: "Diet Plan", color: "bg-teal/10", dotColor: "bg-teal",
            items: ["Iron-rich foods (spinach, lentils)", "Lean protein intake", "Reduce refined sugar", "Stay hydrated (2L+ daily)"],
          },
          {
            icon: Dumbbell, title: "Exercise", color: "bg-accent/10", dotColor: "bg-accent",
            items: ["30min daily walking", "Yoga & stretching", "Light strength training", "Avoid overexertion during period"],
          },
          {
            icon: Moon, title: "Lifestyle", color: "bg-primary/10", dotColor: "bg-primary",
            items: ["Sleep 7–8 hours nightly", "Practice stress reduction", "Maintain consistent routine", "Track symptoms regularly"],
          },
        ].map(rec => (
          <Card key={rec.title} className="animate-fade-up">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${rec.color} flex items-center justify-center mb-3`}>
                <rec.icon className="w-4 h-4 text-foreground" />
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-3">{rec.title}</h4>
              <ul className="space-y-1.5">
                {rec.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-[11px] text-muted-foreground leading-relaxed">
                    <span className={`w-1.5 h-1.5 rounded-full ${rec.dotColor} flex-shrink-0 mt-1.5`} />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* API badge */}
      <div className="text-center">
        <Badge variant="outline" className="text-[10px]">
          {apiUsed ? "✨ ML API prediction" : "🧠 Local analysis (API offline)"}
        </Badge>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-2.5 items-start p-3 rounded-lg bg-accent/10 border border-accent/20">
        <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          This AI prediction is for educational purposes only and does not replace professional medical advice. Please consult a doctor for health concerns.
        </p>
      </div>

      {/* Reset */}
      <Button variant="outline" className="w-full" onClick={onReset}>
        <RotateCcw className="w-4 h-4 mr-2" /> Start New Assessment
      </Button>
    </div>
  );
}
