// TODO: Restrict access to admins only in production
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { es } from "@/lib/i18n/es";

type TestStatus = "idle" | "running" | "success" | "error";

interface TestResult {
  id: string;
  name: string;
  status: TestStatus;
  message?: string;
}

const { debugPage } = es;

const initialTests: TestResult[] = [
  { id: "test-room", name: debugPage.tests.createRoom, status: "idle" },
  { id: "test-guest", name: debugPage.tests.createGuest, status: "idle" },
  { id: "test-reservation-valid", name: debugPage.tests.validReservation, status: "idle" },
  { id: "test-reservation-invalid", name: debugPage.tests.invalidReservation, status: "idle" },
];

const statusColors: Record<TestStatus, string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-blue-500 text-white",
  success: "bg-green-500 text-white",
  error: "bg-destructive text-destructive-foreground",
};

export default function DebugDbTest() {
  const [tests, setTests] = useState<TestResult[]>(initialTests);
  const [isRunning, setIsRunning] = useState(false);

  const updateTest = (id: string, updates: Partial<Omit<TestResult, "id" | "name">>) => {
    setTests((prev) =>
      prev.map((test) =>
        test.id === id ? { ...test, ...updates } : test
      )
    );
  };

  const runTestRoom = async (): Promise<boolean> => {
    updateTest("test-room", { status: "running" });

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        number: "TEST-101",
        type: "test",
        base_price: 1000,
        status: "available",
      })
      .select()
      .single();

    if (error) {
      updateTest("test-room", { status: "error", message: error.message });
      return false;
    }

    updateTest("test-room", {
      status: "success",
      message: debugPage.messages.roomCreated(data.id),
    });
    return true;
  };

  const runTestGuest = async (): Promise<boolean> => {
    updateTest("test-guest", { status: "running" });

    const { data, error } = await supabase
      .from("guests")
      .insert({
        name: "Invitado Prueba",
        phone: "9999-9999",
      })
      .select()
      .single();

    if (error) {
      updateTest("test-guest", { status: "error", message: error.message });
      return false;
    }

    updateTest("test-guest", {
      status: "success",
      message: debugPage.messages.guestCreated(data.id),
    });
    return true;
  };

  const runTestReservationValid = async (): Promise<boolean> => {
    updateTest("test-reservation-valid", { status: "running" });

    // Fetch room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id")
      .eq("number", "TEST-101")
      .maybeSingle();

    if (roomError || !room) {
      updateTest("test-reservation-valid", {
        status: "error",
        message: debugPage.messages.missingDependencies,
      });
      return false;
    }

    // Fetch guest
    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .select("id")
      .eq("name", "Invitado Prueba")
      .maybeSingle();

    if (guestError || !guest) {
      updateTest("test-reservation-valid", {
        status: "error",
        message: debugPage.messages.missingDependencies,
      });
      return false;
    }

    // Create reservation
    const { data, error } = await supabase
      .from("reservations")
      .insert({
        room_id: room.id,
        guest_id: guest.id,
        check_in_date: "2025-01-10",
        check_out_date: "2025-01-12",
        base_price: 1000,
        discount: 0,
        final_price: 1000,
      })
      .select()
      .single();

    if (error) {
      updateTest("test-reservation-valid", { status: "error", message: error.message });
      return false;
    }

    updateTest("test-reservation-valid", {
      status: "success",
      message: debugPage.messages.reservationCreated(data.id),
    });
    return true;
  };

  const runTestReservationInvalid = async (): Promise<boolean> => {
    updateTest("test-reservation-invalid", { status: "running" });

    // Fetch room
    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("number", "TEST-101")
      .maybeSingle();

    // Fetch guest
    const { data: guest } = await supabase
      .from("guests")
      .select("id")
      .eq("name", "Invitado Prueba")
      .maybeSingle();

    if (!room || !guest) {
      updateTest("test-reservation-invalid", {
        status: "error",
        message: debugPage.messages.missingDependencies,
      });
      return false;
    }

    // Try to create invalid reservation (dates reversed)
    const { error } = await supabase.from("reservations").insert({
      room_id: room.id,
      guest_id: guest.id,
      check_in_date: "2025-01-12",
      check_out_date: "2025-01-10", // Invalid: before check_in
      base_price: 1000,
      discount: 0,
      final_price: 1000,
    });

    if (!error) {
      updateTest("test-reservation-invalid", {
        status: "error",
        message: debugPage.messages.invalidDatesAllowed,
      });
      return false;
    }

    updateTest("test-reservation-invalid", {
      status: "success",
      message: debugPage.messages.constraintWorking(error.message),
    });
    return true;
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTests(initialTests);

    await runTestRoom();
    await runTestGuest();
    await runTestReservationValid();
    await runTestReservationInvalid();

    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            {debugPage.title}
          </h1>
          <Button onClick={runAllTests} disabled={isRunning}>
            {isRunning ? debugPage.running : debugPage.runAllTests}
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map((test) => (
            <Card key={test.id} className="border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-medium">
                    {test.name}
                  </CardTitle>
                  <Badge className={statusColors[test.status]}>
                    {debugPage.statusLabels[test.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="min-h-[3rem] rounded bg-muted/50 p-2 text-sm text-muted-foreground">
                  {test.message || debugPage.waitingToRun}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
