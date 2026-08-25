// Question bank — "Spot the Real Headline" party game
// Each question: ONE verified real news headline + 3 fakes.
// The real headline is always the one that sounds the most fake.
// `source` is a short note shown on the reveal so the group can argue / verify.
const QUESTIONS = [
  {
    category: "News headlines",
    real: "Army deploys machine guns in failed war against emus",
    source: "The Emu War, Western Australia, 1932 — the army lost to the birds.",
    fakes: [
      "Farmers report record emu harvest after bumper season",
      "Village declares emergency after flock blocks main road",
      "New breeding program aims to boost local emu numbers",
    ],
  },
  {
    category: "News headlines",
    real: "Navy promotes penguin to sergeant after it swam back to base",
    source: "Waddell the Royal Navy penguin, 2007 — promoted for swimming ~1,000 miles home.",
    fakes: [
      "Rescue crew frees penguin tangled in fishing nets",
      "Marine park opens new penguin exhibit to the public",
      "Scientists track rare penguin migration with new tags",
    ],
  },
  {
    category: "News headlines",
    real: "KFC rebrands UK stores as pizza chain after running out of chicken",
    source: "KFC's 2005 UK chicken shortage — they handed out free Pizza Hut vouchers.",
    fakes: [
      "Fast food chain launches new spicy chicken burger",
      "Delivery app reports record holiday weekend orders",
      "Restaurant group cuts prices to win back customers",
    ],
  },
  {
    category: "News headlines",
    real: "Firefighters cut fence to free man whose head got stuck",
    source: "Bhubaneswar, India, 2021 — a man's head wedged between fence bars.",
    fakes: [
      "Council vows to repair damaged railings after inspection",
      "City approves new pedestrian crossing near park",
      "Local man fined for blocking a public pathway",
    ],
  },
  {
    category: "News headlines",
    real: "Alaska town names 170-pound cat honorary mayor",
    source: "Dad Cat of Talkeetna, Alaska — beloved honorary mayor since 2003.",
    fakes: [
      "Vet opens new clinic to serve growing pet population",
      "Volunteers launch winter feeding program for strays",
      "Town council debates new rules on public pets",
    ],
  },
  {
    category: "News headlines",
    real: "Man survives 350-foot fall off the Rock of Gibraltar",
    source: "A visitor fell ~350 ft off the Rock in 2014 and survived.",
    fakes: [
      "Hikers urged to stay on marked trails in summer heat",
      "New safety net installed along popular cliff path",
      "Tour operator reports record visitors to coastal town",
    ],
  },
  {
    category: "News headlines",
    real: "Rescuer survives 18 days trapped in collapsed cave",
    source: "A Slovenian cave rescuer was trapped 18 days in a 2013 collapse.",
    fakes: [
      "Caving group logs record-deep expedition in limestone",
      "Authorities close trail after rockfall warning",
      "Rescue team completes routine training exercise",
    ],
  },
  {
    category: "News headlines",
    real: "4,000-year-old frozen banana sells for $12,000 at auction",
    source: "A 4,000-year-old banana frozen in permafrost sold for $12,000, 2017.",
    fakes: [
      "Local grower harvests first banana crop of the year",
      "Study links banana to improved morning mood",
      "Supermarket chain cuts price on seasonal fruit",
    ],
  },
  {
    category: "News headlines",
    real: "150-year-old snowman discovered preserved in glacier",
    source: "A 150-year-old snowman was found preserved inside a glacier.",
    fakes: [
      "Winter storm buries village under fresh snow",
      "Ski resort opens early after heavy snowfall",
      "Scientists warn of record-melting glaciers",
    ],
  },
  {
    category: "News headlines",
    real: "Newspaper runs the headline \u201cMan bites dog\u201d in 1917",
    source: "A Belgian paper ran \u201cMan bites dog\u201d as a joke headline, 1917.",
    fakes: [
      "Veterinarian warns about rising dog bite reports",
      "City passes new leash law for public parks",
      "Rescue group celebrates record dog adoptions",
    ],
  },
  {
    category: "News headlines",
    real: "Man survives being struck by lightning twice",
    source: "A handful of people have survived multiple lightning strikes; it's real.",
    fakes: [
      "Meteorologists issue rare double-storm warning",
      "Lightning safety campaign hits record reach",
      "New sensor network tracks storms in real time",
    ],
  },
  {
    category: "News headlines",
    real: "Man drives to hospital after his arm is severed in a crash",
    source: "Reported crashes where a driver kept going to the hospital armless.",
    fakes: [
      "Highway authority completes emergency road repairs",
      "Hospital opens new trauma unit to cut wait times",
      "Campaign urges drivers to stop after accidents",
    ],
  },
];
