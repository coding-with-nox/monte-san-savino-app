import { SOCIAL_FIELDS, type SocialField } from "../../shared/domain/socialLinks";

/** Socials open after judging: the event has at least one class and every class is closed. */
export function socialsAvailable(categoryStatuses: string[]): boolean {
  return categoryStatuses.length > 0 && categoryStatuses.every((status) => status === "closed");
}

export type PublicSocials = Record<SocialField, string | null>;

export type PublicExhibitor = { name: string; country: string | null; socials: PublicSocials };

export type PublicDisplay = {
  displayNumber: number;
  categoryName: string;
  models: string[];
  optedIn: boolean;
  exhibitor?: PublicExhibitor;
};

/** Owner of the display: profile fields, publicProfile null when the user has no profile row. */
export type DisplayOwner = { firstName: string | null; lastName: string | null; country: string | null; publicProfile: boolean | null } & Record<SocialField, string | null>;

/**
 * Public view of a display. The exhibitor (name, country, socials) is included only when the owner
 * opted in (publicProfile === true); otherwise `optedIn` is false and no exhibitor key is returned.
 */
export function publicDisplayView(input: { displayNumber: number; categoryName: string; modelNames: string[]; owner: DisplayOwner | null }): PublicDisplay {
  const owner = input.owner;
  const optedIn = owner?.publicProfile === true;
  const view: PublicDisplay = {
    displayNumber: input.displayNumber,
    categoryName: input.categoryName,
    models: input.modelNames,
    optedIn
  };
  if (owner && optedIn) {
    const socials = Object.fromEntries(SOCIAL_FIELDS.map((field) => [field, owner[field] ?? null])) as PublicSocials;
    view.exhibitor = {
      name: [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim(),
      country: owner.country ?? null,
      socials
    };
  }
  return view;
}
