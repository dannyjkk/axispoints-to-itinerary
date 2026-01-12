import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { MapPin, Calendar, Plane, CreditCard } from 'lucide-react';
import { getApiBase } from '../lib/api';
import { DatePairsModal, DatePairCard } from './DatePairsModal';

interface Itinerary {
  id: string;
  destination: string | null;
  destinationName?: string | null;
  destinationAirport?: string | null; // IATA code for API calls
  hotelStarRating: 4 | 5;
  stops?: number | null;
  tripSummary?: string[];
  flight?: {
    airline: string;
    departure: string;
    return: string;
    pointsCost: number;
    bookingLink: string;
  };
  hotel: {
    name: string;
    brand: 'Marriott' | 'Accor';
    pointsPerNight: number;
    totalPoints: number;
    bookingLink: string;
  };
  totalPoints: number;
  highlights: string[];
  briefItinerary: string[];
}

const AXIS_BANK_CARDS = [
  { id: 'burgundy-private', name: 'Burgundy Private Credit Card' },
  { id: 'magnus-burgundy', name: 'Magnus for Burgundy Credit Card' },
  { id: 'magnus-standard', name: 'Magnus Credit Card (Standard)' },
  { id: 'reserve', name: 'Reserve Credit Card' },
  { id: 'select', name: 'Select Credit Card' },
  { id: 'privilege', name: 'Privilege Credit Card' },
  { id: 'privilege-easy', name: 'Privilege Easy Credit Card' },
  { id: 'rewards', name: 'Axis Bank Rewards Credit Card' },
  { id: 'indianoil-regular', name: 'Axis Bank IndianOil Credit Card (regular)' },
  { id: 'indianoil-easy', name: 'IndianOil Easy Credit Card' },
  { id: 'myzone', name: 'Axis Bank My Zone Credit Card' },
  { id: 'myzone-easy', name: 'Axis Bank My Zone Easy Credit Card' },
  { id: 'signature', name: 'Axis Bank Signature Credit Card' },
  { id: 'titanium-smart-traveller', name: 'Axis Bank Titanium Smart Traveller Credit Card' },
  { id: 'pride-platinum', name: 'Axis Bank Pride Platinum Credit Card' },
  { id: 'pride-signature', name: 'Axis Bank Pride Signature Credit Card' },
];

const ORIGIN_CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai'];

const CABIN_TYPES = ['Economy', 'Business'];

interface TravelMonth {
  label: string;
  value: string;
}

const generateTravelMonths = (): TravelMonth[] => {
  const months: TravelMonth[] = [];
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    months.push({ label: monthName, value });
  }
  return months;
};

const TRAVEL_MONTHS = generateTravelMonths();

function dedupeOptions(options: any[]) {
  const seen = new Map<string, any>();

  for (const opt of options) {
    const key = [opt.program, opt.origin, opt.destination, opt.cabin, opt.mileageCost].join('|');
    if (!seen.has(key)) {
      seen.set(key, opt);
    }
  }

  return Array.from(seen.values());
}

/**
 * Format a number in Indian numbering system (lakhs, crores)
 * e.g., 1000000 -> "10,00,000"
 */
function formatIndianNumber(value: string | number): string {
  const num = typeof value === 'string' ? value.replace(/,/g, '') : String(value);
  if (!num || isNaN(Number(num))) return '';
  
  const parts = num.split('.');
  let intPart = parts[0];
  
  // Indian format: first 3 digits from right, then groups of 2
  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    const formatted = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = formatted + ',' + lastThree;
  }
  
  return parts.length > 1 ? intPart + '.' + parts[1] : intPart;
}

/**
 * Parse Indian formatted number to raw number string
 */
function parseIndianNumber(value: string): string {
  return value.replace(/,/g, '');
}

export function ItineraryGenerator() {
  const [axisCard, setAxisCard] = useState('');
  const [availablePoints, setAvailablePoints] = useState(''); // Raw number without commas
  const [travelMonth, setTravelMonth] = useState('');
  const [cabinType, setCabinType] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [directOnly, setDirectOnly] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // Track if user has clicked search
  const [lastSearchedDestination, setLastSearchedDestination] = useState(''); // Store searched destination for message

  // Date pairs modal state
  const [datePairsModalOpen, setDatePairsModalOpen] = useState(false);
  const [datePairsLoading, setDatePairsLoading] = useState(false);
  const [datePairsCards, setDatePairsCards] = useState<DatePairCard[]>([]);
  const [datePairsError, setDatePairsError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('');

  const resetForm = () => {
    setAxisCard('');
    setAvailablePoints('');
    setTravelMonth('');
    setCabinType('');
    setOriginCity('');
    setDestinationCity('');
    setItineraries([]);
    setError(null);
    setDirectOnly(false);
    setHasSearched(false);
    setLastSearchedDestination('');
  };

  // Clear "no results" state when any input changes
  const clearSearchState = () => {
    setHasSearched(false);
    setItineraries([]);
    setError(null);
  };

  const generateItineraries = async () => {
    if (!axisCard || !availablePoints || !travelMonth || !cabinType || !originCity || !destinationCity) return;

    setLoading(true);
    setError(null);
    setItineraries([]);
    setLastSearchedDestination(destinationCity); // Store the destination being searched

    try {
      const payload = {
        edgePoints: Number(availablePoints),
        origin: originCity,
        destination: destinationCity,
        travelMonth,
        cabin: cabinType,
        cardDisplayName: AXIS_BANK_CARDS.find((c) => c.id === axisCard)?.name || axisCard,
        onlyDirect: directOnly,
      };

      const base = getApiBase();
      const resp = await fetch(`${base}/api/generate-itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Request failed');
      }

      const data = await resp.json();
      const options = Array.isArray(data?.options) ? data.options : [];

      const deduped = dedupeOptions(options);
      deduped.sort((a, b) => a.edgePointsRequired - b.edgePointsRequired);

      const mapped: Itinerary[] = deduped.map((o: any, idx: number) => ({
        id: String(idx + 1),
        destination: o.destinationName || o.destination || null,
        destinationName: o.destinationName || null,
        destinationAirport: o.destination || null, // Keep airport code for API calls
        hotelStarRating: 4,
        stops: typeof o.stops === 'number' ? o.stops : null,
        flight: {
          airline: o.program || 'Program',
          departure: data?.input?.start_date || '',
          return: data?.input?.end_date || '',
          pointsCost: o.mileageCost || 0,
          bookingLink: 'https://www.seats.aero/',
        },
        hotel: {
          name: 'N/A',
          brand: 'Accor',
          pointsPerNight: 0,
          totalPoints: 0,
          bookingLink: '#',
        },
        totalPoints: o.mileageCost || 0,
        highlights: [],
        briefItinerary:
          (Array.isArray(o.tripSummary) && o.tripSummary.length > 0
            ? o.tripSummary
            : Array.isArray(o.summary) && o.summary.length > 0
              ? o.summary
              : []),
      }));

      setItineraries(mapped);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setHasSearched(true); // Mark that search has been performed
    }
  };

  const handlePing = async () => {
    try {
      setPingStatus('Checking...');
      const base = getApiBase();
      const resp = await fetch(`${base}/api/ping`, { method: 'GET' });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || 'Ping failed');
      }
      setPingStatus(data?.message || 'ok');
    } catch (err: any) {
      setPingStatus(err?.message || 'Ping failed');
    }
  };

  /**
   * Open the date pairs modal and fetch exact dates & stays
   */
  const handleSeeExactDates = async (itinerary: Itinerary) => {
    // Use originCity from form state + destination airport code from the itinerary
    const origin = originCity; // form state
    const destAirport = itinerary.destinationAirport || itinerary.destination || '';
    const destDisplay = itinerary.destination || destAirport; // For modal display

    // Use the travel month from form state
    if (!travelMonth || !origin || !destAirport) {
      return;
    }

    // Convert originCity name to airport code
    const ORIGIN_CODE: Record<string, string> = {
      Delhi: 'DEL',
      Mumbai: 'BOM',
      Bengaluru: 'BLR',
      Hyderabad: 'HYD',
      Chennai: 'MAA',
    };
    const originAirport = ORIGIN_CODE[origin] || origin;

    // Parse month to get start/end dates
    const monthDate = new Date(travelMonth);
    const start = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
    const end = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    setSelectedOrigin(originAirport);
    setSelectedDestination(destDisplay); // Display city name in modal
    setDatePairsCards([]);
    setDatePairsError(null);
    setDatePairsLoading(true);
    setDatePairsModalOpen(true);

    try {
      const base = getApiBase();
      const params = new URLSearchParams({
        origin_airport: originAirport,
        destination_airport: destAirport, // Use airport code for API
        start_date: startDate,
        end_date: endDate,
        min_nights: '3',
        max_nights: '10',
        cabin_pref: cabinType?.toLowerCase() || 'economy',
      });

      const resp = await fetch(`${base}/api/seats/date-pairs?${params.toString()}`);
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data?.error || data?.message || 'Failed to fetch date pairs');
      }

      if (data?.message && (!data.cards || data.cards.length === 0)) {
        setDatePairsError(data.message);
        setDatePairsCards([]);
      } else {
        setDatePairsCards(data?.cards || []);
      }
    } catch (err: any) {
      setDatePairsError(err?.message || 'Failed to load date pairs');
    } finally {
      setDatePairsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Itineraries</CardTitle>
        <CardDescription className="flex flex-col gap-2">
          <span>Tell us your Axis Bank card and available points to find trips</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button variant="outline" size="sm" onClick={handlePing}>
              Ping API
            </Button>
            {pingStatus && <span>{pingStatus}</span>}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="axis-card">
              <CreditCard className="inline w-4 h-4 mr-1" />
              Axis Bank Card
            </Label>
            <Select value={axisCard} onValueChange={(v) => { setAxisCard(v); clearSearchState(); }}>
              <SelectTrigger id="axis-card">
                <SelectValue placeholder="Select card" />
              </SelectTrigger>
              <SelectContent>
                {AXIS_BANK_CARDS.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="points">Available Edge Reward Points</Label>
            <Input
              id="points"
              type="text"
              inputMode="numeric"
              placeholder="e.g., 2,50,000"
              value={formatIndianNumber(availablePoints)}
              onChange={(e) => {
                const raw = parseIndianNumber(e.target.value);
                // Only allow digits
                if (/^\d*$/.test(raw)) {
                  setAvailablePoints(raw);
                  clearSearchState();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="travel-month">
              <Calendar className="inline w-4 h-4 mr-1" />
              Travel Month
            </Label>
            <Select value={travelMonth} onValueChange={(v) => { setTravelMonth(v); clearSearchState(); }}>
              <SelectTrigger id="travel-month">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {TRAVEL_MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cabin-type">
              <Plane className="inline w-4 h-4 mr-1" />
              Cabin Type
            </Label>
            <Select value={cabinType} onValueChange={(v) => { setCabinType(v); clearSearchState(); }}>
              <SelectTrigger id="cabin-type">
                <SelectValue placeholder="Select cabin type" />
              </SelectTrigger>
              <SelectContent>
                {CABIN_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="origin">
              <MapPin className="inline w-4 h-4 mr-1" />
              Origin City
            </Label>
            <Select value={originCity} onValueChange={(v) => { setOriginCity(v); clearSearchState(); }}>
              <SelectTrigger id="origin">
                <SelectValue placeholder="Select origin" />
              </SelectTrigger>
              <SelectContent>
                {ORIGIN_CITIES.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">
              <MapPin className="inline w-4 h-4 mr-1" />
              Destination
            </Label>
            <Input
              id="destination"
              type="text"
              placeholder="e.g., Paris, France, Europe"
              value={destinationCity}
              onChange={(e) => { setDestinationCity(e.target.value); clearSearchState(); }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="direct-only">Direct flights only</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="direct-only"
                type="checkbox"
                checked={directOnly}
                onChange={(e) => { setDirectOnly(e.target.checked); clearSearchState(); }}
                className="h-4 w-4"
              />
              <span className="text-sm text-muted-foreground">
                Only show nonstop options (when available)
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={generateItineraries}
          className="w-full"
          type="button"
          disabled={!axisCard || !availablePoints || !travelMonth || !cabinType || !originCity || !destinationCity || loading}
        >
          {loading ? 'Searching...' : 'Find Available Trips'}
        </Button>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {itineraries.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-base sm:text-lg">
                Found {new Set(itineraries.map((i) => i.destinationAirport || i.destination)).size} destination{new Set(itineraries.map((i) => i.destinationAirport || i.destination)).size !== 1 ? 's' : ''}!
              </span>
              <Button variant="outline" size="sm" onClick={resetForm}>
                Try New Search
              </Button>
            </div>

            <div className="grid gap-4">
              {itineraries.map((itinerary) => (
                <Card key={itinerary.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      {itinerary.destination}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Plane className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium">
                          {itinerary.flight?.airline || 'Flight Available'}
                        </span>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleSeeExactDates(itinerary)}
                      >
                        See exact dates & stays
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : hasSearched && itineraries.length === 0 && !loading && !error ? (
          <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
            <p className="font-medium">No {lastSearchedDestination} trips found within your points budget.</p>
            <p className="text-sm mt-1">If you're searching for a specific city, try searching for the country or continent instead for more matches.</p>
          </div>
        ) : null}
      </CardContent>

      {/* Date Pairs Modal */}
      <DatePairsModal
        open={datePairsModalOpen}
        onOpenChange={setDatePairsModalOpen}
        origin={selectedOrigin}
        destination={selectedDestination}
        loading={datePairsLoading}
        cards={datePairsCards}
        error={datePairsError}
      />
    </Card>
  );
}
