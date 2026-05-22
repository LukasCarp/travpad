import {
  ArrowLeftRight,
  Banknote,
  Bed,
  BedDouble,
  Bike,
  Building,
  Building2,
  Bus,
  Cake,
  Camera,
  Car,
  CarTaxiFront,
  Castle,
  Church,
  Coffee,
  CreditCard,
  Flag,
  Gamepad2,
  Globe,
  GraduationCap,
  Grape,
  Hammer,
  Home,
  Hotel,
  House,
  KeyRound,
  Landmark,
  Laptop,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Martini,
  Mic,
  Mountain,
  Music,
  Palette,
  ParkingMeter,
  PartyPopper,
  Plane,
  Puzzle,
  Sandwich,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Store,
  Tag,
  Tent,
  Trees,
  Utensils,
  UtensilsCrossed,
  Waves,
  Wifi,
  type LucideIcon,
} from "lucide-react";

export const TAXONOMY = [
  {
    name: "Area",
    emoji: "🗺️",
    subcategories: [
      { name: "Region", chips: [] },
      { name: "Province", chips: [] },
      { name: "Municipality", chips: [] },
      { name: "City", chips: [] },
      { name: "Town", chips: [] },
      { name: "Village", chips: [] },
      { name: "District", chips: [] },
      { name: "Neighborhood", chips: [] },
    ],
  },
  {
    name: "Eat/Drink",
    emoji: "🍽️",
    subcategories: [
      {
        name: "Restaurant",
        chips: [
          "Local Cuisine",
          "Fine Dining",
          "Veggie/Vegan",
          "Outdoor Seating",
          "Kid-Friendly",
          "Card Only",
          "Cash Only",
          "AC",
          "Tasting Menu",
        ],
      },
      {
        name: "Café & Bakery",
        chips: [
          "Specialty Coffee",
          "Breakfast/Brunch",
          "Bakery/Pastries",
          "Laptop Friendly",
          "Power Outlets",
          "Pet Friendly",
          "Cozy/Quiet",
          "Outdoor Patio",
        ],
      },
      {
        name: "Bars & Pubs",
        chips: [
          "Cocktail Bar",
          "Craft Beer",
          "Wine Bar",
          "Rooftop",
          "Speakeasy",
          "Happy Hour",
          "Outdoor Patio",
          "Live DJ",
          "Great Views",
        ],
      },
      {
        name: "Street Food & Markets",
        chips: [
          "Night Market",
          "Food Truck",
          "Farmers Market",
          "Grab & Go",
          "Cheap Eat",
          "Cash Only",
          "Seating Available",
          "Local Favorites",
        ],
      },
      {
        name: "Wineries & Breweries",
        chips: [
          "Wine Tasting",
          "Craft Brewery",
          "Distillery",
          "Vineyard View",
          "Guided Tour",
          "Food Pairings",
          "Shop/Bottle Sales",
        ],
      },
      {
        name: "Dessert & Sweets",
        chips: [
          "Gelato/Ice Cream",
          "Chocolate/Sweets",
          "Waffles/Crepes",
          "Traditional/Local",
          "Late Night",
          "Vegan Options",
        ],
      },
    ],
  },
  {
    name: "Sleep",
    emoji: "🛏️",
    subcategories: [
      {
        name: "Hotel & Resort",
        chips: [
          "Boutique",
          "Luxury",
          "Budget",
          "Swimming Pool",
          "AC",
          "Free Parking",
          "Breakfast Included",
          "Gym/Spa",
          "24/7 Reception",
        ],
      },
      {
        name: "Hostel & Guesthouse",
        chips: [
          "Dorm Rooms",
          "Private Rooms",
          "Social/Party",
          "Co-living/Nomad",
          "Kitchen Access",
          "Free Laundry",
          "B&B/Homestay",
        ],
      },
      {
        name: "Vacation Rental & Villa",
        chips: [
          "Entire House",
          "Apartment",
          "Kitchen",
          "Washing Machine",
          "Long-stay Discount",
          "Self Check-in",
        ],
      },
      {
        name: "Camping & Glamping",
        chips: [
          "Wild Camping",
          "Campsite",
          "Glamping/Yurt",
          "Van/RV Friendly",
          "Showers",
          "Drinking Water",
          "Fire Pit",
          "Electricity",
        ],
      },
      {
        name: "Mountain Huts & Refuges",
        chips: [
          "Hiking Shelter",
          "Remote Location",
          "Shared Facilities",
          "Firewood Provided",
          "Booking Required",
        ],
      },
    ],
  },
  {
    name: "Sights",
    emoji: "🏛️",
    subcategories: [
      {
        name: "Nature & Viewpoints",
        chips: [
          "National Park",
          "Waterfall",
          "Hiking Trail",
          "Viewpoint",
          "Sunset Spot",
          "Wildlife Watching",
          "Caves/Geology",
        ],
      },
      {
        name: "Beaches & Coastal",
        chips: [
          "Sandy Beach",
          "Secret Cove",
          "Swimming Spot",
          "Snorkeling",
          "Tidal Pool/Hot Springs",
          "Lifeguard",
          "Nudist/FKK",
        ],
      },
      {
        name: "History & Monuments",
        chips: [
          "Castle/Ruin",
          "Ancient Site",
          "Palace",
          "Monument/Statue",
          "UNESCO Heritage",
          "Ghost Town",
        ],
      },
      {
        name: "Temples & Religious Sites",
        chips: [
          "Temple",
          "Church/Cathedral",
          "Mosque",
          "Shrine",
          "Dress Code Strict",
          "Active Worship",
        ],
      },
      {
        name: "Arts & Museums",
        chips: [
          "Art Gallery",
          "Contemporary Art",
          "History Museum",
          "Science/Interactive",
          "Street Art",
          "Free Entry Days",
        ],
      },
    ],
  },
  {
    name: "Activities",
    emoji: "🧗",
    subcategories: [
      {
        name: "Adventure & Sports",
        chips: [
          "Surf Spot",
          "Climbing/Bouldering",
          "Dive Center",
          "Gym/Fitness",
          "Skatepark",
          "Bike/Scooter Rental",
        ],
      },
      {
        name: "Workshops & Classes",
        chips: [
          "Cooking Class",
          "Language School",
          "Yoga/Meditation",
          "Local Craft/Artisan",
          "Surf School",
        ],
      },
    ],
  },
  {
    name: "Entertainment",
    emoji: "🎭",
    subcategories: [
      {
        name: "Clubs & Nightlife",
        chips: [
          "Techno/Electronic",
          "HipHop/R&B",
          "Live DJ",
          "Open Air/Beach Club",
          "Late Night (3am+)",
          "Dress Code",
          "Cover Charge",
        ],
      },
      {
        name: "Live Music & Performing Arts",
        chips: [
          "Concert Venue",
          "Jazz Club",
          "Theater/Opera",
          "Indie Cinema",
          "Stand-up Comedy",
          "Busking/Street Music",
        ],
      },
      {
        name: "Social Gaming & Festivals",
        chips: [
          "Board Game Café",
          "Arcade/Pinball",
          "Pool/Billiards",
          "Escape Room",
          "Seasonal Festival",
        ],
      },
    ],
  },
  {
    name: "Shopping",
    emoji: "🛍️",
    subcategories: [
      {
        name: "Vintage & Second Hand",
        chips: ["Flea Market", "Vintage Clothing", "Antique Shop", "Thrift Store"],
      },
      {
        name: "Local Craft & Design",
        chips: [
          "Artisan Workshop",
          "Souvenir Shop",
          "Local Art",
          "Handmade Goods",
          "Boutique",
        ],
      },
      {
        name: "Groceries & Delicatessen",
        chips: [
          "Supermarket",
          "Convenience Store",
          "Local Delicacies",
          "Wine/Liquor Shop",
          "Bakery/Butcher",
        ],
      },
      {
        name: "Fashion & Malls",
        chips: ["Shopping Mall", "Department Store", "Outlet", "Designer Brands"],
      },
      {
        name: "Specialty & Hobbies",
        chips: [
          "Bookstore",
          "Vinyl/Music",
          "Outdoor/Camping Gear",
          "Art Supplies",
          "Pharmacy",
        ],
      },
    ],
  },
  {
    name: "Money",
    emoji: "💵",
    subcategories: [
      {
        name: "ATM / Cash Machine",
        chips: [
          "No Fee",
          "International Cards",
          "24/7 Accessible",
          "Inside Bank (Safer)",
          "Dispenses USD/EUR",
        ],
      },
      {
        name: "Exchange & Transfer",
        chips: [
          "Currency Exchange",
          "Bank Branch",
          "Western Union/Wire",
          "Tax Refund",
        ],
      },
    ],
  },
  {
    name: "Internet & Work",
    emoji: "🌐",
    subcategories: [
      {
        name: "Coworking Spaces",
        chips: [
          "High-Speed Wifi (50mbps+)",
          "Hot Desk",
          "Private Meeting Room",
          "Ergonomic Chairs",
          "Coffee Included",
          "Day Pass Available",
        ],
      },
      {
        name: "Wifi Cafés & Libraries",
        chips: [
          "Laptop Welcome",
          "Power Outlets",
          "Quiet/Study Zone",
          "Public Library",
          "Free Admission",
        ],
      },
      {
        name: "Telecom & Connectivity",
        chips: [
          "SIM Card Shop",
          "eSIM Support",
          "Phone Repair",
          "Electronics/Cables",
        ],
      },
    ],
  },
  {
    name: "Transport",
    emoji: "🚗",
    subcategories: [
      {
        name: "Public Transport",
        chips: [
          "Metro/Subway",
          "Bus Stop",
          "Train Station",
          "Tram",
          "Ticket Machine",
          "Free/Complimentary",
        ],
      },
      {
        name: "Rentals",
        chips: [
          "Car Rental",
          "Scooter/Moto Rental",
          "Bicycle Rental",
          "ATV/Quad Rental",
          "No Deposit Required",
          "Helmets Included",
        ],
      },
      {
        name: "Taxi & Ride-Sharing",
        chips: [
          "Taxi Stand",
          "Ride-Share Pickup (Uber/Grab)",
          "Fixed Rates",
          "24/7 Available",
          "English Speaking",
        ],
      },
      {
        name: "Long-Distance Hubs",
        chips: [
          "Airport",
          "Ferry Terminal",
          "Long-Distance Bus Station",
          "Central Train Station",
          "Luggage Storage",
        ],
      },
      {
        name: "Parking & Charging",
        chips: [
          "Free Parking",
          "Paid Parking",
          "EV Charging Station",
          "Secured/Guarded",
          "Motorcycle Parking",
        ],
      },
    ],
  },
] as const;

export type Category = (typeof TAXONOMY)[number]["name"];

export const CATEGORIES: readonly Category[] = TAXONOMY.map((c) => c.name);

export function emojiFor(category: string): string {
  return TAXONOMY.find((c) => c.name === category)?.emoji ?? "";
}

export function subcategoriesFor(category: string): readonly string[] {
  return (
    TAXONOMY.find((c) => c.name === category)?.subcategories.map((s) => s.name) ??
    []
  );
}

export function chipsFor(
  category: string,
  subcategory: string | null | undefined
): readonly string[] {
  if (!subcategory) return [];
  const cat = TAXONOMY.find((c) => c.name === category);
  return cat?.subcategories.find((s) => s.name === subcategory)?.chips ?? [];
}

// Chips are stored as their display label, so there is no key→label mapping and
// no per-chip icon set — every chip renders with a single generic icon.
export function iconForService(): LucideIcon {
  return Tag;
}

export function labelForService(service: string): string {
  return service;
}

// A representative color and lucide icon for each main category, used for the
// map markers, the category filter, and the category badge.
const CATEGORY_COLOR: Record<string, string> = {
  Area: "#64748b",
  "Eat/Drink": "#f97316",
  Sleep: "#6366f1",
  Sights: "#22c55e",
  Activities: "#06b6d4",
  Entertainment: "#d946ef",
  Shopping: "#14b8a6",
  Money: "#eab308",
  "Internet & Work": "#3b82f6",
  Transport: "#ef4444",
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Area: MapIcon,
  "Eat/Drink": Utensils,
  Sleep: Bed,
  Sights: Landmark,
  Activities: Bike,
  Entertainment: Music,
  Shopping: ShoppingBag,
  Money: Banknote,
  "Internet & Work": Globe,
  Transport: Car,
};

export function colorForCategory(category: string): string {
  return CATEGORY_COLOR[category] ?? "#3b82f6";
}

export function iconForCategory(category: string): LucideIcon {
  return CATEGORY_ICON[category] ?? Tag;
}

// A lucide icon per subcategory. Subcategories reuse their parent category's
// color; only the icon is specific.
const SUBCATEGORY_ICON: Record<string, LucideIcon> = {
  // Area
  Region: MapIcon,
  Province: Flag,
  Municipality: Landmark,
  City: Building2,
  Town: Building,
  Village: Home,
  District: LayoutGrid,
  Neighborhood: MapPin,
  // Eat/Drink
  Restaurant: UtensilsCrossed,
  "Café & Bakery": Coffee,
  "Bars & Pubs": Martini,
  "Street Food & Markets": Sandwich,
  "Wineries & Breweries": Grape,
  "Dessert & Sweets": Cake,
  // Sleep
  "Hotel & Resort": Hotel,
  "Hostel & Guesthouse": BedDouble,
  "Vacation Rental & Villa": House,
  "Camping & Glamping": Tent,
  "Mountain Huts & Refuges": Mountain,
  // See/Do
  "Nature & Viewpoints": Trees,
  "Beaches & Coastal": Waves,
  "History & Monuments": Castle,
  "Temples & Religious Sites": Church,
  "Arts & Museums": Palette,
  "Adventure & Sports": Bike,
  "Workshops & Classes": GraduationCap,
  // Entertainment
  "Clubs & Nightlife": PartyPopper,
  "Live Music & Performing Arts": Mic,
  "Social Gaming & Festivals": Gamepad2,
  // Shopping
  "Vintage & Second Hand": Shirt,
  "Local Craft & Design": Hammer,
  "Groceries & Delicatessen": ShoppingCart,
  "Fashion & Malls": Store,
  "Specialty & Hobbies": Puzzle,
  // Money
  "ATM / Cash Machine": CreditCard,
  "Exchange & Transfer": ArrowLeftRight,
  // Internet & Work
  "Coworking Spaces": Laptop,
  "Wifi Cafés & Libraries": Wifi,
  "Telecom & Connectivity": Smartphone,
  // Transport
  "Public Transport": Bus,
  Rentals: KeyRound,
  "Taxi & Ride-Sharing": CarTaxiFront,
  "Long-Distance Hubs": Plane,
  "Parking & Charging": ParkingMeter,
};

export function iconForSubcategory(subcategory: string): LucideIcon {
  return SUBCATEGORY_ICON[subcategory] ?? Tag;
}
