import type { EscrowJob } from "./types";

const KEY = "stellar-service-escrow.jobs.v1";

export function readCachedJobs(): EscrowJob[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCachedJobs(jobs: EscrowJob[]) {
  localStorage.setItem(KEY, JSON.stringify(jobs));
}

export function upsertCachedJob(job: EscrowJob) {
  const jobs = readCachedJobs();
  const next = [job, ...jobs.filter((item) => item.id !== job.id)];
  writeCachedJobs(next);
  return next;
}

export function updateCachedJobStatus(id: number, status: EscrowJob["status"]) {
  const next = readCachedJobs().map((job) => (job.id === id ? { ...job, status } : job));
  writeCachedJobs(next);
  return next;
}
