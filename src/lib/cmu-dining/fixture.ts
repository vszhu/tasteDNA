import fixtureJson from "./last-good.json";
import { CmuDiningLastGoodFixtureSchema } from "./schema";

/** Sanitized, checked-in data used only when the upstream feed is unavailable. */
export const CMU_DINING_LAST_GOOD = CmuDiningLastGoodFixtureSchema.parse(fixtureJson);
