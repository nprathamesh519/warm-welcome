import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Loader2, Search, MapPin, Phone, Stethoscope, Navigation, 
  BadgeCheck, ExternalLink, AlertCircle 
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NominatimDoctor {
  name: string;
  lat: number;
  lon: number;
  address: string;
  distance?: number;
  placeId: string;
}

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

type DoctorSource = "nearby" | "admin";

const getInitials = (name: string) => {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const Doctors = () => {
  const [searchParams] = useSearchParams();
  const fromAssessment = searchParams.get("source") === "assessment";
  
  const [nearbyDoctors, setNearbyDoctors] = useState<NominatimDoctor[]>([]);
  const [adminDoctors, setAdminDoctors] = useState<SupabaseDoctor[]>([]);
  const [source, setSource] = useState<DoctorSource>("nearby");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState("10");
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const hasAutoTriggered = useRef(false);

  // Fetch admin doctors from Supabase as fallback
  const fetchAdminDoctors = useCallback(async () => {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setAdminDoctors(data as SupabaseDoctor[]);
    }
    setSource("admin");
    setLoading(false);
  }, []);

  // Search nearby doctors using Nominatim
  const searchNearbyDoctors = useCallback(async (lat: number, lng: number, radiusKm: number) => {
    setLoading(true);
    try {
      const delta = radiusKm / 111;
      const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=gynecologist+doctor+clinic+hospital&` +
        `format=json&` +
        `bounded=1&viewbox=${bbox}&` +
        `limit=30&` +
        `addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );

      if (!response.ok) throw new Error("Nominatim API error");

      const data = await response.json();

      if (!data || data.length === 0) {
        setFallbackMessage("No nearby doctors found. Showing verified specialists instead.");
        await fetchAdminDoctors();
        return;
      }

      const doctors: NominatimDoctor[] = data.map((item: any) => ({
        name: item.display_name.split(",")[0],
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        address: item.display_name,
        distance: haversineDistance(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
        placeId: item.place_id?.toString() || Math.random().toString(),
      }));

      doctors.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      const filtered = doctors.filter(d => (d.distance || 0) <= radiusKm);

      if (filtered.length === 0) {
        setFallbackMessage("No doctors found within the selected radius. Showing verified specialists instead.");
        await fetchAdminDoctors();
        return;
      }

      setNearbyDoctors(filtered);
      setSource("nearby");
      setFallbackMessage(null);
      setLoading(false);

      // Initialize map
      setTimeout(() => initMap(lat, lng, filtered), 100);
    } catch (error) {
      console.error("Nominatim search failed:", error);
      setFallbackMessage("Nearby doctors unavailable. Showing verified specialists instead.");
      await fetchAdminDoctors();
    }
  }, [fetchAdminDoctors]);

  // Detect user location
  const detectLocation = useCallback(() => {
    setDetectingLocation(true);
    if (!navigator.geolocation) {
      setFallbackMessage("Geolocation not supported. Showing verified specialists instead.");
      fetchAdminDoctors();
      setDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        setDetectingLocation(false);
        searchNearbyDoctors(loc.lat, loc.lng, parseInt(radius));
      },
      () => {
        setFallbackMessage("Location permission denied. Showing verified specialists instead.");
        fetchAdminDoctors();
        setDetectingLocation(false);
      },
      { timeout: 10000 }
    );
  }, [fetchAdminDoctors, searchNearbyDoctors, radius]);

  // Auto-trigger for assessment redirect
  useEffect(() => {
    if (fromAssessment && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      detectLocation();
    } else if (!fromAssessment) {
      fetchAdminDoctors();
    }
  }, [fromAssessment, detectLocation, fetchAdminDoctors]);

  // Re-search when radius changes
  useEffect(() => {
    if (userLocation) {
      searchNearbyDoctors(userLocation.lat, userLocation.lng, parseInt(radius));
    }
  }, [radius, userLocation, searchNearbyDoctors]);

  // Initialize Leaflet map
  const initMap = async (lat: number, lng: number, doctors: NominatimDoctor[]) => {
    if (!mapRef.current) return;
    
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current).setView([lat, lng], 13);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // User marker
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: "bg-primary rounded-full w-4 h-4 border-2 border-white shadow-lg",
        iconSize: [16, 16],
      }),
    }).addTo(map).bindPopup("Your Location");

    // Doctor markers
    doctors.forEach((doc) => {
      L.marker([doc.lat, doc.lon]).addTo(map).bindPopup(
        `<b>${doc.name}</b><br/>${doc.distance?.toFixed(1)} km away<br/><a href="https://www.openstreetmap.org/directions?from=${lat},${lng}&to=${doc.lat},${doc.lon}" target="_blank">Get Directions</a>`
      );
    });
  };

  // Filter doctors
  const filteredAdminDoctors = adminDoctors.filter(d =>
    !searchQuery || 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                placeholder="Search by name, specialization, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={radius} onValueChange={setRadius}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 km</SelectItem>
                <SelectItem value="10">10 km</SelectItem>
                <SelectItem value="20">20 km</SelectItem>
                <SelectItem value="50">50 km</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={detectLocation} disabled={detectingLocation} className="gap-2">
              {detectingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              Detect Location
            </Button>
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

          {/* Map (only for nearby doctors) */}
          {source === "nearby" && nearbyDoctors.length > 0 && (
            <div ref={mapRef} className="h-[350px] rounded-xl overflow-hidden mb-6 border border-border" />
          )}

          {/* Loading Skeleton */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card rounded-xl p-6 space-y-4">
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
          ) : source === "nearby" ? (
            /* Nearby Doctors Grid */
            nearbyDoctors.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <p className="text-muted-foreground">No nearby doctors found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nearbyDoctors.map((doctor) => (
                  <div key={doctor.placeId} className="glass-card rounded-xl p-6 hover:shadow-glow transition-all">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary font-bold text-lg">
                        {getInitials(doctor.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-heading font-semibold text-foreground truncate">{doctor.name}</h3>
                        <p className="text-sm text-teal">Gynecologist</p>
                        {doctor.distance && (
                          <p className="text-xs text-muted-foreground">{doctor.distance.toFixed(1)} km away</p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      {doctor.address}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => window.open(
                        `https://www.openstreetmap.org/directions?from=${userLocation?.lat},${userLocation?.lng}&to=${doctor.lat},${doctor.lon}`,
                        "_blank"
                      )}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Get Directions
                    </Button>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Admin Doctors Grid */
            filteredAdminDoctors.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <p className="text-muted-foreground">
                  {adminDoctors.length === 0 ? "No doctors available at the moment." : "No doctors match your search."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAdminDoctors.map((doctor) => (
                  <div key={doctor.id} className="glass-card rounded-xl p-6 hover:shadow-glow transition-all">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        {doctor.image_url ? (
                          <img src={doctor.image_url} alt={doctor.name} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          <span className="text-primary font-bold text-lg">{getInitials(doctor.name)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-heading font-semibold text-foreground truncate">{doctor.name}</h3>
                          {doctor.is_verified && <BadgeCheck className="w-4 h-4 text-teal flex-shrink-0" />}
                        </div>
                        {doctor.qualification && <p className="text-xs text-muted-foreground">{doctor.qualification}</p>}
                        <p className="text-sm text-accent">{doctor.specialization}</p>
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
                      {(doctor.address || doctor.location) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{doctor.address || doctor.location}{doctor.city ? `, ${doctor.city}` : ""}</span>
                        </div>
                      )}
                      {doctor.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                          <a href={`tel:${doctor.phone}`} className="hover:text-foreground">{doctor.phone}</a>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {doctor.latitude && doctor.longitude && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5"
                          onClick={() => window.open(
                            `https://www.openstreetmap.org/directions?to=${doctor.latitude},${doctor.longitude}`,
                            "_blank"
                          )}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Directions
                        </Button>
                      )}
                      {doctor.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5"
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
            )
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Doctors;
