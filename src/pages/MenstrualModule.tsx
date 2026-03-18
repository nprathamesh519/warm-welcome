import { useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Droplets, Heart, Calendar, TrendingUp, Info, BarChart3, Clock } from "lucide-react";
import { MenstrualFormData, MenstrualPrediction, runAppPyLogic, computeLiveRisk } from "@/lib/menstrual-ml";
import { AssessmentForm } from "@/components/menstrual/AssessmentForm";
import { MenstrualResults } from "@/components/menstrual/MenstrualResults";
import { CycleCalendar } from "@/components/menstrual/CycleCalendar";
import { PhaseRing } from "@/components/menstrual/PhaseRing";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type TabId = "assess" | "tracker" | "insights" | "result";

const TABS = [
  { id: "assess" as const, icon: Heart, label: "Assess", desc: "Health check" },
  { id: "tracker" as const, icon: Calendar, label: "Tracker", desc: "Cycle view" },
  { id: "insights" as const, icon: TrendingUp, label: "Insights", desc: "Your data" },
];

const DEFAULT_FORM: MenstrualFormData = {
  age: 25, bmi: 22.0, sleep: 7,
  stress: "", pcos: "", thyroid: "",
  period_duration: 5, flow: "", cramps: "", pimples: "",
  prev1: 28, prev2: 29, prev3: 28,
  last_period: "",
};

const MenstrualModule = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("assess");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MenstrualPrediction | null>(null);
  const [apiUsed, setApiUsed] = useState(false);
  const [form, setForm] = useState<MenstrualFormData>({ ...DEFAULT_FORM });

  const setField = useCallback((key: keyof MenstrualFormData, value: MenstrualFormData[keyof MenstrualFormData]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const avgCycle = Math.round((form.prev1 + form.prev2 + form.prev3) / 3);
  const dayInCycle = form.last_period
    ? Math.floor((Date.now() - new Date(form.last_period + "T12:00:00").getTime()) / 86400000)
    : 14;

  const handleSubmit = async () => {
    setLoading(true);
    let prediction: MenstrualPrediction | null = null;
    let used = false;

    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
      const res = await fetch("http://localhost:8000/predict", { method: "POST", body });
      if (res.ok) {
        const data = await res.json();
        prediction = {
          result: data.cycle_status,
          severity: data.severity || "Moderate",
          medical_score: data.medical_score ?? computeLiveRisk(form),
          ml_result: data.ml_result || data.cycle_status,
          mean_cycle: (form.prev1 + form.prev2 + form.prev3) / 3,
          variation: Math.max(form.prev1, form.prev2, form.prev3) - Math.min(form.prev1, form.prev2, form.prev3),
          predicted_cycle: data.predicted_cycle || Math.floor(form.prev1 * 0.4 + form.prev2 * 0.3 + form.prev3 * 0.3),
          next_date: data.next_period_date,
          next_date_obj: new Date(data.next_period_date),
        };
        used = true;
      }
    } catch { /* API unavailable */ }

    if (!prediction) prediction = runAppPyLogic(form);

    if (user && prediction) {
      try {
        await supabase.from("health_assessments").insert([{
          user_id: user.id,
          assessment_type: used ? "menstrual_ml_api" : "menstrual_ml_local",
          risk_score: prediction.medical_score,
          risk_category: prediction.result === "Regular" ? "low" : (prediction.severity === "High" ? "high" : "medium"),
          responses: JSON.parse(JSON.stringify(form)),
          recommendations: JSON.parse(JSON.stringify({
            cycle_status: prediction.result,
            severity: prediction.severity,
            next_date: prediction.next_date,
            predicted_cycle: prediction.predicted_cycle,
          })),
        }]);
      } catch (err) {
        console.error("Error saving assessment:", err);
      }
    }

    setApiUsed(used);
    setResult(prediction);
    setTimeout(() => { setLoading(false); setTab("result"); }, used ? 0 : 800);
  };

  const handleReset = () => {
    setResult(null);
    setTab("assess");
    setForm({ ...DEFAULT_FORM });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 sm:pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-xl">
          {/* Header */}
          <div className="text-center mb-5 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-56 bg-gradient-radial from-primary/8 to-transparent pointer-events-none" />
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/10">
              <Droplets className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-1">
              Menstrual Cycle
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Health</span>
            </h1>
            <p className="text-xs text-muted-foreground tracking-wide flex items-center justify-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
              AI-powered analysis · medical scoring
            </p>
          </div>

          {/* Tabs (hide on result) */}
          {tab !== "result" && (
            <div className="flex gap-0 bg-card border border-border rounded-2xl p-1 mb-5 shadow-sm">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-wide transition-all duration-200",
                    tab === t.id
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                  <span className={cn("text-[8px] font-normal tracking-normal lowercase",
                    tab === t.id ? "text-primary-foreground/70" : "text-muted-foreground/60"
                  )}>{t.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Assessment Tab */}
          {tab === "assess" && (
            <AssessmentForm form={form} setField={setField} onSubmit={handleSubmit} loading={loading} />
          )}

          {/* Tracker Tab */}
          {tab === "tracker" && (
            <div className="space-y-4 animate-fade-up">
              {/* Phase Ring */}
              <Card className="border-primary/10 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary via-teal to-accent" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-semibold text-foreground">Current Phase</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {form.last_period ? `Since ${form.last_period}` : "Set your last period date"}
                      </p>
                    </div>
                  </div>
                  <PhaseRing dayInCycle={dayInCycle} avgCycle={avgCycle} />
                </CardContent>
              </Card>

              {/* Cycle Calendar */}
              <Card className="border-primary/10 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary to-teal" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-teal" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-semibold text-foreground">Cycle Calendar</h3>
                      <p className="text-[11px] text-muted-foreground">Tap any day for details</p>
                    </div>
                  </div>
                  <CycleCalendar lastPeriod={form.last_period} avgCycle={avgCycle} periodDuration={form.period_duration} />
                </CardContent>
              </Card>

              {/* Quick stats bar */}
              {form.last_period && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: `${avgCycle}d`, label: "Avg Cycle", color: "text-primary", bg: "bg-primary/5 border-primary/10" },
                    { value: `${form.period_duration}d`, label: "Period", color: "text-accent", bg: "bg-accent/5 border-accent/10" },
                    { value: `Day ${dayInCycle}`, label: "Current", color: "text-teal", bg: "bg-teal/5 border-teal/10" },
                  ].map(s => (
                    <div key={s.label} className={cn("text-center p-3 rounded-xl border", s.bg)}>
                      <div className={cn("font-heading text-lg font-bold", s.color)}>{s.value}</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {!form.last_period && (
                <div className="text-center py-6 space-y-3 bg-muted/20 rounded-2xl border border-dashed border-border">
                  <Info className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">Complete the assessment first to see your cycle data.</p>
                  <Button variant="outline" size="sm" onClick={() => setTab("assess")} className="gap-1.5">
                    <Heart className="w-3.5 h-3.5" /> Go to Assessment
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Insights Tab */}
          {tab === "insights" && (
            <div className="space-y-4 animate-fade-up">
              {result ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: avgCycle, label: "Avg Cycle", unit: "days", color: "text-primary", bg: "bg-primary/5 border-primary/10" },
                      { value: result.medical_score, label: "Risk Score", unit: "pts", color: result.medical_score < 3 ? "text-teal" : "text-primary", bg: result.medical_score < 3 ? "bg-teal/5 border-teal/10" : "bg-primary/5 border-primary/10" },
                      { value: form.period_duration, label: "Period", unit: "days", color: "text-accent", bg: "bg-accent/5 border-accent/10" },
                    ].map(stat => (
                      <div key={stat.label} className={cn("text-center p-3 rounded-xl border", stat.bg)}>
                        <div className={cn("font-heading text-2xl font-bold", stat.color)}>{stat.value}</div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.unit}</div>
                        <div className="text-[10px] text-muted-foreground font-medium">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <Card className="border-primary/10 shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        <h3 className="font-heading text-sm font-semibold text-foreground">Analysis Summary</h3>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: "Cycle Status", value: result.result, ok: result.result === "Regular" },
                          { label: "Predicted Cycle", value: `${result.predicted_cycle} days`, ok: true },
                          { label: "Next Period", value: result.next_date, ok: true },
                          { label: "Variation", value: `${result.variation} days`, ok: result.variation <= 7 },
                          { label: "Severity", value: result.severity, ok: result.severity === "Moderate" },
                        ].map(item => (
                          <div key={item.label} className="flex justify-between items-center py-2 px-3 rounded-lg bg-muted/30">
                            <span className="text-sm text-muted-foreground">{item.label}</span>
                            <Badge variant="secondary" className={cn(
                              "text-xs font-semibold",
                              item.ok ? "bg-teal/10 text-teal" : "bg-primary/10 text-primary"
                            )}>{item.value}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-12 space-y-4 bg-muted/20 rounded-2xl border border-dashed border-border">
                  <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                    <TrendingUp className="w-7 h-7 text-muted-foreground/30" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">No Data Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">Complete an assessment to see your cycle insights.</p>
                  <Button onClick={() => setTab("assess")} size="sm" className="shadow-lg shadow-primary/20 gap-1.5">
                    <Heart className="w-3.5 h-3.5" /> Start Assessment
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Result Tab */}
          {tab === "result" && result && (
            <MenstrualResults prediction={result} form={form} apiUsed={apiUsed} onReset={handleReset} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MenstrualModule;
