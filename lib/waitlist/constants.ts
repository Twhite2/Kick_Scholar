// Shared by the waitlist form (client) and lib/waitlist/core.ts (server).
// No Node imports here, so the client bundle can use it.

export const WAITLIST_DEGREES = ["BACHELOR", "MASTER", "PHD"] as const;
export const MAX_WAITLIST_COUNTRIES = 3;
