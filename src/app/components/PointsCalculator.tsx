import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExternalLink, MapPin, Calendar, Hotel, Plane, CreditCard, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface PointsNeeded {
  flights?: number;
  hotels: number;
  total: number;
  breakdown: {
    outboundFlight?: number;
    returnFlight?: number;
    nightlyRate: number;
    nights: number;
  };
  isDomestic: boolean;
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

const ORIGIN_CITIES = [
  'Delhi',
  'Mumbai',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
];

const HOTEL_BRANDS = ['Accor'];

const CABIN_TYPES = ['Economy', 'Business'];

// Generate forward-facing months for next 12 months
const generateTravelMonths = () => {
  const months = [];
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

// List of Indian cities for domestic detection
const INDIAN_CITIES = [
  'delhi', 'mumbai', 'bengaluru', 'bangalore', 'hyderabad', 'chennai',
  'kolkata', 'pune', 'ahmedabad', 'jaipur', 'surat', 'lucknow',
  'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam',
  'pimpri', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra',
  'nashik', 'faridabad', 'meerut', 'rajkot', 'goa', 'udaipur',
  'kerala', 'manali', 'shimla', 'darjeeling', 'ooty', 'pondicherry',
  'amritsar', 'varanasi', 'mysore', 'kochi', 'coimbatore'
];

export function PointsCalculator() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [travelMonth, setTravelMonth] = useState('');
  const [cabinType, setCabinType] = useState('');
  const [hotelBrand, setHotelBrand] = useState('');
  const [axisCard, setAxisCard] = useState('');
  const [result, setResult] = useState<PointsNeeded | null>(null);

  const resetForm = () => {
    setOrigin('');
    setDestination('');
    setTravelMonth('');
    setCabinType('');
    setHotelBrand('');
    setAxisCard('');
    setResult(null);
  };

  const isDomesticDestination = (dest: string): boolean => {
    const destLower = dest.toLowerCase();
    return INDIAN_CITIES.some(city => destLower.includes(city)) || destLower.includes('india');
  };

  const calculatePoints = () => {
    if (!origin || !destination || !travelMonth || !cabinType || !hotelBrand || !axisCard) return;

    const nights = parseInt(travelMonth);
    const isDomestic = isDomesticDestination(destination);
    
    // Base hotel points by brand
    const hotelMultiplier = {
      'Accor': 28000,
    }[hotelBrand] || 30000;

    // Destination multiplier for pricing
    const baseMultiplier = isDomestic ? 0.7 : 1.2;
    const nightlyRate = Math.round(hotelMultiplier * baseMultiplier);
    const hotels = nightlyRate * nights;

    if (isDomestic) {
      // Domestic: Only hotel points
      setResult({
        hotels,
        total: hotels,
        breakdown: {
          nightlyRate,
          nights,
        },
        isDomestic: true,
      });
    } else {
      // International: Hotel + Flight points
      const outboundFlight = Math.round(30000 * 1.0); // Base international flight
      const returnFlight = Math.round(30000 * 1.0);
      const flights = outboundFlight + returnFlight;
      const total = flights + hotels;

      setResult({
        flights,
        hotels,
        total,
        breakdown: {
          outboundFlight,
          returnFlight,
          nightlyRate,
          nights,
        },
        isDomestic: false,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculate Points Needed</CardTitle>
        <CardDescription>
          Enter your trip details to calculate required points
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="axis-card-calc">
              <CreditCard className="inline w-4 h-4 mr-1" />
              Axis Bank Card
            </Label>
            <Select value={axisCard} onValueChange={setAxisCard}>
              <SelectTrigger id="axis-card-calc">
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
            <Label htmlFor="origin">
              <MapPin className="inline w-4 h-4 mr-1" />
              Origin
            </Label>
            <Select value={origin} onValueChange={setOrigin}>
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
              placeholder="e.g., Paris, France"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="travel-month">
              <Calendar className="inline w-4 h-4 mr-1" />
              Travel Month
            </Label>
            <Select value={travelMonth} onValueChange={setTravelMonth}>
              <SelectTrigger id="travel-month">
                <SelectValue placeholder="Select travel month" />
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
            <Label htmlFor="hotel-brand">
              <Hotel className="inline w-4 h-4 mr-1" />
              Hotel Brand
            </Label>
            <Select value={hotelBrand} onValueChange={setHotelBrand}>
              <SelectTrigger id="hotel-brand">
                <SelectValue placeholder="Not required" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Not required</SelectItem>
                {HOTEL_BRANDS.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={calculatePoints} 
          className="w-full"
          type="button"
          disabled={!origin || !destination || !travelMonth || !cabinType || !hotelBrand || !axisCard}
        >
          Calculate Points Needed
        </Button>

        {result && (
          <div className="space-y-4">
            {result.isDomestic && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Domestic Destination Detected</AlertTitle>
                <AlertDescription>
                  This is a domestic trip. Flight points are not redeemable as of now. Only hotel points are calculated.
                </AlertDescription>
              </Alert>
            )}

            <div className="p-4 bg-muted rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg">Total Points Needed:</span>
                <div className="flex items-center gap-3">
                  <Badge className="text-lg px-3 py-1">
                    {result.total.toLocaleString()} points
                  </Badge>
                  <Button variant="outline" size="sm" onClick={resetForm}>
                    Try New Calculation
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {!result.isDomestic && result.flights && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Plane className="w-4 h-4" />
                      <span>Flight Points (International)</span>
                    </div>
                    <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                      <div>Outbound: {result.breakdown.outboundFlight?.toLocaleString()}</div>
                      <div>Return: {result.breakdown.returnFlight?.toLocaleString()}</div>
                      <div className="font-medium text-foreground">
                        Total: {result.flights.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Hotel className="w-4 h-4" />
                    <span>Hotel Points</span>
                  </div>
                  <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                    <div>Per night: {result.breakdown.nightlyRate.toLocaleString()}</div>
                    <div>Nights: {result.breakdown.nights}</div>
                    <div className="font-medium text-foreground">
                      Total: {result.hotels.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <div className="text-sm text-muted-foreground">
                  Ready to book? Visit these sites to redeem your points:
                </div>
                <div className="flex flex-wrap gap-2">
                  {!result.isDomestic && (
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://www.airindia.com" target="_blank" rel="noopener noreferrer">
                        Search Flights <ExternalLink className="ml-1 w-3 h-3" />
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <a 
                      href={hotelBrand === 'Accor' ? 'https://www.accor.com' : 'https://www.accor.com'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {hotelBrand} Hotels <ExternalLink className="ml-1 w-3 h-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}