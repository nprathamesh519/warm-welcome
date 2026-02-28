import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Search, MapPin, Phone, Stethoscope, Navigation,
  BadgeCheck, AlertCircle, ExternalLink
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SupabaseDoctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string | null;
  hospital: string | null;
  location: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  image_url: string | null;
  experience: string | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean | null;
}

const getInitials = (name: string) =>
  name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

const openGoogleMapsDirections = (doctor: SupabaseDoctor) => {
  const address = [doctor.address, doctor.city].filter(Boolean).join(", ");
  if (!address) {
    toast({ title: "Location not available", description: "This doctor's address is not available.", variant: "destructive" });
    return;
  }

  const encodedAddress = encodeURIComponent(address);

  // Try navigation mode with geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${encodedAddress}&travelmode=driving`;
        openMapUrl(url);
      },
      () => {
        // Location denied - fallback to search
        const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        openMapUrl(url);
      },
      { timeout: 5000 }
    );
  } else {
    // Geolocation not supported
    const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    openMapUrl(url);
  }

  toast({ title: "Opening directions", description: "Opening Google Maps…" });
};

const openMapUrl = (url: string) => {
  const newWindow = window.open(url, "_blank");
  if (!newWindow) {
    // Popup blocked - redirect current tab
    window.location.href = url;
  }
};

const hasValidAddress = (doctor: SupabaseDoctor) =>
  !!(doctor.address || doctor.city);

const Doctors = () => {
  const [searchParams] = useSearchParams();
  const fromAssessment = searchParams.get("source") === "assessment";

  const [doctors, setDoctors] = useState<SupabaseDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const hasAutoTriggered = useRef(false);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setDoctors(data as SupabaseDoctor[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Auto-trigger location search for assessment redirect
  useEffect(() => {
    if (fromAssessment && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      // Show a helpful message
      setFallbackMessage("Showing verified specialists for you.");
    }
  }, [fromAssessment]);

  // Get unique cities for filter
  const cities = [...new Set(doctors.map(d => d.city).filter(Boolean))] as string[];

  const filteredDoctors = doctors.filter(d => {
    const matchesSearch = !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.city?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = cityFilter === "all" || d.city === cityFilter;
    return matchesSearch && matchesCity;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-teal/20 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-teal" />
              </div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
                Find Doctors
              </h1>
            </div>
            <p className="text-muted-foreground">
              Connect with qualified gynecologists and women's health specialists
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, specialization, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {cities.length > 0 && (
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by city" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Fallback Alert */}
          {fallbackMessage && (
            <Alert className="mb-6 border-primary/30 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-muted-foreground">
                {fallbackMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Loading Skeleton */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card rounded-2xl p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-9 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {doctors.length === 0 ? "No doctors available at the moment." : "No doctors match your search."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDoctors.map((doctor) => (
                <div key={doctor.id} className="glass-card rounded-2xl p-6 hover:shadow-glow transition-all duration-300 group">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/20">
                      {doctor.image_url ? (
                        <img src={doctor.image_url} alt={doctor.name} className="w-16 h-16 rounded-full object-cover" />
                      ) : (
                        <span className="text-primary font-bold text-lg">{getInitials(doctor.name)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-heading font-semibold text-foreground truncate">{doctor.name}</h3>
                        {doctor.is_verified && (
                          <BadgeCheck className="w-4 h-4 text-teal flex-shrink-0" />
                        )}
                      </div>
                      {doctor.qualification && (
                        <p className="text-xs text-muted-foreground">{doctor.qualification}</p>
                      )}
                      <p className="text-sm text-accent font-medium">{doctor.specialization}</p>
                    </div>
                  </div>

                  {doctor.hospital && (
                    <p className="text-sm text-muted-foreground mb-1">🏥 {doctor.hospital}</p>
                  )}
                  {doctor.experience && (
                    <p className="text-xs text-muted-foreground mb-1">🩺 {doctor.experience} experience</p>
                  )}
                  {doctor.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{doctor.description}</p>
                  )}

                  <div className="space-y-1.5 text-sm mb-4">
                    {(doctor.address || doctor.city) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">
                          {doctor.address || ""}{doctor.city ? `${doctor.address ? ", " : ""}${doctor.city}` : ""}
                        </span>
                      </div>
                    )}
                    {doctor.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <a href={`tel:${doctor.phone}`} className="hover:text-foreground transition-colors">{doctor.phone}</a>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {hasValidAddress(doctor) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                        onClick={() => openGoogleMapsDirections(doctor)}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        📍 Get Directions
                      </Button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 opacity-50 cursor-not-allowed"
                            disabled
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            📍 Get Directions
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Location not available</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {doctor.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5 hover:bg-teal/10 hover:text-teal hover:border-teal/30 transition-all"
                        onClick={() => window.open(`tel:${doctor.phone}`)}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Doctors;
