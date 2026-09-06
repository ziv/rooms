import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Raw next-intl navigation APIs. App code imports from `@/i18n/navigation`, which adds the pending-navigation lock. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
