import type { Adapter } from "./index";
import { uneekor } from "./uneekor";

/** Order matters: the first adapter whose `detect` passes wins. */
export const ADAPTERS: Adapter[] = [uneekor];
