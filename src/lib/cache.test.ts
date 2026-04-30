import { beforeEach, describe, expect, it } from "vitest";
import { readCachedJobs, updateCachedJobStatus, upsertCachedJob } from "./cache";

describe("job cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("upserts jobs by id", () => {
    upsertCachedJob({
      id: 1,
      title: "Audit",
      client: "GCLIENT",
      provider: "GPROVIDER",
      token: "CTOKEN",
      amount: "10000000",
      status: "Funded"
    });
    upsertCachedJob({
      id: 1,
      title: "Audit updated",
      client: "GCLIENT",
      provider: "GPROVIDER",
      token: "CTOKEN",
      amount: "20000000",
      status: "Funded"
    });

    expect(readCachedJobs()).toHaveLength(1);
    expect(readCachedJobs()[0].amount).toBe("20000000");
  });

  it("updates cached status after settlement", () => {
    upsertCachedJob({
      id: 2,
      title: "Design",
      client: "GCLIENT",
      provider: "GPROVIDER",
      token: "CTOKEN",
      amount: "10000000",
      status: "Funded"
    });

    expect(updateCachedJobStatus(2, "Released")[0].status).toBe("Released");
  });
});
