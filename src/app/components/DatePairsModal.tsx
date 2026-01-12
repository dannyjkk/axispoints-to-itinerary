import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Plane, ArrowRight, Hotel, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { getApiBase } from '../lib/api';

// Types for date pair cards
export interface TripSummary {
  origin: string;
  destination: string;
  departsAt: string;
  arrivesAt: string;
  stops: number | null;
  carriers: string;
  flightNumbers: string;
  aircraft: string;
  cabin: string;
  remainingSeats: number | null;
  source: string;
  programName: string;
  mileageCost: number | null;
}

export interface DatePairCard {
  departDate: string;
  returnDate: string;
  nights: number;
  cabin: string;
  outboundTripSummary: TripSummary | null;
  returnTripSummary: TripSummary | null;
  totalPoints: number;
}

// Stub hotel data for MVP
interface HotelTile {
  id: string;
  name: string;
  rating: string;
  viewLink: string;
}

// Stub hotels fetch - replace with real API later (Amadeus/Accor)
async function fetchHotels(_destination: string, _checkIn: string, _checkOut: string): Promise<HotelTile[]> {
  // Simulated delay
  await new Promise((r) => setTimeout(r, 800));
  return [
    { id: '1', name: 'City Center Hotel', rating: '4.5★', viewLink: '#' },
    { id: '2', name: 'Business District Inn', rating: '4.2★', viewLink: '#' },
    { id: '3', name: 'Airport Express Stay', rating: '3.9★', viewLink: '#' },
  ];
}

interface DatePairsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: string;
  destination: string;
  loading: boolean;
  cards: DatePairCard[];
  error: string | null;
}

/**
 * Format ISO date string to a more readable format
 */
function formatDate(isoStr: string): string {
  if (!isoStr) return '';
  // Parse as UTC and display date portion only
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format ISO datetime to time in UTC
 */
function formatTimeUTC(isoStr: string): string {
  if (!isoStr) return '';
  // Extract just the time portion and show as UTC
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC';
}

/**
 * Format points with commas
 */
function formatPoints(points: number | null): string {
  if (points === null || points === 0) return '—';
  return points.toLocaleString() + ' pts';
}

/**
 * Flight summary line component
 */
function FlightLine({ trip, label }: { trip: TripSummary | null; label: string }) {
  if (!trip) {
    return (
      <div className="text-sm text-muted-foreground">
        {label}: No flight data available
      </div>
    );
  }

  const stopsText =
    trip.stops === 0
      ? 'Nonstop'
      : trip.stops === 1
        ? '1 stop'
        : trip.stops !== null
          ? `${trip.stops} stops`
          : '';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
        {trip.mileageCost !== null && trip.mileageCost > 0 && (
          <Badge variant="outline" className="text-xs font-semibold">
            {formatPoints(trip.mileageCost)}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">
          {trip.origin} <ArrowRight className="inline w-3 h-3" /> {trip.destination}
        </span>
      </div>
      <div className="text-xs text-muted-foreground space-x-2">
        <span>{formatTimeUTC(trip.departsAt)}</span>
        <span>→</span>
        <span>{formatTimeUTC(trip.arrivesAt)}</span>
        {stopsText && <span className="ml-1">• {stopsText}</span>}
      </div>
      <div className="text-xs text-muted-foreground">
        {trip.flightNumbers && <span>{trip.flightNumbers}</span>}
        {trip.carriers && <span className="ml-1">({trip.carriers})</span>}
        {trip.aircraft && <span className="ml-2">• {trip.aircraft}</span>}
      </div>
      {/* Program name */}
      {trip.programName && (
        <div className="text-xs font-medium text-primary">
          via {trip.programName}
        </div>
      )}
      {trip.remainingSeats !== null && trip.remainingSeats > 0 && (
        <div className="text-xs text-orange-600">
          {trip.remainingSeats} seat{trip.remainingSeats > 1 ? 's' : ''} left
        </div>
      )}
    </div>
  );
}

interface DatePairCardViewProps {
  card: DatePairCard;
  destination: string;
  tripSummary: string[] | null;
  tripSummaryLoading: boolean;
}

/**
 * Single date pair card component
 */
function DatePairCardView({ card, destination, tripSummary, tripSummaryLoading }: DatePairCardViewProps) {
  const [hotels, setHotels] = React.useState<HotelTile[]>([]);
  const [hotelsLoading, setHotelsLoading] = React.useState(true);

  React.useEffect(() => {
    setHotelsLoading(true);
    fetchHotels(destination, card.departDate, card.returnDate)
      .then(setHotels)
      .finally(() => setHotelsLoading(false));
  }, [card.departDate, card.returnDate, destination]);

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-primary" />
          <span className="font-semibold">
            {formatDate(card.departDate)} → {formatDate(card.returnDate)}
          </span>
          <span className="text-sm text-muted-foreground">
            ({card.nights} night{card.nights !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={card.cabin === 'business' ? 'default' : 'secondary'}>
            {card.cabin === 'business' ? 'Business' : 'Economy'}
          </Badge>
          {card.totalPoints > 0 && (
            <Badge variant="default" className="bg-primary">
              Total: {card.totalPoints.toLocaleString()} pts
            </Badge>
          )}
        </div>
      </div>

      {/* Flight details */}
      <div className="grid gap-3 md:grid-cols-2">
        <FlightLine trip={card.outboundTripSummary} label="Outbound" />
        <FlightLine trip={card.returnTripSummary} label="Return" />
      </div>

      {/* Hotel tiles placeholder */}
      <div className="border-t pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Hotel className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Hotels (Placeholder - WIP)</span>
        </div>
        <div className="grid gap-2 grid-cols-3">
          {hotelsLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : (
            hotels.map((hotel) => (
              <div
                key={hotel.id}
                className="border rounded p-2 text-xs space-y-1 bg-muted/30"
              >
                <div className="font-medium truncate">{hotel.name}</div>
                <div className="text-muted-foreground">{hotel.rating}</div>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" asChild>
                  <a href={hotel.viewLink} target="_blank" rel="noopener noreferrer">
                    View <ExternalLink className="ml-1 w-3 h-3" />
                  </a>
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Trip Summary */}
      <div className="border-t pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {card.nights}-Night Trip Itinerary
          </span>
        </div>
        {tripSummaryLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-3/6" />
          </div>
        ) : tripSummary && tripSummary.length > 0 ? (
          <ul className="text-sm text-muted-foreground space-y-1 pl-4">
            {tripSummary.map((item, idx) => (
              <li key={idx} className="list-disc">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Explore the destination at your own pace.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for cards
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="border-t pt-3 mt-3">
            <Skeleton className="h-4 w-20 mb-2" />
            <div className="grid gap-2 grid-cols-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DatePairsModal({
  open,
  onOpenChange,
  origin,
  destination,
  loading,
  cards,
  error,
}: DatePairsModalProps) {
  // Trip summaries by duration (nights): Map<nights, string[]>
  // Keyed by nights only since we reset when destination changes
  const [tripSummaries, setTripSummaries] = React.useState<Map<number, string[]>>(new Map());
  const [summariesLoading, setSummariesLoading] = React.useState<Set<number>>(new Set());
  const [currentDestination, setCurrentDestination] = React.useState<string>('');

  // Reset summaries when destination changes (fixes wrong itinerary bug)
  React.useEffect(() => {
    if (destination && destination !== currentDestination) {
      setTripSummaries(new Map());
      setSummariesLoading(new Set());
      setCurrentDestination(destination);
    }
  }, [destination, currentDestination]);

  // Fetch trip summaries for unique durations when cards change
  React.useEffect(() => {
    if (!cards || cards.length === 0 || !destination) return;

    // Get unique durations
    const uniqueNights = [...new Set(cards.map((c) => c.nights))];
    
    // Filter out durations we already have
    const needToFetch = uniqueNights.filter((n) => !tripSummaries.has(n));
    
    if (needToFetch.length === 0) return;

    // Mark as loading
    setSummariesLoading((prev) => {
      const next = new Set(prev);
      needToFetch.forEach((n) => next.add(n));
      return next;
    });

    // Fetch each unique duration (deduplicated API calls)
    const fetchSummaries = async () => {
      const base = getApiBase();
      
      await Promise.all(
        needToFetch.map(async (nights) => {
          try {
            const params = new URLSearchParams({
              destination,
              nights: String(nights),
            });
            const resp = await fetch(`${base}/api/trip-summary?${params.toString()}`);
            const data = await resp.json();
            
            if (resp.ok && data?.summary) {
              setTripSummaries((prev) => {
                const next = new Map(prev);
                next.set(nights, data.summary);
                return next;
              });
            }
          } catch (err) {
            console.error(`Failed to fetch trip summary for ${nights} nights:`, err);
          } finally {
            setSummariesLoading((prev) => {
              const next = new Set(prev);
              next.delete(nights);
              return next;
            });
          }
        })
      );
    };

    fetchSummaries();
  }, [cards, destination, tripSummaries]);

  // Reset summaries when modal closes
  React.useEffect(() => {
    if (!open) {
      setTripSummaries(new Map());
      setSummariesLoading(new Set());
      setCurrentDestination('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="w-5 h-5" />
            Exact Dates & Stays
          </DialogTitle>
          <DialogDescription>
            {origin} → {destination} • 3–10 nights
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {loading && <LoadingSkeleton />}

          {!loading && error && (
            <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {!loading && !error && cards.length === 0 && (
            <div className="p-4 rounded-md bg-muted text-center text-muted-foreground">
              No date pairs found for 3–10 nights in this month.
            </div>
          )}

          {!loading &&
            !error &&
            cards.map((card, idx) => (
              <DatePairCardView
                key={idx}
                card={card}
                destination={destination}
                tripSummary={tripSummaries.get(card.nights) || null}
                tripSummaryLoading={summariesLoading.has(card.nights)}
              />
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

