import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMedicationAccountRepository } from "./account";

const OWNER = "f1000000-0000-4000-8000-000000000001";
const row = { user_id: OWNER, medications: ["simvastatin"], use_in_groups: true, revision: "f1000000-0000-4000-8000-000000000002", updated_at: "2026-09-12T12:00:00Z" };
function client(data: unknown = row, error: unknown = null) {
  const builder: Record<string, unknown> = {};
  for (const key of ["select", "eq", "upsert", "delete"]) builder[key] = vi.fn(() => builder);
  builder.maybeSingle = builder.single = vi.fn().mockResolvedValue({ data, error });
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve);
  return { builder, client: { from: vi.fn(() => builder) } as unknown as SupabaseClient };
}
describe("private medication account repository", () => {
  it("writes only the owner, canonical list, and explicit consent", async () => {
    const stub = client();
    await createMedicationAccountRepository(stub.client).save(OWNER, ["Zocor", "simvastatin"], true);
    expect(stub.client.from).toHaveBeenCalledWith("user_medication_profiles");
    expect(stub.builder.upsert).toHaveBeenCalledWith({ user_id: OWNER, medications: ["simvastatin"], use_in_groups: true }, { onConflict: "user_id" });
  });
  it("does not accept a returned list belonging to someone else", async () => {
    const stub = client({ ...row, user_id: row.revision });
    await expect(createMedicationAccountRepository(stub.client).load(OWNER)).rejects.toThrow(/unavailable/);
  });
  it("does not surface raw database errors or private values", async () => {
    const stub = client(null, { message: "private database detail" });
    await expect(createMedicationAccountRepository(stub.client).load(OWNER)).rejects.toThrow("Account medication saving is unavailable.");
  });
  it("scopes deletes to the current owner", async () => {
    const stub = client(null);
    await createMedicationAccountRepository(stub.client).remove(OWNER);
    expect(stub.builder.eq).toHaveBeenCalledWith("user_id", OWNER);
  });
});
