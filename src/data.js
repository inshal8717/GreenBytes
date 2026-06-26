export const alQuaaCenter = { lat: 23.5324, lng: 55.6175 };

export const demoUser = {
  id: "user-rashi",
  name: "Rashi",
  phone: "971501234567",
  roles: ["tourist"],
  safetyPledgeAccepted: false,
};

export const listings = [
  {
    id: "l1",
    ownerId: "farmer-1",
    ownerName: "Hamad Al Mansoori",
    ownerPhone: "971501111111",
    title: "Al Samaa Stargazing Farm",
    description:
      "A quiet farm edge with open desert sky, guided telescope viewing, dates, gahwa, and a clearly marked safe walking zone.",
    photo:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80",
    map: { x: 38, y: 48 },
    location: { lat: 23.5337, lng: 55.6084 },
    safeZone: [
      { lat: 23.5383, lng: 55.6035 },
      { lat: 23.5387, lng: 55.6135 },
      { lat: 23.5298, lng: 55.6166 },
      { lat: 23.5267, lng: 55.6069 },
    ],
    activities: [
      { id: "a1", name: "Guided stargazing", price: 120, slots: ["19:30", "21:00"] },
      { id: "a2", name: "Farm visit and gahwa", price: 65, slots: ["17:30", "18:30"] },
    ],
  },
  {
    id: "l2",
    ownerId: "farmer-2",
    ownerName: "Mariam Al Dhaheri",
    ownerPhone: "971502222222",
    title: "Dune Camel Walk",
    description:
      "A family-run camel farm with short sunset walks, animal care stories, and a resting tent inside the visitor zone.",
    photo:
      "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&w=900&q=80",
    map: { x: 68, y: 56 },
    location: { lat: 23.5228, lng: 55.6348 },
    safeZone: [
      { lat: 23.5275, lng: 55.6291 },
      { lat: 23.5287, lng: 55.6404 },
      { lat: 23.5199, lng: 55.6449 },
      { lat: 23.5152, lng: 55.6322 },
    ],
    activities: [
      { id: "a3", name: "Camel farm visit", price: 90, slots: ["16:45", "18:00"] },
      { id: "a4", name: "Sunset camel walk", price: 150, slots: ["17:45"] },
    ],
  },
  {
    id: "l3",
    ownerId: "farmer-3",
    ownerName: "Saeed Al Ameri",
    ownerPhone: "971503333333",
    title: "Quiet Sands Camp",
    description:
      "A compact desert hospitality stop with simple dinner, astronomy stories, and a mapped route for low-light walking.",
    photo:
      "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=900&q=80",
    map: { x: 52, y: 28 },
    location: { lat: 23.5476, lng: 55.6249 },
    safeZone: [
      { lat: 23.5527, lng: 55.6182 },
      { lat: 23.5536, lng: 55.6309 },
      { lat: 23.5447, lng: 55.6341 },
      { lat: 23.5418, lng: 55.6205 },
    ],
    activities: [
      { id: "a5", name: "Dinner under the stars", price: 180, slots: ["19:00"] },
      { id: "a6", name: "Night sky storytelling", price: 75, slots: ["20:30", "22:00"] },
    ],
  },
];

export const localSpots = [
  {
    id: "s1",
    type: "Restaurant",
    name: "Al Qua'a Grill",
    x: 47,
    y: 72,
    location: { lat: 23.5178, lng: 55.6159 },
    price: 55,
  },
  {
    id: "s2",
    type: "Shop",
    name: "Desert Supply Co.",
    x: 76,
    y: 31,
    location: { lat: 23.5442, lng: 55.6423 },
    price: 25,
  },
  {
    id: "s3",
    type: "Restaurant",
    name: "Oasis Tea House",
    x: 24,
    y: 60,
    location: { lat: 23.5261, lng: 55.5966 },
    price: 40,
  },
];

export const safetySlides = [
  {
    title: "Leave no trace",
    body: "Keep plastic, food wrappers, and camping waste with you. Desert animals can mistake litter for food.",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Stay inside marked zones",
    body: "Every host marks a safe visitor boundary. Stay within it unless your guide takes you further.",
    image:
      "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Respect night conditions",
    body: "Bring water, keep lights low for stargazing, and share your location only during active bookings.",
    image:
      "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&w=900&q=80",
  },
];
