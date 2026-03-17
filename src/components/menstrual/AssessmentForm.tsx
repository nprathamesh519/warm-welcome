import { MenstrualFormData, computeLiveRisk } from "@/lib/menstrual-ml";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  User, Droplets, Heart, CalendarIcon, Check, ArrowRight, ArrowLeft, Loader2, AlertTriangle,
} from "lucide-react";

const STEPS = [
  { id: "personal", label: "Personal", icon: User },
  { id: "cycle", label: "Cycle", icon: Droplets },
  { id: "health", label: "Health", icon: Heart },
  { id: "history", label: "History", icon: CalendarIcon },
];

interface AssessmentFormProps {
  form: MenstrualFormData;
  setField: (key: keyof MenstrualFormData, value: MenstrualFormData[keyof MenstrualFormData]) => void;
  onSubmit: () => void;
  loading: boolean;
}

function ChipSelect({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-4 py-2 rounded-full border text-sm font-medium transition-all",
            value === o.value
              ? "bg-primary text-primary-foreground border-primary shadow-md"
              : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AssessmentForm({ form, setField, onSubmit, loading }: AssessmentFormProps) {
  const [step, setStep] = [0, 0]; // We'll use internal state
  return <AssessmentFormInner form={form} setField={setField} onSubmit={onSubmit} loading={loading} />;
}

function AssessmentFormInner({ form, setField, onSubmit, loading }: AssessmentFormProps) {
  const stepOK = [
    !!form.stress,
    !!form.flow && !!form.cramps && !!form.pimples,
    !!form.pcos && !!form.thyroid,
    !!form.last_period,
  ];

  const riskScore = computeLiveRisk(form);
  const riskPct = Math.min(100, riskScore * 7);
  const riskColor = riskScore < 3 ? "text-teal" : riskScore < 6 ? "text-accent" : "text-destructive";
  const riskNote = riskScore < 3 ? "Low risk — cycle likely regular"
    : riskScore < 6 ? "Moderate concern — possible irregularity"
    : "High concern — irregularity very likely";

  // Use local step state
  const [currentStep, setCurrentStep] = __React_useState(0);

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center max-w-md mx-auto">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all border-2",
                i < currentStep ? "bg-teal text-teal-foreground border-teal" :
                i === currentStep ? "bg-primary text-primary-foreground border-primary ring-4 ring-primary/15" :
                "bg-background border-border text-muted-foreground"
              )}>
                {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn("text-[10px] font-medium mt-1 uppercase tracking-wide",
                i === currentStep ? "text-primary" : "text-muted-foreground"
              )}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-0.5 mb-5 mx-1 transition-colors",
                i < currentStep ? "bg-teal" : "bg-border"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Live Risk Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Live Risk Score</span>
            <span className={`font-heading text-xl font-bold ${riskColor}`}>{riskScore}</span>
          </div>
          <Progress value={riskPct} className="h-1.5 mb-2" />
          <p className={`text-xs ${riskColor}`}>{riskNote}</p>
        </CardContent>
      </Card>

      {/* Step 0: Personal */}
      {currentStep === 0 && (
        <Card className="animate-fade-up">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">Personal Information</h3>
                <p className="text-xs text-muted-foreground">Your basic health profile</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wide">Age</Label>
                <div className="flex items-center gap-2">
                  <Slider min={13} max={55} step={1} value={[form.age]} onValueChange={([v]) => setField("age", v)} />
                  <span className="font-heading text-lg font-semibold text-primary w-12 text-right">{form.age}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wide">BMI</Label>
                <div className="flex items-center gap-2">
                  <Slider min={14} max={45} step={0.1} value={[form.bmi]} onValueChange={([v]) => setField("bmi", parseFloat(v.toFixed(1)))} />
                  <span className="font-heading text-lg font-semibold text-primary w-12 text-right">{form.bmi}</span>
                </div>
                {(form.bmi < 18.5 || form.bmi > 30) && (
                  <p className="text-[10px] text-accent flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> BMI outside healthy range (+2)</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wide">Sleep Hours</Label>
              <div className="flex items-center gap-2">
                <Slider min={3} max={12} step={0.5} value={[form.sleep]} onValueChange={([v]) => setField("sleep", v)} />
                <span className="font-heading text-lg font-semibold text-primary w-12 text-right">{form.sleep}h</span>
              </div>
              {form.sleep < 6 && <p className="text-[10px] text-accent flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Under 6h (+1)</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wide">Stress Level</Label>
              <ChipSelect
                options={[{ label: "Low", value: "Low" }, { label: "Medium", value: "Medium" }, { label: "High", value: "High" }]}
                value={form.stress}
                onChange={(v) => setField("stress", v)}
              />
            </div>

            <Button className="w-full" onClick={() => setCurrentStep(1)} disabled={!stepOK[0]}>
              Next: Cycle Details <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Cycle */}
      {currentStep === 1 && (
        <Card className="animate-fade-up">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Droplets className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">Menstrual Details</h3>
                <p className="text-xs text-muted-foreground">Your current cycle characteristics</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wide">Period Duration (days)</Label>
              <div className="flex items-center gap-2">
                <Slider min={1} max={15} step={1} value={[form.period_duration]} onValueChange={([v]) => setField("period_duration", v)} />
                <span className="font-heading text-lg font-semibold text-primary w-12 text-right">{form.period_duration}d</span>
              </div>
              {form.period_duration > 10 && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> &gt;10 days (+3)</p>}
              {form.period_duration > 7 && form.period_duration <= 10 && <p className="text-[10px] text-accent flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> 7–10 days (+2)</p>}
              {form.period_duration < 3 && <p className="text-[10px] text-accent flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> &lt;3 days (+2)</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wide">Flow Type</Label>
              <ChipSelect options={[{ label: "Light", value: "Light" }, { label: "Medium", value: "Medium" }, { label: "Heavy", value: "Heavy" }]} value={form.flow} onChange={(v) => setField("flow", v)} />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wide">Cramps Severity</Label>
              <ChipSelect options={[{ label: "Low", value: "Low" }, { label: "Medium", value: "Medium" }, { label: "High", value: "High" }]} value={form.cramps} onChange={(v) => setField("cramps", v)} />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wide">Pimples around period</Label>
              <ChipSelect options={[{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }]} value={form.pimples} onChange={(v) => setField("pimples", v)} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(0)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button className="flex-[2]" onClick={() => setCurrentStep(2)} disabled={!stepOK[1]}>
                Next: Health <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Health */}
      {currentStep === 2 && (
        <Card className="animate-fade-up">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">Health Conditions</h3>
                <p className="text-xs text-muted-foreground">Medical conditions that affect your cycle</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wide">PCOS (Polycystic Ovary Syndrome)</Label>
                <ChipSelect options={[{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }]} value={form.pcos} onChange={(v) => setField("pcos", v)} />
                {form.pcos === "Yes" && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> PCOS detected (+3)</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wide">Thyroid Disorder</Label>
                <ChipSelect options={[{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }]} value={form.thyroid} onChange={(v) => setField("thyroid", v)} />
                {form.thyroid === "Yes" && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Thyroid disorder (+2)</p>}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button className="flex-[2]" onClick={() => setCurrentStep(3)} disabled={!stepOK[2]}>
                Next: History <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: History */}
      {currentStep === 3 && (
        <Card className="animate-fade-up">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">Cycle History</h3>
                <p className="text-xs text-muted-foreground">Previous cycle lengths & last period date</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {([["prev1", "Cycle 1"], ["prev2", "Cycle 2"], ["prev3", "Cycle 3"]] as const).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wide">{label}</Label>
                  <Input
                    type="number"
                    min={18}
                    max={50}
                    value={form[key]}
                    onChange={(e) => setField(key, parseInt(e.target.value) || 28)}
                    className="text-center font-heading text-lg font-semibold text-primary"
                  />
                </div>
              ))}
            </div>

            {(() => {
              const v = Math.max(form.prev1, form.prev2, form.prev3) - Math.min(form.prev1, form.prev2, form.prev3);
              return v > 7 ? (
                <p className="text-[10px] text-accent flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> High variation ({v} days, +2)</p>
              ) : null;
            })()}

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wide">Last Period Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.last_period && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.last_period ? format(new Date(form.last_period + "T12:00:00"), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.last_period ? new Date(form.last_period + "T12:00:00") : undefined}
                    onSelect={(d) => d && setField("last_period", format(d, "yyyy-MM-dd"))}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                className="flex-[2] bg-gradient-to-r from-primary to-primary/80 shadow-lg"
                onClick={onSubmit}
                disabled={!stepOK[3] || loading}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</>
                ) : (
                  <>Predict My Cycle <ArrowRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Need useState import workaround
import { useState as __React_useState } from "react";
