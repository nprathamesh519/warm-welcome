import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { HealthDisclaimer } from "@/components/health/HealthDisclaimer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { predictCycleFromAPI, CycleData } from "@/lib/ml-predictions";
import {
  Droplets, Loader2, CheckCircle2, ArrowLeft, Calendar,
  Heart, Moon, Activity, Thermometer, Sparkles, AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { format, addDays } from "date-fns";

type Step = "education" | "assessment" | "results";

interface MenstrualFormData {
  age: number;
  bmi: number;
  sleep: number;
  stress: "low" | "medium" | "high";
  pcos: boolean;
  thyroid: boolean;
  period_duration: number;
  flow: "light" | "medium" | "heavy";
  cramps: "low" | "medium" | "high";
  pimples: boolean;
  prev1: number;
  prev2: number;
  prev3: number;
  last_period: string;
}

interface AssessmentResult {
  cycleStatus: string;
  nextPeriodDate: string;
  averageCycleLength: number;
  isIrregular: boolean;
  confidenceLevel: string;
  recommendations: {
    diet: string[];
    exercise: string[];
    lifestyle: string[];
  };
  riskScore: number;
  riskCategory: string;
}

const MenstrualAssessment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>("education");
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [formData, setFormData] = useState<MenstrualFormData>({
    age: 25, bmi: 22, sleep: 7, stress: "medium",
    pcos: false, thyroid: false, period_duration: 5,
    flow: "medium", cramps: "medium", pimples: false,
    prev1: 28, prev2: 28, prev3: 28, last_period: format(new Date(), "yyyy-MM-dd"),
  });

  const updateField = <K extends keyof MenstrualFormData>(key: K, value: MenstrualFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setAnalyzing(true);
    setCurrentStep("results");

    try {
      const stressMap = { low: 1, medium: 3, high: 5 };
      const crampsMap = { low: "none", medium: "mild", high: "severe" } as const;

      const cycleData: CycleData = {
        cycleHistory: [formData.prev1, formData.prev2, formData.prev3],
        lastPeriodStart: new Date(formData.last_period),
        symptoms: {
          cramps: crampsMap[formData.cramps],
          acne: formData.pimples,
          bloating: false,
          fatigue: false,
        },
        stressLevel: stressMap[formData.stress],
        sleepHours: formData.sleep,
      };

      const { _meta, ...prediction } = await predictCycleFromAPI(cycleData);

      const avgCycle = prediction.averageCycleLength;
      const isIrregular = prediction.isIrregular;
      const riskScore = isIrregular ? Math.min(prediction.cycleVariability * 10 + 30, 85) : Math.max(10, prediction.cycleVariability * 5);
      const riskCategory = riskScore > 50 ? "moderate" : "low";

      const assessmentResult: AssessmentResult = {
        cycleStatus: isIrregular ? "Irregular" : "Regular",
        nextPeriodDate: format(prediction.predictedStartDate, "yyyy-MM-dd"),
        averageCycleLength: avgCycle,
        isIrregular,
        confidenceLevel: prediction.confidenceLevel,
        riskScore,
        riskCategory,
        recommendations: {
          diet: isIrregular
            ? ["Iron-rich foods: spinach, dates, jaggery", "Anti-inflammatory: turmeric, ginger tea", "Omega-3: flaxseeds, walnuts, fish", "Avoid processed and fried food"]
            : ["Maintain balanced nutrition", "Include iron-rich foods during period", "Stay hydrated with 2-3L water daily", "Include fresh fruits and vegetables"],
          exercise: isIrregular
            ? ["Gentle yoga: Baddha Konasana, Supta Virasana", "Light walking 20-30 min daily", "Avoid intense workouts during period", "Pranayama for stress reduction"]
            : ["Regular 30-min moderate exercise", "Mix of cardio and flexibility", "Light stretching during period", "Stay active throughout the month"],
          lifestyle: isIrregular
            ? ["Track symptoms consistently", "Maintain regular sleep schedule", "Stress management is crucial", "Consult a gynecologist if persistent"]
            : ["Continue tracking your cycle", "Maintain healthy sleep habits", "Regular health check-ups", "Practice stress management"],
        },
      };

      setResult(assessmentResult);

      // Save to Supabase
      if (user) {
        const assessmentType = _meta.usedAPI ? "menstrual_ml_api" : "menstrual_ml_local";
        await (supabase.from("health_assessments") as any).insert([{
          user_id: user.id,
          assessment_type: assessmentType,
          risk_score: riskScore,
          risk_category: riskCategory,
          responses: formData,
          recommendations: assessmentResult.recommendations,
        }]);
      }

      toast({ title: "Assessment Complete!", description: "Your menstrual cycle analysis is ready." });
    } catch (err) {
      console.error("Menstrual assessment error:", err);
      toast({ title: "Error", description: "Unable to analyze cycle. Please try again.", variant: "destructive" });
      setCurrentStep("assessment");
    } finally {
      setAnalyzing(false);
    }
  };

  const stepIndex = currentStep === "education" ? 0 : currentStep === "assessment" ? 1 : 2;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 sm:pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {["Learn", "Assess", "Results"].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i <= stepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{i + 1}</div>
                <span className="text-xs text-muted-foreground hidden sm:inline">{label}</span>
                {i < 2 && <div className={`w-8 h-0.5 ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>

          {/* Education Step */}
          {currentStep === "education" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Droplets className="w-10 h-10 text-primary" />
                </div>
                <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Menstrual Cycle Assessment</h1>
                <p className="text-muted-foreground">Answer a few quick questions to analyze your menstrual health and predict your next period.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Heart className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">Personal Health</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Age, BMI, sleep hours, stress level, and medical conditions (PCOS, thyroid).</p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-semibold text-foreground">Period Details</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Duration, flow type, cramps severity, and last 3 cycle lengths.</p>
                </div>
              </div>

              <div className="glass-card rounded-xl p-5 border-l-4 border-accent bg-accent/5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Accuracy Notice</h4>
                    <p className="text-sm text-muted-foreground">This is a screening tool, not a diagnosis. Consult a doctor for medical advice.</p>
                  </div>
                </div>
              </div>

              <Button size="lg" className="w-full" onClick={() => setCurrentStep("assessment")}>
                Start Assessment <Sparkles className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* Assessment Form */}
          {currentStep === "assessment" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep("education")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>

              <h2 className="font-heading text-2xl font-bold text-foreground">Complete Your Assessment</h2>

              {/* Basic Health */}
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" /> Basic Health
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input id="age" type="number" min={10} max={60} value={formData.age}
                      onChange={e => updateField("age", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label htmlFor="bmi">BMI</Label>
                    <Input id="bmi" type="number" step="0.1" min={10} max={50} value={formData.bmi}
                      onChange={e => updateField("bmi", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label htmlFor="sleep">Sleep Hours</Label>
                    <Input id="sleep" type="number" step="0.5" min={3} max={12} value={formData.sleep}
                      onChange={e => updateField("sleep", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Stress Level</Label>
                    <RadioGroup value={formData.stress} onValueChange={v => updateField("stress", v as "low" | "medium" | "high")} className="flex gap-3 mt-2">
                      {(["low", "medium", "high"] as const).map(v => (
                        <div key={v} className="flex items-center gap-1.5">
                          <RadioGroupItem value={v} id={`stress-${v}`} />
                          <Label htmlFor={`stress-${v}`} className="text-sm capitalize">{v}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </div>

              {/* Medical Conditions */}
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Thermometer className="w-5 h-5 text-accent" /> Medical Conditions
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>PCOS</Label>
                    <RadioGroup value={formData.pcos ? "yes" : "no"} onValueChange={v => updateField("pcos", v === "yes")} className="flex gap-3 mt-2">
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="yes" id="pcos-y" /><Label htmlFor="pcos-y" className="text-sm">Yes</Label></div>
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="no" id="pcos-n" /><Label htmlFor="pcos-n" className="text-sm">No</Label></div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Label>Thyroid</Label>
                    <RadioGroup value={formData.thyroid ? "yes" : "no"} onValueChange={v => updateField("thyroid", v === "yes")} className="flex gap-3 mt-2">
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="yes" id="thyroid-y" /><Label htmlFor="thyroid-y" className="text-sm">Yes</Label></div>
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="no" id="thyroid-n" /><Label htmlFor="thyroid-n" className="text-sm">No</Label></div>
                    </RadioGroup>
                  </div>
                </div>
              </div>

              {/* Period Details */}
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-primary" /> Period Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="period_duration">Period Duration (days)</Label>
                    <Input id="period_duration" type="number" min={1} max={14} value={formData.period_duration}
                      onChange={e => updateField("period_duration", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Flow Type</Label>
                    <RadioGroup value={formData.flow} onValueChange={v => updateField("flow", v as "light" | "medium" | "heavy")} className="flex gap-3 mt-2">
                      {(["light", "medium", "heavy"] as const).map(v => (
                        <div key={v} className="flex items-center gap-1.5">
                          <RadioGroupItem value={v} id={`flow-${v}`} />
                          <Label htmlFor={`flow-${v}`} className="text-sm capitalize">{v}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <Label>Cramps Severity</Label>
                    <RadioGroup value={formData.cramps} onValueChange={v => updateField("cramps", v as "low" | "medium" | "high")} className="flex gap-3 mt-2">
                      {(["low", "medium", "high"] as const).map(v => (
                        <div key={v} className="flex items-center gap-1.5">
                          <RadioGroupItem value={v} id={`cramps-${v}`} />
                          <Label htmlFor={`cramps-${v}`} className="text-sm capitalize">{v}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <Label>Pimples</Label>
                    <RadioGroup value={formData.pimples ? "yes" : "no"} onValueChange={v => updateField("pimples", v === "yes")} className="flex gap-3 mt-2">
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="yes" id="pimples-y" /><Label htmlFor="pimples-y" className="text-sm">Yes</Label></div>
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="no" id="pimples-n" /><Label htmlFor="pimples-n" className="text-sm">No</Label></div>
                    </RadioGroup>
                  </div>
                </div>
              </div>

              {/* Previous Cycles */}
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal" /> Previous Cycles
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="prev1">Cycle 1 (days)</Label>
                    <Input id="prev1" type="number" min={15} max={60} value={formData.prev1}
                      onChange={e => updateField("prev1", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label htmlFor="prev2">Cycle 2 (days)</Label>
                    <Input id="prev2" type="number" min={15} max={60} value={formData.prev2}
                      onChange={e => updateField("prev2", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label htmlFor="prev3">Cycle 3 (days)</Label>
                    <Input id="prev3" type="number" min={15} max={60} value={formData.prev3}
                      onChange={e => updateField("prev3", Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="last_period">Last Period Start Date</Label>
                  <Input id="last_period" type="date" value={formData.last_period}
                    onChange={e => updateField("last_period", e.target.value)} />
                </div>
              </div>

              <Button size="lg" className="w-full" onClick={handleSubmit}>
                <Sparkles className="w-5 h-5 mr-2" /> Analyze My Cycle
              </Button>

              <HealthDisclaimer />
            </motion.div>
          )}

          {/* Results */}
          {currentStep === "results" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {analyzing ? (
                <div className="text-center py-20">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                  <h3 className="font-heading text-xl font-semibold text-foreground">Analyzing your menstrual cycle...</h3>
                  <p className="text-muted-foreground mt-2">Processing your health data</p>
                </div>
              ) : result ? (
                <>
                  {/* Status Card */}
                  <div className={`glass-card rounded-xl p-6 border-l-4 ${result.isIrregular ? "border-destructive bg-destructive/5" : "border-teal bg-teal/5"}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${result.isIrregular ? "bg-destructive/20" : "bg-teal/20"}`}>
                        {result.isIrregular
                          ? <AlertCircle className="w-7 h-7 text-destructive" />
                          : <CheckCircle2 className="w-7 h-7 text-teal" />}
                      </div>
                      <div>
                        <h3 className="font-heading text-xl font-bold text-foreground">
                          Cycle Status: {result.cycleStatus}
                        </h3>
                        <p className="text-muted-foreground">
                          Next Period: {format(new Date(result.nextPeriodDate), "MMMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Average Cycle: {result.averageCycleLength} days · Confidence: {result.confidenceLevel}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {(["diet", "exercise", "lifestyle"] as const).map((cat) => {
                    const icons = { diet: "🥗", exercise: "🏃‍♀️", lifestyle: "🧘‍♀️" };
                    const titles = { diet: "Diet Advice", exercise: "Exercise Tips", lifestyle: "Lifestyle Guidance" };
                    return (
                      <div key={cat} className="glass-card rounded-xl p-5">
                        <h4 className="font-semibold text-foreground mb-3">{icons[cat]} {titles[cat]}</h4>
                        <ul className="space-y-2">
                          {result.recommendations[cat].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="w-4 h-4 text-teal mt-0.5 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => navigate("/dashboard")}>
                      Go to Dashboard
                    </Button>
                    <Button className="flex-1" onClick={() => navigate("/doctors")}>
                      Find Specialist
                    </Button>
                  </div>

                  <Button variant="ghost" className="w-full" onClick={() => { setResult(null); setCurrentStep("education"); }}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retake Assessment
                  </Button>
                </>
              ) : null}
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MenstrualAssessment;
