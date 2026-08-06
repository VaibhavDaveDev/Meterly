import { describe, it, expect, vi, beforeEach } from "vitest";
import { recalculateChain } from "./recalculation";
import { testDb } from "../../test/setup";
import {
  billingPeriods,
  meterReadings,
  properties,
  user,
} from "../../db/schema";
import { eq } from "drizzle-orm";

vi.mock("./bill-generation", () => ({
  generateAndSaveBills: vi.fn().mockResolvedValue([]),
}));

describe("recalculateChain", () => {
  let propId: string;
  let bp1: string;
  let bp2: string;
  let bp3: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    await testDb.delete(meterReadings);
    await testDb.delete(billingPeriods);
    await testDb.delete(properties);
    await testDb.delete(user);

    await testDb.insert(user).values([
      {
        id: "owner-id",
        name: "Owner",
        email: "owner@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    propId = "prop-" + Math.random();
    await testDb.insert(properties).values({
      id: propId,
      name: "Test Prop",
      ownerId: "owner-id",
      hasSolar: true,
    });

    bp1 = "bp-1-" + Math.random();
    bp2 = "bp-2-" + Math.random();
    bp3 = "bp-3-" + Math.random();

    await testDb.insert(billingPeriods).values([
      {
        id: bp1,
        propertyId: propId,
        periodMonth: "2024-01",
        calculationMode: "solar",
        status: "submitted",
      },
      {
        id: bp2,
        propertyId: propId,
        periodMonth: "2024-02",
        calculationMode: "solar",
        status: "draft",
      },
      {
        id: bp3,
        propertyId: propId,
        periodMonth: "2024-03",
        calculationMode: "solar",
        status: "confirmed",
      },
    ]);

    await testDb.insert(meterReadings).values([
      {
        id: "mr1",
        billingPeriodId: bp1,
        solarGenerationStart: 0,
        solarGenerationEnd: 100,
        exportStart: 0,
        exportEnd: 50,
        importStart: 0,
        importEnd: 200,
        submittedBy: "owner-id",
      },
      {
        id: "mr2",
        billingPeriodId: bp2,
        solarGenerationStart: 100,
        solarGenerationEnd: 200,
        exportStart: 50,
        exportEnd: 100,
        importStart: 200,
        importEnd: 400,
        submittedBy: "owner-id",
      },
      {
        id: "mr3",
        billingPeriodId: bp3,
        solarGenerationStart: 200,
        solarGenerationEnd: 300,
        exportStart: 100,
        exportEnd: 150,
        importStart: 400,
        importEnd: 600,
        submittedBy: "owner-id",
      },
    ]);
  });

  it("cascades updates and aborts at confirmed period", async () => {
    // Modify period 1 reading directly to simulate an edit
    await testDb
      .update(meterReadings)
      .set({ solarGenerationEnd: 150 })
      .where(eq(meterReadings.id, "mr1"));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recalculateChain(testDb as any, bp1);

    // Period 2 should be updated because it's a cascade target (i > 0)
    const [mr2] = await testDb
      .select()
      .from(meterReadings)
      .where(eq(meterReadings.id, "mr2"));
    expect(mr2.solarGenerationStart).toBe(150); // updated from mr1.end

    // Period 3 is confirmed, so cascade should stop before it (meaning mr3 is untouched)
    const [mr3] = await testDb
      .select()
      .from(meterReadings)
      .where(eq(meterReadings.id, "mr3"));
    expect(mr3.solarGenerationStart).toBe(200); // untouched

    const { generateAndSaveBills } = await import("./bill-generation");

    // Period 1 and 2 should have been recalculated
    expect(generateAndSaveBills).toHaveBeenCalledTimes(2);

    // Check isRecalculation flag is true (the 8th arg)
    expect(generateAndSaveBills).toHaveBeenNthCalledWith(
      1,
      testDb,
      bp1,
      "solar",
      expect.any(Object),
      expect.any(Object),
      expect.any(Array),
      expect.any(Array),
      true
    );
    expect(generateAndSaveBills).toHaveBeenNthCalledWith(
      2,
      testDb,
      bp2,
      "solar",
      expect.any(Object),
      expect.any(Object),
      expect.any(Array),
      expect.any(Array),
      true
    );
  });

  it("surfaces JSON errors when parsing oneOffCharges", async () => {
    // Put bad JSON in period 1
    await testDb
      .update(billingPeriods)
      .set({ oneOffCharges: "{ bad_json" })
      .where(eq(billingPeriods.id, bp1));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(recalculateChain(testDb as any, bp1)).rejects.toThrow(
      /\[recalculation\] Malformed oneOffCharges JSON on period/
    );
  });

  it("deletes bills but skips start-value update when meter reading is missing", async () => {
    // Remove the reading for period 2 to simulate missing data
    await testDb
      .delete(meterReadings)
      .where(eq(meterReadings.billingPeriodId, bp2));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recalculateChain(testDb as any, bp1);

    const { generateAndSaveBills } = await import("./bill-generation");

    // Period 1 has a reading — it recalculates
    // Period 2 has NO reading — recalculateBillsForPeriod returns early (no bills generated)
    // generateAndSaveBills should only be called once (for period 1)
    expect(generateAndSaveBills).toHaveBeenCalledTimes(1);
    expect(generateAndSaveBills).toHaveBeenCalledWith(
      testDb,
      bp1,
      "solar",
      expect.any(Object),
      expect.any(Object),
      expect.any(Array),
      expect.any(Array),
      true
    );
  });
});
