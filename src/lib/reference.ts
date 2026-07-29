// Reference lists for the booking form — Connor's supplier rosters, per channel.

export const SUPPLIERS_BY_CHANNEL: Record<string, string[]> = {
  Digital: [
    "Plug Media", "Sabio", "Readpeak", "MMM", "News UK", "Reach", "Google", "Meta",
    "Amazon", "LinkedIn", "ITV", "Ozone", "LG", "Samsung", "GPM360",
  ],
  TV: ["ITV", "Sky", "C4", "C5", "UKTV", "Axiom", "Sabio", "Plug", "Media15", "LG", "Samsung", "GPM360"],
  Radio: ["Global", "Bauer", "News Broadcasting", "DAX (Global)", "Communicorp", "Fix Radio", "Boom Radio", "Gaydio"],
  Print: [
    "Reach PLC", "News UK", "MMM", "Telegraph", "Guardian Group", "FT", "Newsquest",
    "Future PLC", "Immediate Media", "Bauer Media",
  ],
  OOH: [
    "JCD", "Bauer Media", "Global OOH", "Ocean OOH", "KBH Media", "T4 Media",
    "AdFrame", "Konncected+", "CScreens", "GPM360",
  ],
  Creative: ["Studio"],
};

export const REGIONS = [
  "National", "London", "Meridian", "Anglia", "Central", "Granada", "Yorkshire",
  "Tyne Tees & Border", "West Country", "Wales", "Scotland", "Northern Ireland",
];

export const OOH_FORMATS = ["4 Sheet", "6 Sheet", "12 Sheet", "48 Sheet", "96 Sheet", "Hero Site"];

export const COPY_OPTIONS = ["New Copy", "Repeat Copy", "URN"];

/** Formats the studio produces, offered on creative briefs. */
export const CREATIVE_FORMATS = [
  "TV / Video",
  "Radio / Audio",
  "Press / Print",
  "OOH artwork",
  "Digital display",
  "Social assets",
  "Concept / Brand",
];

/** CPT only applies to these channels. */
export const CPT_CHANNELS = ["Digital", "TV", "Radio"];

export const CAMPAIGN_STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "booked", label: "Booked" },
  { value: "live", label: "Live" },
  { value: "risk", label: "At risk" },
  { value: "done", label: "Complete" },
];
