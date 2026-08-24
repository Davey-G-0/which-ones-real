// Question bank — "Which one's real?" party game
// Each question: category label, the real app, and 3 fakes.
const QUESTIONS = [
  // ——— NEWS ———
  {
    category: "News apps",
    real: "BBC News",
    fakes: ["Breaking Baboon", "The Daily Scone", "Newsflash Nowhere"],
  },
  {
    category: "News apps",
    real: "Reuters",
    fakes: ["The World Wire", "Daily Dodo", "Truth or Consequences"],
  },
  {
    category: "News apps",
    real: "Sky News",
    fakes: ["Ground News", "The Weather Channel 2", "Skyfall"],
  },
  // ——— FOOD DELIVERY ———
  {
    category: "Food delivery apps",
    real: "Uber Eats",
    fakes: ["Uber Beets", "The Hungry Door", "Pasta Pal"],
  },
  {
    category: "Food delivery apps",
    real: "DoorDash",
    fakes: ["Dash Door", "The Snack Express", "Meal Dealers"],
  },
  {
    category: "Food delivery apps",
    real: "Deliveroo",
    fakes: ["Deliver Noo", "Sushi Safari", "The Burger Bus"],
  },
  // ——— MUSIC ———
  {
    category: "Music apps",
    real: "Spotify",
    fakes: ["Spot Fright", "Vinyl Vortex", "The Music Bin"],
  },
  {
    category: "Music apps",
    real: "Apple Music",
    fakes: ["Pear Music", "Bananarama Music", "Apple Cider"],
  },
  {
    category: "Music apps",
    real: "YouTube Music",
    fakes: ["TubeTune", "The Music Tube", "YouTubed"],
  },
  // ——— BANKING ———
  {
    category: "Banking apps",
    real: "Chase",
    fakes: ["Banksy", "The Vault", "Chaser"],
  },
  {
    category: "Banking apps",
    real: "Revolut",
    fakes: ["Revolt", "The Coin Cartel", "Revolution Money"],
  },
  {
    category: "Banking apps",
    real: "Monzo",
    fakes: ["The Money Zoo", "Menzia", "Monzara"],
  },
  // ——— SOCIAL ———
  {
    category: "Social media apps",
    real: "Instagram",
    fakes: ["Insta-gram", "Photo Trap", "The Square Feed"],
  },
  {
    category: "Social media apps",
    real: "TikTok",
    fakes: ["Tick Tick", "The 15 Second Show", "TikTock"],
  },
  {
    category: "Social media apps",
    real: "Snapchat",
    fakes: ["Snap Chat", "The Ghost Feed", "Snap Crackle"],
  },
  // ——— SPORTS ———
  {
    category: "Sports apps",
    real: "ESPN",
    fakes: ["The Jumbotron", "Sideline Wire", "Sportsflash"],
  },
  {
    category: "Sports apps",
    real: "Strava",
    fakes: ["Strollva", "The Run Log", "Karma"],
  },
  {
    category: "Sports apps",
    real: "Peloton",
    fakes: ["The Spin Cycle", "Cranked", "Pelonet"],
  },
  // ——— RETAIL ———
  {
    category: "Shopping apps",
    real: "Amazon",
    fakes: ["The Everything Store", "Azman", "Prime Deal"],
  },
  {
    category: "Shopping apps",
    real: "eBay",
    fakes: ["The Bid Bay", "BidBuddy", "E-Bay"],
  },
  {
    category: "Shopping apps",
    real: "Target",
    fakes: ["The Bullseye", "Aim High", "Aim"],
  },
  // ——— TRAVEL ———
  {
    category: "Travel apps",
    real: "Airbnb",
    fakes: ["The Rental Roost", "Air B&B", "Stayy"],
  },
  {
    category: "Travel apps",
    real: "Hopper",
    fakes: ["The Flight Hopper", "Fare Hopper", "Hoppy"],
  },
  {
    category: "Travel apps",
    real: "Expedia",
    fakes: ["The Trip Trip", "Expensive", "Bookaroo"],
  },
];
