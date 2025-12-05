// TODO: Restrict access to admins only in production
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type TestStatus = "idle" | "running" | "success" | "error";

interface TestState {
  status: TestStatus;
  message?: string;
}

interface TestResults {
  test1: TestState;
  test2: TestState;
  test3: TestState;
  test4: TestState;
}

const initialState: TestResults = {
  test1: { status: "idle" },
  test2: { status: "idle" },
  test3: { status: "idle" },
  test4: { status: "idle" },
};

const statusColors: Record<TestStatus, string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-blue-500 text-white",
  success: "bg-green-500 text-white",
  error: "bg-destructive text-destructive-foreground",
};

export default function DebugDbTest() {
  const [results, setResults] = useState<TestResults>(initialState);
  const [isRunning, setIsRunning] = useState(false);

  const updateTest = (
    key: keyof TestResults,
    state: TestState
  ) => {
    setResults((prev) => ({ ...prev, [key]: state }));
  };

  const runTest1 = async (): Promise<boolean> => {
    updateTest("test1", { status: "running" });
    
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
      updateTest("test1", { status: "error", message: error.message });
      return false;
    }
    
    updateTest("test1", {
      status: "success",
      message: `Room created with ID: ${data.id}`,
    });
    return true;
  };

  const runTest2 = async (): Promise<boolean> => {
    updateTest("test2", { status: "running" });

    const { data, error } = await supabase
      .from("guests")
      .insert({
        name: "Invitado Prueba",
        phone: "9999-9999",
      })
      .select()
      .single();

    if (error) {
      updateTest("test2", { status: "error", message: error.message });
      return false;
    }

    updateTest("test2", {
      status: "success",
      message: `Guest created with ID: ${data.id}`,
    });
    return true;
  };

  const runTest3 = async (): Promise<boolean> => {
    updateTest("test3", { status: "running" });

    // Fetch room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id")
      .eq("number", "TEST-101")
      .maybeSingle();

    if (roomError || !room) {
      updateTest("test3", {
        status: "error",
        message: "Run Test 1 and 2 first. Room TEST-101 not found.",
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
      updateTest("test3", {
        status: "error",
        message: "Run Test 1 and 2 first. Guest 'Invitado Prueba' not found.",
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
      updateTest("test3", { status: "error", message: error.message });
      return false;
    }

    updateTest("test3", {
      status: "success",
      message: `Reservation created with ID: ${data.id}`,
    });
    return true;
  };

  const runTest4 = async (): Promise<boolean> => {
    updateTest("test4", { status: "running" });

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
      updateTest("test4", {
        status: "error",
        message: "Run Test 1 and 2 first.",
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
      updateTest("test4", {
        status: "error",
        message:
          "Expected error for invalid dates but insert was allowed. Check DB constraint.",
      });
      return false;
    }

    updateTest("test4", {
      status: "success",
      message: `Constraint working! Error: ${error.message}`,
    });
    return true;
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults(initialState);

    await runTest1();
    await runTest2();
    await runTest3();
    await runTest4();

    setIsRunning(false);
  };

  const tests = [
    { key: "test1" as const, name: "Test 1 – Create test room" },
    { key: "test2" as const, name: "Test 2 – Create test guest" },
    { key: "test3" as const, name: "Test 3 – Create valid reservation" },
    { key: "test4" as const, name: "Test 4 – Invalid reservation must fail" },
  ];

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            Debug DB – Hotel Smoke Tests
          </h1>
          <Button onClick={runAllTests} disabled={isRunning}>
            {isRunning ? "Running..." : "Run all tests"}
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map(({ key, name }) => {
            const { status, message } = results[key];
            return (
              <Card key={key} className="border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium">
                      {name}
                    </CardTitle>
                    <Badge className={statusColors[status]}>
                      {status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="min-h-[3rem] rounded bg-muted/50 p-2 text-sm text-muted-foreground">
                    {message || "Waiting to run..."}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
