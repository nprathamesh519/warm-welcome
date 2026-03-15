import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Droplets, Loader2, CheckCircle2, AlertTriangle,
  CalendarIcon, Heart, Moon, Activity, Thermometer,
  Sparkles, Apple, Dumbbell, Leaf, RotateCcw, ArrowRight,
  User, Scale, BedDouble, Brain, Pill, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, differenceInDays } from "date-fns";

// ── Types ──────────────────────────────────────────────
interface FormData {
  age: number;
  bmi: number;
  sleep: number;
  stress: string;
  pcos: string;
  thyroid: string;
  period_duration: number;
  flow: string;
  cramps: string;
  pimples: string;
  prev1: number;
  prev2: number;
  prev3: number;
  last_period: Date | undefined;
}

interface PredictionResult {
  cycle_status: string;
  next_period_date: string;
  severity?: string;
  confidence?: string;
}

// ── Component ──────────────────────────────────────────
const MenstrualAssessment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    age: 25, bmi: 22.0, sleep: 7, stress: "",
    pcos: "", thyroid: "", period_duration: 5,
    flow: "", cramps: "", pimples: "",
    prev1: 28, prev2: 28, prev3: 28, last_period: undefined,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Validation ────────────────────────────────────────
  const isFormValid = (): boolean => {
    return (
      formData.age >= 10 && formData.age <= 60 &&
      formData.bmi >= 10 && formData.bmi <= 60 &&
      formData.sleep >= 1 && formData.sleep <= 16 &&
      !!formData.stress &&
      !!formData.pcos &&
      !!formData.thyroid &&
      formData.period_duration >= 1 && formData.period_duration <= 15 &&
      !!formData.flow &&
      !!formData.cramps &&
      !!formData.pimples &&
      formData.prev1 >= 15 && formData.prev1 <= 60 &&
      formData.prev2 >= 15 && formData.prev2 <= 60 &&
      formData.prev3 >= 15 && formData.prev3 <= 60 &&
      !!formData.last_period
    );
  };

  // ── Submit handler ────────────────────────────────────
  const handleSubmit = async () => {
    if (!isFormValid()) {
      toast({ title: "Incomplete Form", description: "Please fill all fields before submitting.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setShowResult(false);

    try {
      // Build FormData for FastAPI (multipart/form-data)
      const body = new FormData();
      body.append("age", String(formData.age));
      body.append("bmi", String(formData.bmi));
      body.append("sleep", String(formData.sleep));
      body.append("stress", formData.stress);
      body.append("pcos", formData.pcos);
      body.append("thyroid", formData.thyroid);
      body.append("period_duration", String(formData.period_duration));
      body.append("flow", formData.flow);
      body.append("cramps", formData.cramps);
      body.append("pimples", formData.pimples);
      body.append("prev1", String(formData.prev1));
      body.append("prev2", String(formData.prev2));
      body.append("prev3", String(formData.prev3));
      body.append("last_period", format(formData.last_period!, "yyyy-MM-dd"));

      let prediction: PredictionResult;
      let usedAPI = false;

      try {
        const res = await fetch("http://localhost:8000/predict", {
          method: "POST",
          body,
        });

        if (res.ok) {
          prediction = await res.json();
          usedAPI = true;
        } else {
          throw new Error("API error");
        }
      } catch {
        // Local fallback prediction
        prediction = localPrediction();
      }

      setResult(prediction);
      setShowResult(true);

      // Save to Supabase
      if (user) {
        const avgCycle = Math.round((formData.prev1 + formData.prev2 + formData.prev3) / 3);
        const isIrregular = prediction.cycle_status?.toLowerCase() === "irregular";
        const riskScore = isIrregular ? 55 : 15;
        const riskCategory = isIrregular ? "moderate" : "low";

        await supabase.from("health_assessments").insert([{
          user_id: user.id,
          assessment_type: usedAPI ? "menstrual_ml_api" : "menstrual_ml_local",
          risk_score: riskScore,
          risk_category: riskCategory,
          responses: {
            ...formData,
            last_period: format(formData.last_period!, "yyyy-MM-dd"),
          },
          recommendations: {
            cycle_status: prediction.cycle_status,
            next_period_date: prediction.next_period_date,
            average_cycle_length: avgCycle,
          },
        }]);
      }

      toast({ title: "Assessment Complete!", description: "Your menstrual cycle analysis is ready." });
    } catch (err) {
      console.error("Assessment error:", err);
      toast({ title: "Error", description: "Unable to analyze cycle right now. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Local fallback prediction ─────────────────────────
  const localPrediction = (): PredictionResult => {
    const avg = Math.round((formData.prev1 + formData.prev2 + formData.prev3) / 3);
    const variance = Math.sqrt(
      ((formData.prev1 - avg) ** 2 + (formData.prev2 - avg) ** 2 + (formData.prev3 - avg) ** 2) / 3
    );
    const isIrregular = variance > 5 || formData.prev1 < 21 || formData.prev2 < 21 || formData.prev3 < 21 ||
      formData.prev1 > 35 || formData.prev2 > 35 || formData.prev3 > 35;

    const nextDate = formData.last_period
      ? format(addDays(formData.last_period, avg + (formData.stress === "High" ? 2 : 0)), "yyyy-MM-dd")
      : "N/A";

    return {
      cycle_status: isIrregular ? "Irregular" : "Regular",
      next_period_date: nextDate,
      severity: isIrregular ? (variance > 8 ? "High" : "Moderate") : undefined,
      confidence: isIrregular ? "Low" : "High",
    };
  };

  // ── Reset handler ─────────────────────────────────────
  const handleReset = () => {
    setFormData({
      age: 25, bmi: 22.0, sleep: 7, stress: "",
      pcos: "", thyroid: "", period_duration: 5,
      flow: "", cramps: "", pimples: "",
      prev1: 28, prev2: 28, prev3: 28, last_period: undefined,
    });
    setResult(null);
    setShowResult(false);
  };

  const isRegular = result?.cycle_status?.toLowerCase() === "regular";

  // ── Progress calculation ──────────────────────────────
  const filledFields = [
    formData.stress, formData.pcos, formData.thyroid,
    formData.flow, formData.cramps, formData.pimples,
    formData.last_period ? "filled" : "",
  ].filter(Boolean).length;
  const progress = Math.round((filledFields / 7) * 100);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 sm:pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">

          {/* ── Page Header ──────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-5">
              <Droplets className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Menstrual Cycle Health Assessment
            </h1>
            <p className="text-muted-foreground text-base max-w-lg mx-auto">
              Analyze your menstrual health and predict your next cycle using AI.
            </p>
          </motion.div>

          {/* ── Progress Bar ─────────────────────────── */}
          {!showResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Form Progress</span>
                <span className="font-medium text-primary">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {!showResult ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* ── Personal Information ───────────── */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="age" className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" /> Age
                      </Label>
                      <Input id="age" type="number" min={10} max={60} value={formData.age}
                        onChange={e => updateField("age", Number(e.target.value))}
                        disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bmi" className="flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-muted-foreground" /> BMI
                      </Label>
                      <Input id="bmi" type="number" step={0.1} min={10} max={60} value={formData.bmi}
                        onChange={e => updateField("bmi", Number(e.target.value))}
                        disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sleep" className="flex items-center gap-1.5">
                        <BedDouble className="w-3.5 h-3.5 text-muted-foreground" /> Sleep Hours
                      </Label>
                      <Input id="sleep" type="number" step={0.5} min={1} max={16} value={formData.sleep}
                        onChange={e => updateField("sleep", Number(e.target.value))}
                        disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-muted-foreground" /> Stress Level
                      </Label>
                      <Select value={formData.stress} onValueChange={v => updateField("stress", v)} disabled={loading}>
                        <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Menstrual Information ──────────── */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
                        <Droplets className="w-5 h-5 text-accent" />
                      </div>
                      Menstrual Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="period_duration" className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Period Duration (days)
                      </Label>
                      <Input id="period_duration" type="number" min={1} max={15} value={formData.period_duration}
                        onChange={e => updateField("period_duration", Number(e.target.value))}
                        disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5 text-muted-foreground" /> Flow Type
                      </Label>
                      <Select value={formData.flow} onValueChange={v => updateField("flow", v)} disabled={loading}>
                        <SelectTrigger><SelectValue placeholder="Select flow" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Light">Light</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Heavy">Heavy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-muted-foreground" /> Cramps Severity
                      </Label>
                      <Select value={formData.cramps} onValueChange={v => updateField("cramps", v)} disabled={loading}>
                        <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-muted-foreground" /> Pimples
                      </Label>
                      <Select value={formData.pimples} onValueChange={v => updateField("pimples", v)} disabled={loading}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Health Conditions ──────────────── */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="w-9 h-9 rounded-lg bg-destructive/15 flex items-center justify-center">
                        <Pill className="w-5 h-5 text-destructive" />
                      </div>
                      Health Conditions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Thermometer className="w-3.5 h-3.5 text-muted-foreground" /> PCOS
                      </Label>
                      <Select value={formData.pcos} onValueChange={v => updateField("pcos", v)} disabled={loading}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-muted-foreground" /> Thyroid
                      </Label>
                      <Select value={formData.thyroid} onValueChange={v => updateField("thyroid", v)} disabled={loading}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Previous Cycle History ─────────── */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="w-9 h-9 rounded-lg bg-teal/15 flex items-center justify-center">
                        <CalendarIcon className="w-5 h-5 text-teal" />
                      </div>
                      Previous Cycle History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prev1">Cycle 1 (days)</Label>
                        <Input id="prev1" type="number" min={15} max={60} value={formData.prev1}
                          onChange={e => updateField("prev1", Number(e.target.value))}
                          disabled={loading} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prev2">Cycle 2 (days)</Label>
                        <Input id="prev2" type="number" min={15} max={60} value={formData.prev2}
                          onChange={e => updateField("prev2", Number(e.target.value))}
                          disabled={loading} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prev3">Cycle 3 (days)</Label>
                        <Input id="prev3" type="number" min={15} max={60} value={formData.prev3}
                          onChange={e => updateField("prev3", Number(e.target.value))}
                          disabled={loading} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" /> Last Period Date
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" disabled={loading}
                            className={cn("w-full justify-start text-left font-normal",
                              !formData.last_period && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.last_period ? format(formData.last_period, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.last_period}
                            onSelect={d => updateField("last_period", d)}
                            disabled={d => d > new Date() || d < new Date("2020-01-01")}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Action Buttons ─────────────────── */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                    onClick={handleSubmit}
                    disabled={loading || !isFormValid()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Analyzing your cycle patterns using AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Predict My Cycle
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleReset} disabled={loading}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Reset
                  </Button>
                </div>

                {/* ── Disclaimer ─────────────────────── */}
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      This AI prediction is for educational purposes only and does not replace professional medical advice.
                      Please consult a doctor for health concerns.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* ── Results Section ─────────────────── */
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                {/* Status Card */}
                <Card className={cn(
                  "border-2 shadow-lg overflow-hidden",
                  isRegular ? "border-teal/50" : "border-destructive/50"
                )}>
                  <div className={cn(
                    "h-2",
                    isRegular ? "bg-gradient-to-r from-teal to-teal/60" : "bg-gradient-to-r from-destructive to-destructive/60"
                  )} />
                  <CardContent className="pt-8 pb-8 text-center space-y-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                        isRegular ? "bg-teal/15" : "bg-destructive/15"
                      )}
                    >
                      {isRegular ? (
                        <CheckCircle2 className="w-10 h-10 text-teal" />
                      ) : (
                        <AlertTriangle className="w-10 h-10 text-destructive" />
                      )}
                    </motion.div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Cycle Status</p>
                      <h2 className={cn(
                        "font-heading text-3xl font-bold",
                        isRegular ? "text-teal" : "text-destructive"
                      )}>
                        {result?.cycle_status}
                      </h2>
                      {result?.severity && (
                        <p className="text-sm text-destructive mt-1">Severity: {result.severity}</p>
                      )}
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4 inline-block">
                      <p className="text-sm text-muted-foreground mb-1">Next Period Date</p>
                      <p className="font-heading text-xl font-bold text-foreground">
                        {result?.next_period_date}
                      </p>
                    </div>

                    <p className={cn(
                      "text-sm max-w-md mx-auto",
                      isRegular ? "text-teal" : "text-destructive"
                    )}>
                      {isRegular
                        ? "Your menstrual cycle appears healthy. Maintain a balanced lifestyle."
                        : "Your cycle shows irregularity. Consider the recommendations below and consult a doctor if needed."}
                    </p>
                  </CardContent>
                </Card>

                {/* Recommendation Cards */}
                <h3 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" /> Health Recommendations
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Diet */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="border-border/50 h-full">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                            <Apple className="w-5 h-5 text-primary" />
                          </div>
                          Diet Plan
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Iron rich foods (spinach, dates)</li>
                          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Protein intake</li>
                          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Reduce sugar & processed food</li>
                          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Stay hydrated (2-3L water)</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Exercise */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <Card className="border-border/50 h-full">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
                            <Dumbbell className="w-5 h-5 text-accent" />
                          </div>
                          Exercise
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Walking 20-30 min daily</li>
                          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Yoga & Pranayama</li>
                          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Light stretching</li>
                          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Avoid intense workouts during period</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Lifestyle */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                    <Card className="border-border/50 h-full">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <div className="w-9 h-9 rounded-lg bg-teal/15 flex items-center justify-center">
                            <Leaf className="w-5 h-5 text-teal" />
                          </div>
                          Lifestyle
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2"><span className="text-teal mt-0.5">•</span> Sleep 7-8 hours daily</li>
                          <li className="flex items-start gap-2"><span className="text-teal mt-0.5">•</span> Reduce stress levels</li>
                          <li className="flex items-start gap-2"><span className="text-teal mt-0.5">•</span> Stay active throughout month</li>
                          <li className="flex items-start gap-2"><span className="text-teal mt-0.5">•</span> Track symptoms consistently</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" onClick={handleReset} className="flex-1">
                    <RotateCcw className="w-4 h-4 mr-2" /> Take Assessment Again
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/dashboard")} className="flex-1">
                    Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/doctors")} className="flex-1">
                    Find Specialist <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                {/* Disclaimer */}
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      This AI prediction is for educational purposes only and does not replace professional medical advice.
                      Please consult a doctor for health concerns.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MenstrualAssessment;
