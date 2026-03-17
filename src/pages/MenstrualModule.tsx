import { useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Droplets, Heart, Calendar, TrendingUp, Loader2 } from "lucide-react";
import { MenstrualFormData, MenstrualPrediction, runAppPyLogic, computeLiveRisk } from "@/lib/menstrual-ml";
import { AssessmentForm } from "@/components/menstrual/AssessmentForm";
import { MenstrualResults } from "@/components/menstrual/MenstrualResults";
import { CycleCalendar } from "@/components/menstrual/CycleCalendar";
import { PhaseRing } from "@/components/menstrual/PhaseRing";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TabId = "assess" | "tracker" | "insights" | "result";

const TABS = [
  { id: "assess" as const, icon: Heart, label: "Assess" },
  { id: "tracker" as const, icon: Calendar, label: "Tracker" },
  { id: "insights" as const, icon: TrendingUp, label: "Insights" },
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

    if (!prediction) {
      prediction = runAppPyLogic(form);
    }

    // Save to Supabase
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
      <main className="pt-20 sm:pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-xl">
          {/* Header */}
          <div className="text-center mb-6 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-48 bg-gradient-radial from-primary/8 to-transparent pointer-events-none" />
            <div className="w-[76px] h-[76px] rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4 shadow-md animate-bounce-slow">
              <Droplets className="w-9 h-9 text-primary" />
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-2">
              Menstrual Cycle<br />Health Assessment
            </h1>
            <p className="text-sm text-muted-foreground tracking-wide">
              AI-powered analysis · exact medical scoring
            </p>
          </div>

          {/* Tabs (hide on result) */}
          {tab !== "result" && (
            <div className="flex gap-0 bg-card border border-border rounded-xl p-1 mb-5 shadow-sm">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-all",
                    tab === t.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
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
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-heading text-base font-semibold text-foreground mb-4">Cycle Phase</h3>
                  <PhaseRing dayInCycle={dayInCycle} avgCycle={avgCycle} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-heading text-base font-semibold text-foreground mb-4">Calendar View</h3>
                  <CycleCalendar lastPeriod={form.last_period} avgCycle={avgCycle} periodDuration={form.period_duration} />
                </CardContent>
              </Card>
              {!form.last_period && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Complete the assessment to see your cycle data here.
                </div>
              )}
            </div>
          )}

          {/* Insights Tab */}
          {tab === "insights" && (
            <div className="space-y-4 animate-fade-up">
              {result ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: avgCycle, label: "Avg Cycle" },
                      { value: result.medical_score, label: "Risk Score" },
                      { value: form.period_duration, label: "Period Days" },
                    ].map(stat => (
                      <Card key={stat.label} className="text-center">
                        <CardContent className="p-4">
                          <div className="font-heading text-2xl font-bold text-primary">{stat.value}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">{stat.label}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="font-heading text-base font-semibold text-foreground mb-3">Your Analysis</h3>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>• Cycle Status: <span className={result.result === "Regular" ? "text-teal font-semibold" : "text-destructive font-semibold"}>{result.result}</span></p>
                        <p>• Predicted Cycle Length: <span className="text-foreground font-medium">{result.predicted_cycle} days</span></p>
                        <p>• Next Period: <span className="text-foreground font-medium">{result.next_date}</span></p>
                        <p>• Cycle Variation: <span className="text-foreground font-medium">{result.variation} days</span></p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-2">No Data Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Complete an assessment to see insights.</p>
                  <Button onClick={() => setTab("assess")}>Start Assessment</Button>
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
