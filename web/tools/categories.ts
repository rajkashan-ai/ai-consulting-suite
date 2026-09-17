/**
 * What kind of business this is, chosen from a list rather than typed.
 *
 * WHY A LIST
 * The trade was one word read off their website, so "barber", "barbershop" and
 * "barbers" were three different trades with three separate playbooks, each
 * learning the same thing at the same cost and none of them ever reaching the
 * three towns it takes to be trusted. A fixed list means every barber in the
 * country shares one playbook, and the second one is cheap.
 *
 * It also decides where we look. A barber is on Booksy, a plumber is on
 * Checkatrade, a landscaper publishes almost nothing anywhere. Same tool,
 * different places, and the id is what tells them apart.
 *
 * THE LIST IS DELIBERATELY UK AND DELIBERATELY SMALL BUSINESS
 * Somebody with one to twenty people. Not a category scheme for the economy.
 * "Something else" exists because no list is complete and a customer who cannot
 * find themselves will type nonsense into the nearest box instead.
 */

export type Category = {
  /** Lower case with hyphens. The playbook key, so it must never change. */
  id: string;
  /** As it appears in the dropdown. */
  label: string;
  /** Other words for the same thing, used when reading their website. */
  also: string[];
};

export type Group = { group: string; categories: Category[] };

export const CATEGORIES: Group[] = [
  {
    group: "Hair, beauty and wellbeing",
    categories: [
      { id: "barber", label: "Barber", also: ["barbershop", "barbers", "barbering", "gents hairdresser"] },
      { id: "hairdresser", label: "Hairdresser or salon", also: ["hair salon", "stylist"] },
      { id: "beauty-salon", label: "Beauty salon", also: ["beautician", "aesthetics"] },
      { id: "nail-salon", label: "Nail salon", also: ["nail bar", "manicurist"] },
      { id: "tattoo-studio", label: "Tattoo or piercing studio", also: ["tattooist"] },
      { id: "massage-spa", label: "Massage or spa", also: ["day spa", "masseuse"] },
    ],
  },
  {
    group: "Building and trades",
    categories: [
      { id: "plumber", label: "Plumber", also: ["plumbing", "heating engineer", "gas engineer"] },
      { id: "electrician", label: "Electrician", also: ["electrical contractor"] },
      { id: "builder", label: "Builder", also: ["building contractor", "construction"] },
      { id: "roofer", label: "Roofer", also: ["roofing"] },
      { id: "carpenter", label: "Carpenter or joiner", also: ["joinery", "kitchen fitter"] },
      { id: "painter-decorator", label: "Painter and decorator", also: ["decorator"] },
      { id: "plasterer", label: "Plasterer", also: ["plastering", "rendering"] },
      { id: "tiler", label: "Tiler or flooring", also: ["flooring", "carpet fitter"] },
      { id: "locksmith", label: "Locksmith", also: [] },
      { id: "window-doors", label: "Windows and doors", also: ["glazier", "double glazing"] },
    ],
  },
  {
    group: "Home and garden services",
    categories: [
      { id: "landscaper", label: "Landscaper or gardener", also: ["garden design", "grounds maintenance"] },
      { id: "tree-surgeon", label: "Tree surgeon", also: ["arborist"] },
      { id: "cleaner", label: "Cleaning company", also: ["domestic cleaning", "commercial cleaning"] },
      { id: "pest-control", label: "Pest control", also: [] },
      { id: "removals", label: "Removals or man with a van", also: ["moving company"] },
      { id: "handyman", label: "Handyman", also: ["property maintenance", "odd jobs"] },
    ],
  },
  {
    group: "Motoring",
    categories: [
      { id: "garage", label: "Garage or mechanic", also: ["MOT centre", "car repair", "servicing"] },
      { id: "car-valet", label: "Car valeting or detailing", also: ["car wash"] },
      { id: "car-sales", label: "Car sales", also: ["used cars", "dealership"] },
      { id: "driving-instructor", label: "Driving instructor", also: ["driving school"] },
    ],
  },
  {
    group: "Food and drink",
    categories: [
      { id: "cafe", label: "Cafe or coffee shop", also: ["coffee house", "tea room"] },
      { id: "restaurant", label: "Restaurant", also: ["bistro", "eatery"] },
      { id: "takeaway", label: "Takeaway", also: ["fish and chips", "pizza", "kebab", "curry house"] },
      { id: "pub-bar", label: "Pub or bar", also: ["public house", "wine bar"] },
      { id: "bakery", label: "Bakery or patisserie", also: ["cake maker"] },
      { id: "caterer", label: "Caterer", also: ["event catering", "food truck"] },
    ],
  },
  {
    group: "Health and fitness",
    categories: [
      { id: "dentist", label: "Dentist", also: ["dental practice", "orthodontist"] },
      { id: "physio", label: "Physiotherapist", also: ["physiotherapy", "sports therapy"] },
      { id: "chiropractor", label: "Chiropractor or osteopath", also: ["osteopathy"] },
      { id: "optician", label: "Optician", also: ["optometrist", "eye care"] },
      { id: "vet", label: "Vet", also: ["veterinary practice"] },
      { id: "gym", label: "Gym or fitness studio", also: ["health club", "yoga studio", "pilates"] },
      { id: "personal-trainer", label: "Personal trainer", also: ["fitness coach"] },
      { id: "therapist", label: "Counsellor or therapist", also: ["psychotherapist", "counselling"] },
    ],
  },
  {
    group: "Professional services",
    categories: [
      { id: "accountant", label: "Accountant or bookkeeper", also: ["accountancy", "tax adviser"] },
      { id: "solicitor", label: "Solicitor or law firm", also: ["legal services", "conveyancer"] },
      { id: "estate-agent", label: "Estate or letting agent", also: ["lettings", "property management"] },
      { id: "mortgage-broker", label: "Mortgage or insurance broker", also: ["financial adviser", "IFA"] },
      { id: "it-support", label: "IT support or managed services", also: ["computer repair", "MSP"] },
      { id: "marketing-agency", label: "Marketing or design agency", also: ["branding", "web design", "SEO"] },
      { id: "architect", label: "Architect or surveyor", also: ["architectural", "building surveyor"] },
      { id: "recruiter", label: "Recruitment agency", also: ["staffing", "employment agency"] },
      { id: "consultant", label: "Consultant or coach", also: ["business coach", "management consultant"] },
    ],
  },
  {
    group: "Other",
    categories: [
      { id: "photographer", label: "Photographer or videographer", also: ["wedding photography"] },
      { id: "florist", label: "Florist", also: ["flower shop"] },
      { id: "pet-groomer", label: "Dog groomer or pet services", also: ["dog walker", "pet sitting", "kennels"] },
      { id: "childcare", label: "Nursery or childcare", also: ["childminder", "pre-school"] },
      { id: "tutor", label: "Tutor or training provider", also: ["tuition", "driving theory", "music teacher"] },
      { id: "events", label: "Events, venue or entertainment", also: ["DJ", "wedding venue", "party hire"] },
      { id: "shop", label: "Shop or retail", also: ["store", "boutique", "convenience"] },
      { id: "other", label: "Something else", also: [] },
    ],
  },
];

export const ALL: Category[] = CATEGORIES.flatMap((g) => g.categories);

export const byId = (id: string | null | undefined): Category | null =>
  ALL.find((c) => c.id === id) ?? null;

export const labelFor = (id: string | null | undefined): string =>
  byId(id)?.label ?? "Not set";

/**
 * Best match for a word read off a website, or null.
 *
 * Null rather than "other", because "we could not tell" and "it is genuinely
 * something else" are different answers and only the customer can settle which.
 * Guessing "other" would quietly put every unrecognised business into one
 * playbook that could never be useful to any of them.
 */
export function matchTrade(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const said = raw.toLowerCase().trim();
  if (!said) return null;

  const exact = ALL.find((c) => c.id === said || c.label.toLowerCase() === said);
  if (exact) return exact.id;

  for (const c of ALL) {
    if (c.id === "other") continue;
    // Lowercase both sides. "MOT centre" and "SEO" are written in the list the
    // way a person writes them, and comparing them against a lowercased input
    // matched neither, so a garage and an agency both came back unrecognised.
    if (c.also.some((a) => {
      const alt = a.toLowerCase();
      return said === alt || said.includes(alt);
    })) return c.id;
    /**
     * The label's first word: "Barber" out of "Barber", "Plumber" out of
     * "Plumber". Whole word, so "car sales" does not match "carpenter".
     *
     * The `ing` matters and cost a whole report. This was `\bbarbers?\b`, which
     * does not match "Barbering": the boundary after "barber" fails against the
     * "i". So on 2026-09-17 "Alternative Barbering", "Distinct Barbering" and
     * "Mebstar Barbering Salon" all came back as trade unknown, were kept for a
     * hairdresser, and A Cut Above, a women's salon whose twelve published
     * prices are all ladies cuts from 35 to 78 pounds, was told its problem was
     * not publishing a men's cut price.
     */
    const first = c.label.toLowerCase().split(/[ ,]/)[0];
    if (first.length > 3 && new RegExp(`\\b${first}(s|ing)?\\b`).test(said)) return c.id;
  }
  return null;
}

/** The list as the model sees it when reading a website. */
export const forPrompt = (): string =>
  CATEGORIES.map(
    (g) => `${g.group}:\n` + g.categories.map((c) => `  ${c.id} — ${c.label}`).join("\n"),
  ).join("\n\n");
