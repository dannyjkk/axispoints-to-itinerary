import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/ui/tabs";
import { ItineraryGenerator } from "./components/ItineraryGenerator";
import { PointsCalculator } from "./components/PointsCalculator";
import { Plane, Info } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "./components/ui/alert";

export default function App() {
  const [activeTab, setActiveTab] = useState("generate");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Plane className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Points Travel Planner
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Maximize your credit card points and plan your dream
            vacation
          </p>
        </div>

        {/* Info Alert */}
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>How it works</AlertTitle>
          <AlertDescription>
            We help you discover trips you can take with your
            points or calculate how many points you need for
            your dream destination. We don't process bookings
            directly - we'll provide links to airline and hotel
            sites where you can redeem your points.
          </AlertDescription>
        </Alert>

        {/* Main Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="generate">
              Generate Itineraries
            </TabsTrigger>
            <TabsTrigger value="calculate">
              Calculate Points (WIP)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4" forceMount>
            <ItineraryGenerator />
          </TabsContent>

          <TabsContent value="calculate" className="space-y-4" forceMount>
            <PointsCalculator />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            This tool provides estimates based on typical
            redemption values. Actual points required may vary
            based on availability, dates, and specific
            redemption options.
          </p>
          <p className="mt-2">
            Always verify point costs on the official airline
            and hotel websites before booking.
          </p>
        </div>
      </div>
    </div>
  );
}