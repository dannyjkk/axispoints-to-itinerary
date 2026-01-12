import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExternalLink, MapPin, Calendar, Hotel, Plane, CreditCard, Info } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { getApiBase } from '../lib/api';

interface Itinerary {
  id: string;
  destination: string | null;
  destinationName?: string | null;
  duration: number;
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

export function ItineraryGenerator() {
  const [axisCard, setAxisCard] = useState('');
  const [availablePoints, setAvailablePoints] = useState('');
  const [travelMonth, setTravelMonth] = useState('');
  const [tripDuration, setTripDuration] = useState('');
  const [cabinType, setCabinType] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directOnly, setDirectOnly] = useState(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  const resetForm = () => {
    setAxisCard('');
    setAvailablePoints('');
    setTravelMonth('');
    setTripDuration('');
    setCabinType('');
    setOriginCity('');
    setDestinationCity('');
    setItineraries([]);
    setError(null);
    setDirectOnly(false);
  };

  const generateItineraries = async () => {
    if (!axisCard || !availablePoints || !travelMonth || !tripDuration || !cabinType || !originCity || !destinationCity) return;

    setLoading(true);
    setError(null);
    setItineraries([]);

    try {
      const payload = {
        edgePoints: Number(availablePoints),
        origin: originCity,
        destination: destinationCity,
        travelMonth,
        tripDuration,
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
        duration: 5,
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="axis-card">
              <CreditCard className="inline w-4 h-4 mr-1" />
              Axis Bank Card
            </Label>
            <Select value={axisCard} onValueChange={setAxisCard}>
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
              type="number"
              placeholder="e.g., 250000"
              value={availablePoints}
              onChange={(e) => setAvailablePoints(e.target.value)}
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="travel-month">
              <Calendar className="inline w-4 h-4 mr-1" />
              Travel Month
            </Label>
            <Select value={travelMonth} onValueChange={setTravelMonth}>
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
            <Label htmlFor="trip-duration">
              Trip Duration (days)
            </Label>
            <Input
              id="trip-duration"
              type="number"
              min="1"
              placeholder="e.g., 5"
              value={tripDuration}
              onChange={(e) => setTripDuration(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cabin-type">
              <Plane className="inline w-4 h-4 mr-1" />
              Cabin Type
            </Label>
            <Select value={cabinType} onValueChange={setCabinType}>
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
            <Select value={originCity} onValueChange={setOriginCity}>
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
              onChange={(e) => setDestinationCity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="direct-only">Direct flights only</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="direct-only"
                type="checkbox"
                checked={directOnly}
                onChange={(e) => setDirectOnly(e.target.checked)}
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
            <div className="flex items-center justify-between">
              <span className="text-lg">Found {itineraries.length} trip(s) within your points budget</span>
              <Button variant="outline" onClick={resetForm}>
                Try New Search
              </Button>
            </div>

            <div className="grid gap-4">
              {itineraries.map((itinerary) => (
                <Card key={itinerary.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="w-5 h-5" />
                          {itinerary.destination}
                        </CardTitle>
                        <CardDescription>
                          <Calendar className="inline w-3 h-3 mr-1" />
                          {itinerary.duration} days • {itinerary.hotelStarRating}-Star Hotel
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {itinerary.stops === 0 && (
                          <Badge variant="outline" className="text-xs font-semibold">
                            Nonstop
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-lg">
                          {itinerary.totalPoints.toLocaleString()} pts
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {itinerary.flight && (
                        <div className="space-y-2 p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <Plane className="w-4 h-4" />
                            <span>Flight</span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div>{itinerary.flight.airline}</div>
                            <div className="font-medium">
                              {itinerary.flight.pointsCost.toLocaleString()} points
                            </div>
                            <Button variant="outline" size="sm" asChild className="w-full mt-2">
                              <a href={itinerary.flight.bookingLink} target="_blank" rel="noopener noreferrer">
                                Book Flight <ExternalLink className="ml-1 w-3 h-3" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Hotel className="w-4 h-4" />
                          <span>Hotel ({itinerary.hotelStarRating}-Star)</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div>{itinerary.hotel.name}</div>
                          <div className="text-muted-foreground">{itinerary.hotel.brand}</div>
                          <div className="text-muted-foreground">
                            {itinerary.hotel.pointsPerNight.toLocaleString()} pts/night
                          </div>
                          <div className="font-medium">
                            {itinerary.hotel.totalPoints.toLocaleString()} points total
                          </div>
                          <Button variant="outline" size="sm" asChild className="w-full mt-2">
                            <a href={itinerary.hotel.bookingLink} target="_blank" rel="noopener noreferrer">
                              Book Hotel <ExternalLink className="ml-1 w-3 h-3" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {itinerary.briefItinerary && itinerary.briefItinerary.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Trip Summary:</div>
                        <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                          {itinerary.briefItinerary.map((item, idx) => (
                            <li key={idx} className="list-disc">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : availablePoints && axisCard && itineraries.length === 0 && destinationCity ? (
          <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
            No trips found within your points budget. Try adding more points or adjusting your preferences.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
