import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExternalLink, MapPin, Calendar, Hotel, Plane, ArrowLeft, Download, Share2 } from 'lucide-react';
import { Separator } from './ui/separator';

export interface Itinerary {
  id: string;
  destination: string;
  duration: number;
  hotelStarRating: 4 | 5;
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

interface ItineraryOutputProps {
  itineraries: Itinerary[];
  onBack: () => void;
  formData: {
    availablePoints: string;
    tripType: 'international' | 'domestic' | '';
  };
}

export function ItineraryOutput({ itineraries, onBack, formData }: ItineraryOutputProps) {
  if (itineraries.length === 0) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>No Trips Found</CardTitle>
          <CardDescription>
            We couldn't find any trips matching your criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">
              Try adjusting your preferences or increasing your available points.
            </p>
            <Button onClick={onBack} variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Start Over
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Your Trip Options</h2>
          <p className="text-muted-foreground mt-1">
            Found {itineraries.length} trip{itineraries.length > 1 ? 's' : ''} within your budget
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button onClick={onBack} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            New Search
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center md:text-left">
              <div className="text-sm text-muted-foreground">Available Points</div>
              <div className="text-2xl font-bold">{parseInt(formData.availablePoints || '0').toLocaleString()}</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-sm text-muted-foreground">Trip Type</div>
              <div className="text-2xl font-bold capitalize">{formData.tripType}</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-sm text-muted-foreground">Options Found</div>
              <div className="text-2xl font-bold">{itineraries.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itinerary Cards */}
      <div className="grid gap-6">
        {itineraries.map((itinerary, index) => (
          <Card key={itinerary.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{itinerary.destination}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {itinerary.duration} days
                        </span>
                        <span className="flex items-center gap-1">
                          <Hotel className="w-4 h-4" />
                          {itinerary.hotelStarRating}-Star Hotel
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xl px-4 py-2">
                  {itinerary.totalPoints.toLocaleString()} pts
                </Badge>
              </div>
            </CardHeader>

            <Separator />

            <CardContent className="pt-6 space-y-6">
              {/* Flight & Hotel Details */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Flight Details */}
                {itinerary.flight && (
                  <Card className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Plane className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">Flight Details</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Airline</div>
                        <div className="font-semibold">{itinerary.flight.airline}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Dates</div>
                        <div className="font-medium">
                          {itinerary.flight.departure} → {itinerary.flight.return}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Points Required</div>
                        <div className="text-lg font-bold text-primary">
                          {itinerary.flight.pointsCost.toLocaleString()} points
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild className="w-full mt-4">
                        <a href={itinerary.flight.bookingLink} target="_blank" rel="noopener noreferrer">
                          Book Flight <ExternalLink className="ml-2 w-4 h-4" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Hotel Details */}
                <Card className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Hotel className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Hotel Details</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Hotel Name</div>
                      <div className="font-semibold">{itinerary.hotel.name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Brand</div>
                      <div className="font-medium">{itinerary.hotel.brand}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Points Required</div>
                      <div className="text-lg font-bold text-primary">
                        {itinerary.hotel.totalPoints.toLocaleString()} points
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ({itinerary.hotel.pointsPerNight.toLocaleString()} pts/night × {itinerary.duration} nights)
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild className="w-full mt-4">
                      <a href={itinerary.hotel.bookingLink} target="_blank" rel="noopener noreferrer">
                        Book Hotel <ExternalLink className="ml-2 w-4 h-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Highlights */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Trip Highlights</h3>
                <div className="flex flex-wrap gap-2">
                  {itinerary.highlights.map((highlight, idx) => (
                    <Badge key={idx} variant="outline" className="text-sm py-1.5 px-3">
                      {highlight}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Brief Itinerary */}
              {itinerary.briefItinerary && itinerary.briefItinerary.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Day-by-Day Itinerary</h3>
                  <div className="space-y-2">
                    {itinerary.briefItinerary.map((item, idx) => (
                      <div key={idx} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                          {idx + 1}
                        </div>
                        <div className="flex-1 text-sm">{item}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Points Summary */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Trip Cost</div>
                    <div className="text-2xl font-bold text-primary">
                      {itinerary.totalPoints.toLocaleString()} points
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Remaining Points</div>
                    <div className="text-xl font-semibold">
                      {(parseInt(formData.availablePoints || '0') - itinerary.totalPoints).toLocaleString()} points
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}




