import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { CreditCard, Calendar, Plane, MapPin, Hotel, ChevronRight, ChevronLeft } from 'lucide-react';

export interface InputFormData {
  axisCard: string;
  availablePoints: string;
  travelMonth: string;
  cabinType: string;
  originCity: string;
  tripType: 'international' | 'domestic' | '';
  hotelBrand: string;
}

interface InputWizardProps {
  onComplete: (data: InputFormData) => void;
  initialData?: Partial<InputFormData>;
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

const generateTravelMonths = (): Array<{ label: string; value: string }> => {
  const months: Array<{ label: string; value: string }> = [];
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

const STEPS = [
  { id: 1, title: 'Card & Points', description: 'Select your card and available points' },
  { id: 2, title: 'Travel Details', description: 'Choose your travel preferences' },
  { id: 3, title: 'Preferences', description: 'Set your trip preferences' },
];

export function InputWizard({ onComplete, initialData }: InputWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<InputFormData>({
    axisCard: initialData?.axisCard || '',
    availablePoints: initialData?.availablePoints || '',
    travelMonth: initialData?.travelMonth || '',
    cabinType: initialData?.cabinType || '',
    originCity: initialData?.originCity || '',
    tripType: initialData?.tripType || '',
    hotelBrand: initialData?.hotelBrand || '',
  });

  const updateFormData = (field: keyof InputFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return formData.axisCard && formData.availablePoints;
      case 2:
        return formData.travelMonth && formData.cabinType && formData.originCity && formData.tripType;
      case 3:
        return true; // Hotel brand is optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-2xl">Plan Your Trip</CardTitle>
          <CardDescription>
            Let's gather some information to find the perfect itinerary for you
          </CardDescription>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Step {currentStep} of {STEPS.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between pt-4">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    currentStep >= step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                <div className="mt-2 text-center">
                  <div className={`text-xs font-medium ${
                    currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 ${
                  currentStep > step.id ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Card & Points */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="axis-card" className="text-base">
                  <CreditCard className="inline w-4 h-4 mr-2" />
                  Select Your Axis Bank Card
                </Label>
                <Select value={formData.axisCard} onValueChange={(val) => updateFormData('axisCard', val)}>
                  <SelectTrigger id="axis-card" className="h-12">
                    <SelectValue placeholder="Choose your credit card" />
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
                <Label htmlFor="points" className="text-base">
                  Available Edge Reward Points
                </Label>
                <Input
                  id="points"
                  type="number"
                  placeholder="e.g., 250000"
                  value={formData.availablePoints}
                  onChange={(e) => updateFormData('availablePoints', e.target.value)}
                  min="0"
                  className="h-12 text-lg"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the total points you have available for this trip
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Travel Details */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="travel-month" className="text-base">
                  <Calendar className="inline w-4 h-4 mr-2" />
                  Travel Month
                </Label>
                <Select value={formData.travelMonth} onValueChange={(val) => updateFormData('travelMonth', val)}>
                  <SelectTrigger id="travel-month" className="h-12">
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
                <Label htmlFor="cabin-type" className="text-base">
                  <Plane className="inline w-4 h-4 mr-2" />
                  Cabin Type
                </Label>
                <Select value={formData.cabinType} onValueChange={(val) => updateFormData('cabinType', val)}>
                  <SelectTrigger id="cabin-type" className="h-12">
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
                <Label htmlFor="origin" className="text-base">
                  <MapPin className="inline w-4 h-4 mr-2" />
                  Origin City
                </Label>
                <Select value={formData.originCity} onValueChange={(val) => updateFormData('originCity', val)}>
                  <SelectTrigger id="origin" className="h-12">
                    <SelectValue placeholder="Select origin city" />
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
                <Label htmlFor="trip-type" className="text-base">
                  Trip Type
                </Label>
                <Select 
                  value={formData.tripType} 
                  onValueChange={(val) => updateFormData('tripType', val as 'international' | 'domestic')}
                >
                  <SelectTrigger id="trip-type" className="h-12">
                    <SelectValue placeholder="Select trip type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="international">International</SelectItem>
                    <SelectItem value="domestic">Domestic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preferences */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <Label htmlFor="hotel-brand" className="text-base">
                <Hotel className="inline w-4 h-4 mr-2" />
                Preferred Hotel Brand (Optional)
              </Label>
              <Select value={formData.hotelBrand} onValueChange={(val) => updateFormData('hotelBrand', val)}>
                <SelectTrigger id="hotel-brand" className="h-12">
                  <SelectValue placeholder="No preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">No preference</SelectItem>
                  {HOTEL_BRANDS.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Leave as "No preference" to see all available options
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Review Your Selections</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card:</span>
                  <span className="font-medium">
                    {AXIS_BANK_CARDS.find(c => c.id === formData.axisCard)?.name || 'Not selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Points:</span>
                  <span className="font-medium">{formData.availablePoints || '0'} points</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trip Type:</span>
                  <span className="font-medium capitalize">{formData.tripType || 'Not selected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origin:</span>
                  <span className="font-medium">{formData.originCity || 'Not selected'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceedToNext()}
            className="gap-2"
          >
            {currentStep === STEPS.length ? 'Find Trips' : 'Next'}
            {currentStep < STEPS.length && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

