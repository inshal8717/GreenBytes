import { alQuaaCenter, astronomicalEvents, demoUser, listings as seedListings, localSpots, safetySlides } from "./data.js";
import {
  createBookingRecord,
  createListingRecord,
  deleteBookingRecord,
  findBookingConflict,
  getCurrentFirebaseUser,
  getUserProfile,
  loginUserAccount,
  logoutFirebaseUser,
  registerUserAccount,
  saveUserProfile,
  seedListingsIfEmpty,
  updateLiveLocation,
  uploadListingImage,
  watchBookingsForFarmer,
  watchBookingsForUser,
  watchListings,
} from "./firebaseService.js";
import { distanceLabel, pointInPolygon, safeZoneBox } from "./geo.js";
import { mountGoogleMap, mountLocationPicker, mountSafeZonePicker } from "./maps.js";
import { applyArabicUi, translateArabicText } from "./i18n.js";

let listings = [...seedListings];
let unsubscribeListings = null;
let unsubscribeBookings = null;
let welcomeSlideshowTimer = null;
const seedPhotoById = new Map(seedListings.map((listing) => [listing.id, listing.photo]));

const state = {
  user: { ...demoUser },
  uid: null,
  signedIn: false,
  activeRole: "tourist",
  screen: "welcome",
  selectedListingId: seedListings[0].id,
  focusedMapListingId: null,
  safetySlide: 0,
  authMode: "signin",
  authError: "",
  pendingBooking: null,
  pendingBookingRemoval: null,
  bookingConflict: null,
  replacesBookingId: null,
  newListingLocation: alQuaaCenter,
  quoteIndex: 0,
  firebaseStatus: "Not connected",
  authProvider: null,
  bookings: [],
  planSuggestions: [],
  planBookingOpen: false,
  planBudget: 260,
  planItinerary: null,
  planSource: null,
  astronomyPopupOpen: true,
  astronomyEventIndex: 0,
  newListingSafeZone: [],
  listingSaveConfirmation: null,
  language: localStorage.getItem("duroob.language") === "ar" ? "ar" : "en",
};

const app = document.querySelector("#app");
const localAuthStorageKey = "alquaa.localUsers";
const localBookingsStorageKey = "alquaa.localBookings";
const localListingsStorageKey = "alquaa.localListings";
const authTimeoutMs = 8000;
const welcomeImages = Array.from(
  { length: 13 },
  (_, index) => `assets/images/desert-stars-${String(index + 1).padStart(2, "0")}.${index < 8 ? "jpeg" : "webp"}`,
);
const spaceNotes = [
  "The desert is a natural observatory: dry air and low light make faint stars easier to see.",
  "Fact: The Milky Way is usually best viewed when the Moon is below the horizon.",
  "Look up long enough and navigation becomes a conversation with time.",
  "Fact: Jupiter's four largest moons can be seen with simple binoculars on clear nights.",
  "The darkest skies reward patience more than expensive equipment.",
  "Fact: Al Qua'a is known locally for stargazing because it sits far from heavy city light.",
];

function setState(patch) {
  Object.assign(state, patch);
  render();
}

function localize(value) {
  return state.language === "ar" ? translateArabicText(value) : value;
}

function localizedAlert(message) {
  alert(localize(message));
}

async function registerWithPassword(form) {
  const accountType = String(form.get("role") || "tourist");
  const isProvider = accountType !== "tourist";
  const roles = isProvider ? ["farmer", "tourist"] : ["tourist"];
  const profile = {
    name: String(form.get("name") || "").trim(),
    email: String(form.get("email") || "").trim(),
    phone: String(form.get("phone") || "").trim(),
    password: String(form.get("password") || ""),
    roles,
    providerType: isProvider ? accountType : null,
  };
  try {
    const firebaseUser = await withTimeout(registerUserAccount(profile), authTimeoutMs, "Firebase registration timed out.");
    setState({
      uid: firebaseUser.uid,
      signedIn: true,
      activeRole: isProvider ? "farmer" : "tourist",
      authError: "",
      firebaseStatus: "Firebase connected",
      authProvider: "firebase",
      user: { ...demoUser, ...profile, id: firebaseUser.uid, password: undefined, safetyPledgeAccepted: false },
      bookings: [],
      screen: isProvider ? "farmerOnboarding" : "safety",
    });
    seedFirebaseListings();
    startFirebaseListeners(firebaseUser.uid, isProvider ? "farmer" : "tourist");
  } catch (error) {
    if (shouldUseLocalAuthFallback(error)) {
      const localUser = registerLocalUser(profile);
      setState({
        uid: localUser.id,
        signedIn: true,
        activeRole: isProvider ? "farmer" : "tourist",
        authError: "",
        firebaseStatus: "Local auth fallback",
        authProvider: "local",
        user: { ...demoUser, ...localUser, password: undefined },
        bookings: loadLocalBookings(localUser.id),
        screen: isProvider ? "farmerOnboarding" : "safety",
      });
      return;
    }
    setState({ authError: readableAuthError(error) });
  }
}

async function signInWithPassword(form) {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  try {
    const firebaseUser = await withTimeout(loginUserAccount(email, password), authTimeoutMs, "Firebase sign-in timed out.");
    await enterFirebaseSession(firebaseUser);
  } catch (error) {
    if (shouldUseLocalAuthFallback(error)) {
      const localUser = loginLocalUser(email, password);
      if (!localUser) {
        setState({ authError: "Firebase is unavailable and no matching local fallback account was found." });
        return;
      }
      setState({
        uid: localUser.id,
        signedIn: true,
        activeRole: localUser.roles.includes("farmer") ? "farmer" : "tourist",
        authError: "",
        firebaseStatus: "Local auth fallback",
        authProvider: "local",
        user: { ...demoUser, ...localUser, password: undefined },
        bookings: loadLocalBookings(localUser.id),
        screen: localUser.safetyPledgeAccepted ? "map" : "safety",
      });
      return;
    }
    setState({ authError: readableAuthError(error) });
  }
}

async function enterFirebaseSession(firebaseUser) {
  const profile = await getFirebaseProfileWithFallback(firebaseUser.uid);
  const roles = profile?.roles?.length ? profile.roles : ["tourist"];
  const activeRole = roles.includes("farmer") ? "farmer" : "tourist";
  const user = {
    ...demoUser,
    id: firebaseUser.uid,
    name: profile?.name || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
    email: profile?.email || firebaseUser.email || "",
    phone: profile?.phone || demoUser.phone,
    roles,
    providerType: profile?.providerType || (roles.includes("farmer") ? "farmer" : null),
    safetyPledgeAccepted: Boolean(profile?.safetyPledgeAccepted),
  };

  setState({
    uid: firebaseUser.uid,
    signedIn: true,
    activeRole,
    authError: "",
    firebaseStatus: "Firebase connected",
    authProvider: "firebase",
    user,
    bookings: [],
    screen: activeRole === "farmer" ? "dashboard" : user.safetyPledgeAccepted ? "map" : "safety",
  });
  seedFirebaseListings();
  startFirebaseListeners(firebaseUser.uid, activeRole);
}

async function initializeLoginScreen() {
  try {
    const firebaseUser = await getCurrentFirebaseUser();
    if (firebaseUser) {
      await enterFirebaseSession(firebaseUser);
      return;
    }
  } catch (error) {
    console.warn("Could not restore the previous Firebase session.", error);
  } finally {
    if (!state.signedIn) render();
  }
}

function startFirebaseListeners(uid, activeRole) {
  unsubscribeListings?.();
  unsubscribeBookings?.();
  unsubscribeListings = watchListings(
    (items) => {
      listings = mergeListings(seedListings, items, loadLocalListings());
      render();
    },
    (error) => console.warn("Could not watch listings.", error),
  );
  const watchBookings = activeRole === "farmer" ? watchBookingsForFarmer : watchBookingsForUser;
  unsubscribeBookings = watchBookings(
    uid,
    (items) => {
      state.bookings = items;
      render();
    },
    (error) => {
      console.warn("Could not watch bookings.", error);
      setState({ firebaseStatus: "Booking sync error" });
    },
  );
}

function seedFirebaseListings() {
  seedListingsIfEmpty(seedListings).catch((error) => {
    console.warn("Could not seed listings.", error);
  });
}

function roleLabel() {
  if (state.activeRole !== "farmer") return "Tourist";
  return providerTypeLabel(state.user.providerType);
}

function providerTypeLabel(type) {
  if (type === "guide") return "Guide";
  if (type === "localBusiness") return "Local business";
  return "Farmer";
}

function pageTitle() {
  const titles = {
    map: "Book Experience",
    providers: "Guides and Local Businesses",
    plan: "Plan my evening",
    bookings: "My bookings",
    dashboard: `${providerTypeLabel(state.user.providerType)} dashboard`,
    listings: "My listings",
    sky: "Sky map",
    settings: "Account settings",
    farmerOnboarding: `Create your first ${providerTypeLabel(state.user.providerType).toLowerCase()} listing`,
  };
  return titles[state.screen] || "Al Qua'a Tourism";
}

function render() {
  stopWelcomeSlideshow();
  document.documentElement.lang = state.language;
  document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
  document.body.classList.toggle("rtl", state.language === "ar");
  if (!state.signedIn || state.screen === "welcome") {
    app.innerHTML = welcomeView();
    if (state.language === "ar") applyArabicUi(app);
    wireWelcome();
    startWelcomeSlideshow();
    return;
  }

  if (mustCompletePledge() && state.screen !== "safety") {
    state.screen = "safety";
  }

  app.innerHTML = `
    <div class="app-shell">
      ${sidebarView()}
      <main class="main">
        <div class="topbar">
          <div>
            <div class="eyebrow">${roleLabel()}</div>
            <h2>${pageTitle()}</h2>
          </div>
          <div class="pill-row">
            <span class="pill">${state.user.name}</span>
            <span class="pill">${state.firebaseStatus}</span>
            ${languageToggleView()}
            <button class="ghost-btn" data-action="logout">Log out</button>
          </div>
        </div>
        ${screenView()}
      </main>
    </div>
    ${modalView()}
    ${bookingConfirmView()}
    ${planBookingView()}
    ${bookingRemovalView()}
    ${bookingConflictView()}
    ${listingSaveConfirmationView()}
    ${spaceNoteView()}
    ${astronomyEventPopup()}
  `;
  if (state.language === "ar") applyArabicUi(app);
  wireApp();
}

function languageToggleView() {
  return `<button class="language-toggle" type="button" data-action="toggleLanguage" data-no-translate aria-label="Switch language">${state.language === "ar" ? "English" : "العربية"}</button>`;
}

function welcomeView() {
  const isRegister = state.authMode === "register";
  return `
    <section class="hero">
      <div class="hero-slideshow" aria-hidden="true">
        ${welcomeImages
          .map(
            (image, index) =>
              `<div class="hero-slide ${index === 0 ? "is-active" : ""}" style="--hero-image: url('${image}')"></div>`,
          )
          .join("")}
      </div>
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="welcome-language-toggle">${languageToggleView()}</div>
      <div class="hero-inner">
        <div class="eyebrow">Al Qua'a Tourism</div>
        <h1>Book desert skies, farm visits, and local guides without losing the village economy on the roadside.</h1>
        <p>
          A simple marketplace for tourists, farmers, and guides: mapped safe zones, time-slot booking,
          WhatsApp contact, live visit awareness, and an evening planner shaped around local spending.
        </p>
        <form class="auth-panel" data-auth-form>
          <div class="row" style="justify-content: space-between;">
            <h2>${isRegister ? "Create account" : "Sign in"}</h2>
            <button class="ghost-btn" type="button" data-auth-mode="${isRegister ? "signin" : "register"}">
              ${isRegister ? "Use existing account" : "Create account"}
            </button>
          </div>
          ${state.authError ? `<p class="auth-error">${state.authError}</p>` : ""}
          <div class="field ${isRegister ? "" : "hidden"}">
            <label>User name</label>
            <input name="name" autocomplete="name" placeholder="Your name" ${isRegister ? "required" : ""}>
          </div>
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
          </div>
          <div class="field">
            <label>Password</label>
            <input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="6" placeholder="At least 6 characters" required>
          </div>
          <div class="field ${isRegister ? "" : "hidden"}">
            <label>WhatsApp phone</label>
            <input name="phone" autocomplete="tel" placeholder="971501234567" ${isRegister ? "required" : ""}>
          </div>
          <div class="field ${isRegister ? "" : "hidden"}">
            <label>Account type</label>
            <select name="role">
              <option value="tourist">Tourist</option>
              <option value="farmer">Farmer</option>
              <option value="guide">Guide</option>
              <option value="localBusiness">Local business</option>
            </select>
          </div>
          <button class="primary-btn" type="submit">${isRegister ? "Register" : "Sign in"}</button>
          <p class="muted" style="margin: 14px 0 0;">
            Uses Firebase Email/Password Authentication. If Firebase Auth is not enabled yet, this build uses local browser auth so the prototype still works.
          </p>
        </form>
      </div>
    </section>
  `;
}

function startWelcomeSlideshow() {
  const slides = [...document.querySelectorAll(".hero-slide")];
  if (slides.length < 2) return;

  let activeIndex = 0;
  welcomeImages.forEach((source) => {
    const image = new Image();
    image.src = source;
  });

  welcomeSlideshowTimer = window.setInterval(() => {
    const nextIndex = (activeIndex + 1) % slides.length;
    slides[activeIndex].classList.remove("is-active");
    slides[nextIndex].classList.add("is-active");
    activeIndex = nextIndex;
  }, 4000);
}

function stopWelcomeSlideshow() {
  if (welcomeSlideshowTimer === null) return;
  window.clearInterval(welcomeSlideshowTimer);
  welcomeSlideshowTimer = null;
}

function sidebarView() {
  const touristItems = [
    ["map", "Book Experience"],
    ["providers", "Guides and Local Businesses"],
    ["sky", "Sky map"],
    ["plan", "Plan evening"],
    ["bookings", "My bookings"],
  ];
  const farmerItems = [
    ["dashboard", "Dashboard"],
    ["listings", "My listings"],
    ["sky", "Sky map"],
  ];
  const items = state.activeRole === "farmer" ? farmerItems : touristItems;
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="mark">AQ</div>
        <div><strong>Al Qua'a</strong><span>Tourism exchange</span></div>
      </div>
      <nav class="nav">
        ${items
          .map(
            ([screen, label]) =>
              `<button class="${state.screen === screen ? "active" : ""}" data-screen="${screen}">${label}</button>`,
          )
          .join("")}
        <button class="${state.screen === "settings" ? "active" : ""}" data-screen="settings">Settings</button>
      </nav>
    </aside>
  `;
}

function screenView() {
  if (state.screen === "safety") return safetyView();
  if (state.screen === "farmerOnboarding") return farmerOnboardingView();
  if (state.screen === "map") return mapView();
  if (state.screen === "providers") return providersView();
  if (state.screen === "sky") return skyView();
  if (state.screen === "plan") return planView();
  if (state.screen === "bookings") return bookingsView();
  if (state.screen === "dashboard") return dashboardView();
  if (state.screen === "listings") return listingsView();
  if (state.screen === "settings") return settingsView();
  return mapView();
}

function safetyView() {
  const slide = safetySlides[state.safetySlide];
  const last = state.safetySlide === safetySlides.length - 1;
  return `
    <div class="split">
      <div class="slide" style="--slide-image: url('${slide.image}')">
        <div class="eyebrow">Safety pledge ${state.safetySlide + 1} / ${safetySlides.length}</div>
        <h1>${slide.title}</h1>
        <p>${slide.body}</p>
      </div>
      <div class="card"><div class="card-body">
        <h2>Unlock bookings</h2>
        <p class="muted">Tourists complete this pledge once. Booking stays locked until the checkbox is confirmed.</p>
        <label class="check-row ${last ? "" : "hidden"}">
          <input type="checkbox" data-safety-check>
          I understand and will follow the safe-zone and leave-no-trace rules.
        </label>
        <div class="actions" style="margin-top: 18px;">
          <button class="secondary-btn" data-action="prevSafety" ${state.safetySlide === 0 ? "disabled" : ""}>Back</button>
          <button class="primary-btn" data-action="${last ? "acceptSafety" : "nextSafety"}">${last ? "Enter app" : "Next"}</button>
        </div>
      </div></div>
    </div>
  `;
}

function farmerOnboardingView() {
  const providerLabel = providerTypeLabel(state.user.providerType);
  return `
    <div class="card"><div class="card-body provider-onboarding-card">
        <div class="eyebrow">${providerLabel} onboarding</div>
        <h2>Create your first public listing</h2>
        <p class="muted">Your listing is published only after Firebase confirms the save. Tourists will then see it on the map and in the marketplace.</p>
        ${listingFormView("Save first listing")}
    </div></div>
  `;
}

function skyView() {
  return `
    <div class="card">
      <div class="stellarium-frame">
        <iframe
          title="Stellarium Web sky map"
          src="https://stellarium-web.org/"
          loading="lazy"
          allow="fullscreen; geolocation"
        ></iframe>
      </div>
    </div>
  `;
}

function mapView() {
  const selected = listings.find((listing) => listing.id === state.selectedListingId) || listings[0];
  return `
    <div class="map-layout">
      ${mainMapView()}
      <aside class="grid">
        <div class="card"><div class="card-body">
          <div class="row" style="justify-content: space-between;">
            <h3 style="margin: 0;">${selected.title}</h3>
            <span class="pill">from AED ${Math.min(...selected.activities.map((a) => a.price))}</span>
          </div>
          <p class="business-byline">Hosted by <strong>${selected.businessName || selected.ownerName}</strong> · ${selected.businessType || "Local host"}</p>
          <p class="muted">${selected.description}</p>
          <div class="listing-img" style="background-image: url('${selected.photo}')"></div>
          <div class="pill-row" style="margin: 14px 0;">
            <span class="pill">Duration: ${selected.duration || "Ask host"}</span>
            <span class="pill">Best: ${selected.bestTime || "Evening"}</span>
            <span class="pill safe-pill">Blue area = visitor safe zone</span>
          </div>
          <button class="primary-btn" data-action="openDetail">View and book</button>
        </div></div>
        <div class="card"><div class="card-body">
          <h3>Local businesses</h3>
          <p class="muted">Demo marketplace prices—confirm current prices with the business.</p>
          <div class="local-business-list">
            ${localSpots.map(localBusinessCard).join("")}
          </div>
        </div></div>
      </aside>
    </div>
    <section class="map-listings-section">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Explore every local host</div>
          <h2>All Al Qua’a experiences</h2>
        </div>
        <span class="pill">${listings.length} listings · blue polygons are safe zones</span>
      </div>
      <div class="map-listings-grid">
        ${listings.map(mapListingCard).join("")}
      </div>
    </section>
  `;
}

function listingProviderKind(listing) {
  const searchable = `${listing.providerType || ""} ${listing.businessType || ""} ${listing.ownerId || ""}`.toLowerCase();
  if (searchable.includes("guide") || searchable.includes("operator")) return "guide";
  if (searchable.includes("business") || searchable.includes("kitchen") || searchable.includes("cooperative")) return "business";
  return "farmer";
}

function providersView() {
  const guides = listings.filter((listing) => listingProviderKind(listing) === "guide");
  const businesses = listings.filter((listing) => listingProviderKind(listing) === "business");
  return `
    <section class="providers-section">
      <div class="section-heading">
        <div><div class="eyebrow">Meet local experts</div><h2>Guides</h2></div>
        <span class="pill">${guides.length} guide listings</span>
      </div>
      <div class="map-listings-grid">
        ${guides.map(mapListingCard).join("") || `<div class="empty">No guide listings yet.</div>`}
      </div>
    </section>
    <section class="providers-section">
      <div class="section-heading">
        <div><div class="eyebrow">Spend locally</div><h2>Local Businesses</h2></div>
        <span class="pill">${businesses.length + localSpots.length} local businesses</span>
      </div>
      <div class="map-listings-grid">
        ${businesses.map(mapListingCard).join("")}
        ${localSpots.map((spot) => `<div class="card"><div class="card-body">${localBusinessCard(spot)}</div></div>`).join("")}
      </div>
    </section>
  `;
}

function mapListingCard(listing) {
  const minimumPrice = Math.min(...listing.activities.map((activity) => Number(activity.price || 0)));
  return `
    <article class="card map-listing-card">
      <div class="listing-img" style="background-image: url('${listing.photo}')"></div>
      <div class="card-body">
        <div class="row" style="justify-content: space-between;align-items:flex-start;">
          <h3>${listing.title}</h3>
          <span class="pill">from AED ${minimumPrice}</span>
        </div>
        <p class="business-byline">${listing.businessName || listing.ownerName} · ${listing.businessType || "Local host"}</p>
        ${listing.expertise ? `<p class="muted"><strong>Expertise:</strong> ${listing.expertise}</p>` : ""}
        ${listing.specialties ? `<p class="muted"><strong>Specialties:</strong> ${listing.specialties}</p>` : ""}
        ${listing.priceRange ? `<p class="muted"><strong>Food/products:</strong> AED ${listing.priceRange.min}–${listing.priceRange.max}</p>` : ""}
        <p class="muted listing-card-description">${listing.description}</p>
        <div class="listing-card-facts">
          <span><strong>${listing.duration || "Flexible"}</strong> duration</span>
          <span><strong>${listing.bestTime || "Ask host"}</strong> best time</span>
          <span><strong>${listing.activities.length}</strong> activities</span>
        </div>
        <div class="pill-row listing-card-activities">
          ${listing.activities.slice(0, 3).map((activity) => `<span class="pill">${activity.name}</span>`).join("")}
          ${listing.activities.length > 3 ? `<span class="pill">+${listing.activities.length - 3} more</span>` : ""}
        </div>
        <div class="actions listing-card-actions">
          <button class="primary-btn" data-listing-detail="${listing.id}">View times and book</button>
          <button class="secondary-btn" data-focus-listing="${listing.id}">Show on map</button>
        </div>
      </div>
    </article>
  `;
}

function localBusinessCard(spot) {
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${spot.location.lat},${spot.location.lng}`;
  return `
    <article class="local-business-item">
      <div class="row" style="justify-content: space-between;">
        <strong>${spot.name}</strong>
        <span class="pill">${spot.type}</span>
      </div>
      <p>${spot.description}</p>
      <p class="muted">${spot.priceLabel} · ${spot.hours}</p>
      <a class="text-link" href="${directions}" target="_blank" rel="noreferrer">Get directions</a>
    </article>
  `;
}

function mainMapView() {
  return `
    <section class="map google-map-shell" data-map>
      <div id="googleMap" class="google-map-canvas" data-google-map></div>
    </section>
  `;
}

function zoneView(listing) {
  const box = safeZoneBox(listing.safeZone);
  const focused = state.focusedMapListingId === listing.id ? " focused" : "";
  return `<button class="safe-zone${focused}" data-listing-detail="${listing.id}" aria-label="Book ${listing.title}" style="left:${box.left}%;top:${box.top}%;width:${box.width}%;height:${box.height}%;"></button>`;
}

function miniMap(listing) {
  return `<div class="map" style="min-height: 260px;">${zoneView(listing)}<button class="pin" style="left:${listing.map?.x || 50}%;top:${listing.map?.y || 50}%;"><span>1</span></button></div>`;
}

function planView() {
  if (!state.planSuggestions.length) {
    state.planSuggestions = recommendPlanActivities("17:00", 260, "Dune activity, local food, and stargazing");
  }
  return `
    <div class="split">
      <form class="card" data-plan-form><div class="card-body">
        <h2>AI evening planner</h2>
        <div class="grid two">
          <div class="field"><label>Arrival time</label><input name="arrival" type="time" value="17:00"></div>
          <div class="field"><label>Budget AED</label><input name="budget" type="number" value="260"></div>
        </div>
        <div class="field">
          <label>What would you like to do?</label>
          <textarea name="preferences" placeholder="For example: dune bashing, a local dinner, and stargazing. I want to finish by 22:00." required>Dune activity, local food, and stargazing</textarea>
        </div>
        <button class="primary-btn">Generate plan</button>
        <p class="muted" style="margin: 14px 0 0;">The planner only uses activities and local businesses currently available in this marketplace.</p>
      </div></form>
      <div class="card"><div class="card-body" id="planResult">
        <h2>Suggested schedule</h2>
        ${
          state.planItinerary
            ? `${planTextHtml(state.planItinerary)}${planBookingButtonHtml()}<p class="muted">Source: ${state.planSource}</p>`
            : itineraryHtml("17:00", 260, "Dune activity, local food, and stargazing")
        }
      </div></div>
    </div>
  `;
}

function itineraryHtml(arrival, budget, preferences = "") {
  const preferenceWords = preferences.toLowerCase().match(/[a-z0-9]+/g) || [];
  const affordable = listings
    .flatMap((listing) => listing.activities.map((activity) => ({ listing, activity })))
    .filter((item) => item.activity.price <= budget && item.activity.slots.some((slot) => slot >= arrival))
    .map((item) => ({
      ...item,
      score: preferenceWords.filter((word) => word.length > 2 && `${item.activity.name} ${item.listing.title} ${item.listing.description}`.toLowerCase().includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score || b.activity.price - a.activity.price)[0];
  const dinner = localSpots.find((spot) => spot.type === "Restaurant");
  if (!affordable) return `<p class="empty">No activity fits this budget yet.</p>`;
  const slot = affordable.activity.slots.find((item) => item >= arrival) || affordable.activity.slots[0];
  const dinnerCost = affordable.activity.price + dinner.price <= budget ? dinner.price : 0;
  const total = affordable.activity.price + dinnerCost;
  return `
    <div class="grid">
      <div class="stat"><strong>${arrival}</strong>Arrive, carry water, and review the listing's blue safe-zone boundary.</div>
      ${dinnerCost ? `<div class="stat"><strong>Local stop</strong>${dinner.name} · ${dinner.description} · estimated AED ${dinner.price}.</div>` : ""}
      <div class="stat"><strong>${slot}</strong>${affordable.activity.name} at ${affordable.listing.title}, hosted by ${affordable.listing.businessName || affordable.listing.ownerName}. ${affordable.activity.duration || affordable.listing.duration}; best ${affordable.activity.bestTime || affordable.listing.bestTime}; AED ${affordable.activity.price}.</div>
      <div class="stat"><strong>AED ${total} total</strong>AED ${Math.max(0, budget - total)} remains from the budget.</div>
      ${planBookingButtonHtml()}
    </div>
  `;
}

function recommendPlanActivities(arrival, budget, preferences) {
  const words = String(preferences || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  return listings
    .flatMap((listing) =>
      listing.activities.map((activity) => ({
        listingId: listing.id,
        activity,
        slot: activity.slots.find(
          (item) =>
            item >= arrival &&
            !state.bookings.some(
              (booking) => booking.slot === item && booking.status !== "completed" && booking.status !== "cancelled",
            ),
        ),
        score: words.filter(
          (word) =>
            word.length > 2 &&
            `${activity.name} ${listing.title} ${listing.description}`.toLowerCase().includes(word),
        ).length,
      })),
    )
    .filter((item) => item.slot && Number(item.activity.price) <= budget)
    .sort((a, b) => b.score - a.score || Number(a.activity.price) - Number(b.activity.price))
    .slice(0, 4);
}

function planBookingButtonHtml() {
  if (!state.planSuggestions.length) return "";
  return `<button class="primary-btn" data-action="openPlanBookings">Book suggested activities</button>`;
}

function bookingsView() {
  const bookings = bookingsForCurrentUser();
  return `
    <div class="grid">
      ${bookings.map(bookingCard).join("") || `<div class="empty">No bookings yet.</div>`}
    </div>
  `;
}

function bookingCard(booking) {
  const listing = listings.find((item) => item.id === booking.listingId) || listings[0];
  return `
    <div class="card"><div class="card-body">
      <div class="row" style="justify-content: space-between;">
        <h3>${booking.activityName}</h3>
        <span class="pill">${booking.status}</span>
      </div>
      <p class="muted">${listing.title} | ${booking.slot} | AED ${booking.price}</p>
      <p class="muted">Host: ${booking.businessName || listing.businessName || listing.ownerName} · ${booking.duration || "Duration confirmed by host"}</p>
      <div class="booking-actions">
        <a class="whatsapp-btn" href="https://wa.me/${listing.ownerPhone}" target="_blank" rel="noreferrer">Message on WhatsApp</a>
        <button class="secondary-btn" data-screen="map">View safe zone</button>
        <button class="danger-btn" data-delete-booking="${booking.id}">Remove booking</button>
      </div>
    </div></div>
  `;
}

function dashboardView() {
  const active = state.bookings.filter((booking) => booking.ownerId === state.uid && booking.status !== "completed");
  return `
    <div class="grid two">
      <div class="stat"><strong>${active.length}</strong> incoming or active bookings</div>
      <div class="stat"><strong>${active.filter((b) => b.status === "active").length}</strong> sharing location now</div>
    </div>
    <div class="grid" style="margin-top: 16px;">
      ${active
        .map((booking) => {
          const listing = listings.find((item) => item.id === booking.listingId) || listings[0];
          return `
            <div class="card"><div class="card-body">
              <div class="row" style="justify-content: space-between;">
                <h3>${booking.touristName} | ${booking.activityName}</h3>
                <span class="pill">${distanceLabel(booking.touristLocation, listing.location)}</span>
              </div>
              <p class="muted">${booking.slot}. Live location is written to Firebase Realtime Database only during the active booking window.</p>
              ${miniMap({ ...listing, map: { x: 48, y: 48 } })}
              <a class="whatsapp-btn" href="https://wa.me/${booking.touristPhone}" target="_blank" rel="noreferrer">Message tourist</a>
            </div></div>
          `;
        })
        .join("")}
    </div>
  `;
}

function listingsView() {
  const visibleListings =
    state.activeRole === "farmer" ? listings.filter((listing) => listing.ownerId === state.uid) : listings;
  return `
    ${
      state.activeRole === "farmer"
        ? `<div class="card" style="margin-bottom: 16px;"><div class="card-body">
            <h2>Create a new listing</h2>
            ${listingFormView("Save listing")}
          </div></div>`
        : ""
    }
    <div class="grid three">
      ${visibleListings
        .map(
          (listing) => `
          <div class="card">
            <div class="listing-img" style="background-image: url('${listing.photo}')"></div>
            <div class="card-body">
              <h3>${listing.title}</h3>
              <p class="business-byline">${listing.businessName || listing.ownerName}</p>
              <p class="muted">${listing.activities.length} activities · ${listing.duration || "Flexible duration"} · safe zone mapped</p>
              <button class="secondary-btn" data-listing="${listing.id}">Preview</button>
            </div>
          </div>
        `,
        )
        .join("") || `<div class="empty">No listings yet.</div>`}
    </div>
  `;
}

function listingFormView(buttonLabel) {
  const providerType = state.user.providerType || "farmer";
  const isFarmer = providerType === "farmer";
  const isGuide = providerType === "guide";
  const businessLabel = isFarmer ? "Farm name" : isGuide ? "Guide/public name" : "Business name";
  const locationSection = isFarmer
    ? `<div class="field">
        <label>Draw the farm boundary you own</label>
        <p class="muted">Click around the edge of your land in order. Add at least three points; the blue polygon is the tourist safe zone saved to Firebase.</p>
        <div class="location-picker-map safe-zone-picker-map" data-safe-zone-picker></div>
        <div class="row" style="justify-content:space-between;">
          <p class="muted" data-safe-zone-label>${state.newListingSafeZone.length} boundary points selected</p>
          <button class="ghost-btn" type="button" data-action="clearSafeZone">Clear polygon</button>
        </div>
      </div>`
    : `<div class="field">
        <label>${isGuide ? "Choose the experience meeting point" : "Choose the business location"}</label>
        <div class="location-picker-map" data-location-picker></div>
        <p class="muted" data-location-label>Selected: ${state.newListingLocation.lat.toFixed(5)}, ${state.newListingLocation.lng.toFixed(5)}</p>
      </div>`;
  return `
    <form data-create-listing>
      <div class="grid two">
        <div class="field"><label>${businessLabel}</label><input name="businessName" value="${isGuide ? state.user.name : "My Al Qua'a Local Business"}" required></div>
        <div class="field"><label>Experience name</label><input name="title" value="New Al Qua'a hosting stop" required></div>
      </div>
      ${isGuide ? `<div class="field"><label>Your expertise</label><input name="expertise" placeholder="Desert navigation, astronomy, wildlife, photography..." required></div>` : ""}
      ${providerType === "localBusiness" ? `<div class="grid two">
        <div class="field"><label>Food/products from AED</label><input name="priceMin" type="number" min="0" value="15" required></div>
        <div class="field"><label>Food/products up to AED</label><input name="priceMax" type="number" min="0" value="120" required></div>
      </div>
      <div class="field"><label>Food, products, or specialties</label><textarea name="specialties" required>Local meals, dates, gahwa, and refreshments</textarea></div>` : ""}
      <div class="grid two">
        <div class="field"><label>Time slots</label><input name="slots" value="17:30, 19:00" required></div>
        <div class="field"><label>Experience duration</label><input name="duration" value="90 minutes" required></div>
      </div>
      <div class="field"><label>Description</label><textarea name="description" required>A visitor-friendly stop with a clear safe zone and evening activity slots.</textarea></div>
      <div class="grid two">
        <div class="field"><label>Activity</label><input name="activity" value="Sunset farm visit" required></div>
        <div class="field"><label>Price AED</label><input name="price" type="number" value="85" required></div>
      </div>
      <div class="field"><label>Best timing</label><input name="bestTime" value="Late afternoon through sunset" required></div>
      <div class="field"><label>Listing image</label><input name="photo" type="file" accept="image/*" required></div>
      ${locationSection}
      <button class="primary-btn" type="submit">${buttonLabel}</button>
    </form>
  `;
}

function settingsView() {
  const displayRoles = state.user.roles.includes("farmer") ? "farmer" : state.user.roles.join(", ");
  return `
    <div class="card"><div class="card-body">
      <h2>Account</h2>
      <p class="muted">Name: ${state.user.name}</p>
      <p class="muted">Email: ${state.user.email || "Not set"}</p>
      <p class="muted">Current roles: ${displayRoles}</p>
      ${state.user.providerType ? `<p class="muted">Provider type: ${providerTypeLabel(state.user.providerType)}</p>` : ""}
      <p class="muted">Roles are selected during registration.</p>
    </div></div>
  `;
}

function spaceNoteView() {
  if (!state.signedIn || state.screen === "welcome") return "";
  return `
    <footer class="space-note">
      <p data-space-note>${spaceNotes[state.quoteIndex]}</p>
    </footer>
  `;
}

function astronomyEventPopup() {
  if (!astronomicalEvents.length) return "";
  const events = [...astronomicalEvents].sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  if (!state.astronomyPopupOpen) {
    return `
      <button class="astronomy-popup-collapsed" data-action="openAstronomyPopup" aria-label="Show upcoming astronomical events">
        <span class="astronomy-popup-collapsed-icon">✦</span>
        <span>Upcoming sky events</span>
        <span class="astronomy-popup-collapsed-arrow">↑</span>
      </button>
    `;
  }
  const event = events[state.astronomyEventIndex % events.length];
  return `
    <aside class="astronomy-popup" aria-label="Upcoming astronomical event">
      <button class="astronomy-popup-close" data-action="closeAstronomyPopup" aria-label="Close astronomical events">×</button>
      <div class="astronomy-popup-image" style="background-image:url('${event.image}')">
        <span>Upcoming sky event</span>
      </div>
      <div class="astronomy-popup-body">
        <h3>${event.title}</h3>
        <div class="astronomy-popup-time">
          <strong>${event.date}</strong>
          <span>${event.time}</span>
        </div>
        <p>${event.info}</p>
        <div class="astronomy-popup-footer">
          <div class="astronomy-popup-nav">
            <button class="icon-btn" data-action="previousAstronomyEvent" aria-label="Previous event">‹</button>
            <span>${state.astronomyEventIndex + 1} / ${events.length}</span>
            <button class="icon-btn" data-action="nextAstronomyEvent" aria-label="Next event">›</button>
          </div>
          <a class="text-link" href="${event.sourceUrl}" target="_blank" rel="noreferrer">${event.sourceLabel}</a>
        </div>
      </div>
    </aside>
  `;
}

function modalView() {
  if (state.screen !== "detail") return "";
  const listing = listings.find((item) => item.id === state.selectedListingId) || listings[0];
  return `
    <div class="modal">
      <div class="modal-panel listing-detail-panel">
        <div class="row" style="justify-content: space-between;">
          <h2>${listing.title}</h2>
          <button class="icon-btn" data-action="closeDetail">x</button>
        </div>
        <div class="listing-img" style="background-image: url('${listing.photo}')"></div>
        <p class="business-byline">Hosted by <strong>${listing.businessName || listing.ownerName}</strong> · ${listing.businessType || "Local farmer/business"}</p>
        ${listing.expertise ? `<p class="muted"><strong>Guide expertise:</strong> ${listing.expertise}</p>` : ""}
        ${listing.specialties ? `<p class="muted"><strong>Business specialties:</strong> ${listing.specialties}</p>` : ""}
        ${listing.priceRange ? `<p class="muted"><strong>Food/product price range:</strong> AED ${listing.priceRange.min}–${listing.priceRange.max}</p>` : ""}
        <p class="muted" style="margin-top: 14px;">${listing.description}</p>
        <div class="grid two listing-facts">
          <div class="stat"><strong>${listing.duration || "Flexible"}</strong>Typical experience length</div>
          <div class="stat"><strong>${listing.bestTime || "Ask host"}</strong>Best timing</div>
        </div>
        <div class="pill-row" style="margin: 14px 0;">
          ${(listing.includes || ["Local host", "Mapped safe zone"]).map((item) => `<span class="pill">${item}</span>`).join("")}
          <span class="pill safe-pill">Stay inside the blue safe zone</span>
        </div>
        <div class="grid">
          ${listing.activities
            .map(
              (activity) => `
                <div class="stat">
                  <strong>AED ${activity.price}</strong>
                  ${activity.name}
                  <p class="muted">${activity.duration || listing.duration || "Flexible duration"} · Best: ${activity.bestTime || listing.bestTime || "Ask host"}</p>
                  <div class="actions" style="margin-top: 10px;">
                    ${activity.slots.map((slot) => `<button class="secondary-btn" data-book-intent="${listing.id}" data-activity="${activity.id}" data-slot="${slot}">${slot}</button>`).join("")}
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function bookingConfirmView() {
  if (!state.pendingBooking) return "";
  const listing = listings.find((item) => item.id === state.pendingBooking.listingId) || listings[0];
  return `
    <div class="modal">
      <div class="modal-panel">
        <h2>Confirm booking?</h2>
        <p class="muted">You are about to book ${state.pendingBooking.activity.name} at ${listing.title} for ${state.pendingBooking.slot}.</p>
        <p class="muted">Cost: AED ${state.pendingBooking.activity.price}</p>
        ${state.replacesBookingId ? `<p class="auth-error">Your existing booking at this time will be removed after the new booking is saved.</p>` : ""}
        <div class="actions">
          <button class="primary-btn" data-action="confirmBooking">Yes, book it</button>
          <button class="secondary-btn" data-action="cancelBooking">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function bookingRemovalView() {
  if (!state.pendingBookingRemoval) return "";
  const booking = state.bookings.find((item) => item.id === state.pendingBookingRemoval);
  if (!booking) return "";
  const listing = listings.find((item) => item.id === booking.listingId) || listings[0];
  return `
    <div class="modal">
      <div class="modal-panel removal-confirm-panel">
        <div class="removal-icon">?</div>
        <h2>Remove this booking?</h2>
        <p>You are about to cancel <strong>${booking.activityName}</strong> at ${listing.title}.</p>
        <div class="removal-booking-note">
          You’ll miss ${booking.duration || "a memorable local experience"} with
          ${booking.businessName || listing.businessName || listing.ownerName}—and this booking directly supports a local Al Qua’a host.
        </div>
        <p class="muted">Your reserved ${booking.slot} slot will be released. This cannot be undone.</p>
        <div class="actions removal-actions">
          <button class="secondary-btn" data-action="cancelBookingRemoval">Keep my booking</button>
          <button class="danger-btn" data-action="confirmBookingRemoval">Yes, remove it</button>
        </div>
      </div>
    </div>
  `;
}

function listingSaveConfirmationView() {
  const listing = state.listingSaveConfirmation;
  if (!listing) return "";
  return `
    <div class="modal">
      <div class="modal-panel listing-save-confirmation">
        <div class="listing-save-check">✓</div>
        <div class="eyebrow">Firebase confirmed</div>
        <h2>Listing published</h2>
        <p><strong>${listing.title}</strong> is now saved for ${listing.businessName}.</p>
        <div class="grid two listing-save-facts">
          <div class="stat"><strong>${listing.activities.length}</strong>Activity published</div>
          <div class="stat"><strong>${listing.safeZone.length}</strong>Safe-zone points saved</div>
        </div>
        <p class="muted">Tourists receive this listing through the live Firebase marketplace feed and can now view its location, safe zone, times, and price.</p>
        <button class="primary-btn" data-action="closeListingConfirmation">Done</button>
      </div>
    </div>
  `;
}

function bookingConflictView() {
  if (!state.bookingConflict) return "";
  const { existing, pending } = state.bookingConflict;
  const existingListing = listings.find((item) => item.id === existing.listingId) || listings[0];
  const selectedListing = listings.find((item) => item.id === pending.listingId) || listings[0];
  const occupiedSlots = new Set(
    state.bookings
      .filter((booking) => booking.status !== "completed" && booking.status !== "cancelled")
      .map((booking) => booking.slot),
  );
  const alternatives = pending.activity.slots.filter((slot) => slot !== pending.slot && !occupiedSlots.has(slot));
  return `
    <div class="modal">
      <div class="modal-panel listing-detail-panel">
        <div class="row" style="justify-content: space-between;">
          <div>
            <h2 style="margin-bottom: 4px;">That time is already booked</h2>
            <p class="muted" style="margin: 0;">You already have an activity at ${pending.slot}.</p>
          </div>
          <button class="icon-btn" data-action="closeBookingConflict">x</button>
        </div>
        <div class="conflict-comparison">
          <div class="stat conflict-existing">
            <span class="eyebrow">Current booking</span>
            <strong>${existing.activityName}</strong>
            <p>${existingListing.title} · ${existing.businessName || existingListing.businessName || existingListing.ownerName}</p>
            <span>${existing.slot} · AED ${existing.price}</span>
          </div>
          <div class="stat conflict-new">
            <span class="eyebrow">New choice</span>
            <strong>${pending.activity.name}</strong>
            <p>${selectedListing.title} · ${selectedListing.businessName || selectedListing.ownerName}</p>
            <span>${pending.slot} · AED ${pending.activity.price}</span>
          </div>
        </div>
        <div class="conflict-alternatives">
          <h3>Choose another available time</h3>
          <div class="actions">
            ${alternatives.length
              ? alternatives.map((slot) => `<button class="secondary-btn" data-conflict-alternate="${slot}">${slot}</button>`).join("")
              : `<p class="muted">No other open times are listed for this activity.</p>`}
          </div>
        </div>
        <div class="actions conflict-actions">
          <button class="primary-btn" data-action="replaceConflictingBooking">Switch to the new booking</button>
          <button class="secondary-btn" data-action="closeBookingConflict">Keep current booking</button>
        </div>
      </div>
    </div>
  `;
}

function planBookingView() {
  if (!state.planBookingOpen) return "";
  return `
    <div class="modal">
      <div class="modal-panel listing-detail-panel">
        <div class="row" style="justify-content: space-between;">
          <div>
            <h2 style="margin-bottom: 4px;">Choose suggested activities</h2>
            <p class="muted" style="margin: 0;">Select everything you want to book. Plan budget: AED ${state.planBudget}.</p>
          </div>
          <button class="icon-btn" data-action="closePlanBookings">x</button>
        </div>
        <div class="plan-booking-options">
          ${state.planSuggestions
            .map((suggestion, index) => {
              const listing = listings.find((item) => item.id === suggestion.listingId);
              return `
                <label class="plan-booking-option">
                  <div>
                    <strong>${suggestion.activity.name}</strong>
                    <p>${listing.title} · ${listing.businessName || listing.ownerName}</p>
                    <span>${suggestion.slot} · ${suggestion.activity.duration || listing.duration} · AED ${suggestion.activity.price}</span>
                  </div>
                  <input type="checkbox" data-plan-booking-choice value="${index}">
                </label>
              `;
            })
            .join("")}
        </div>
        <div class="plan-booking-summary">
          <span>Total selected</span>
          <strong data-plan-booking-total>AED 0</strong>
          <small class="muted" data-plan-booking-budget>Select at least one activity.</small>
        </div>
        <div class="actions">
          <button class="primary-btn" data-action="confirmPlanBookings" disabled>Book selected activities</button>
          <button class="secondary-btn" data-action="closePlanBookings">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function wireLanguageToggle() {
  app.querySelector('[data-action="toggleLanguage"]')?.addEventListener("click", () => {
    state.language = state.language === "ar" ? "en" : "ar";
    localStorage.setItem("duroob.language", state.language);
    if (window.google?.maps && state.authProvider === "firebase") {
      window.location.reload();
      return;
    }
    render();
  });
}

function wireWelcome() {
  wireLanguageToggle();
  app.querySelector("[data-auth-mode]")?.addEventListener("click", (event) => {
    setState({ authMode: event.currentTarget.dataset.authMode, authError: "" });
  });
  app.querySelector("[data-auth-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = localize("Please wait...");
    try {
      const form = new FormData(event.currentTarget);
      if (state.authMode === "register") await registerWithPassword(form);
      else await signInWithPassword(form);
    } catch (error) {
      console.warn(error);
      setState({ authError: error?.message || "Authentication failed. Please try again." });
    } finally {
      if (!state.signedIn && button.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });
}

function wireApp() {
  wireLanguageToggle();
  app.querySelector('[data-action="closeAstronomyPopup"]')?.addEventListener("click", () => {
    setState({ astronomyPopupOpen: false });
  });
  app.querySelector('[data-action="openAstronomyPopup"]')?.addEventListener("click", () => {
    setState({ astronomyPopupOpen: true });
  });
  app.querySelector('[data-action="previousAstronomyEvent"]')?.addEventListener("click", () => {
    setState({
      astronomyEventIndex:
        (state.astronomyEventIndex - 1 + astronomicalEvents.length) % astronomicalEvents.length,
    });
  });
  app.querySelector('[data-action="nextAstronomyEvent"]')?.addEventListener("click", () => {
    setState({ astronomyEventIndex: (state.astronomyEventIndex + 1) % astronomicalEvents.length });
  });
  app.querySelector('[data-action="closeListingConfirmation"]')?.addEventListener("click", () => {
    setState({ listingSaveConfirmation: null });
  });
  app.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      if (mustCompletePledge()) {
        setState({ screen: "safety" });
        return;
      }
      setState({ screen: button.dataset.screen });
    });
  });
  app.querySelector('[data-action="logout"]')?.addEventListener("click", async () => {
    try {
      if (state.authProvider === "firebase") await logoutFirebaseUser();
    } catch (error) {
      console.warn(error);
    }
    unsubscribeListings?.();
    unsubscribeBookings?.();
    setState({ signedIn: false, screen: "welcome", uid: null, bookings: [], firebaseStatus: "Not connected", authProvider: null });
  });
  app.querySelectorAll("[data-listing]").forEach((button) => {
    button.addEventListener("click", () => setState({ selectedListingId: button.dataset.listing, screen: "map" }));
  });
  app.querySelectorAll("[data-listing-detail]").forEach((button) => {
    button.addEventListener("click", () => setState({ selectedListingId: button.dataset.listingDetail, screen: "detail" }));
  });
  app.querySelectorAll("[data-focus-listing]").forEach((button) => {
    button.addEventListener("click", () => {
      const listingId = button.dataset.focusListing;
      setState({ selectedListingId: listingId, focusedMapListingId: listingId, screen: "map" });
      window.requestAnimationFrame(() => {
        app.querySelector("[data-map]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  });
  app.querySelector('[data-action="openDetail"]')?.addEventListener("click", () => setState({ screen: "detail" }));
  app.querySelector('[data-action="closeDetail"]')?.addEventListener("click", () => setState({ screen: "map" }));
  app.querySelector('[data-action="nextSafety"]')?.addEventListener("click", () => setState({ safetySlide: state.safetySlide + 1 }));
  app.querySelector('[data-action="prevSafety"]')?.addEventListener("click", () => setState({ safetySlide: state.safetySlide - 1 }));
  app.querySelector('[data-action="acceptSafety"]')?.addEventListener("click", () => {
    const checked = Boolean(app.querySelector("[data-safety-check]")?.checked);
    if (!checked) return localizedAlert("Please confirm the safety pledge first.");
    const user = { ...state.user, safetyPledgeAccepted: true };
    persistUserProfile(user);
    setState({ user, screen: "map" });
  });
  app.querySelector("[data-create-listing]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveFarmerListing(event.currentTarget);
  });
  app.querySelector("[data-plan-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    generateItinerary(data.get("arrival"), Number(data.get("budget")), String(data.get("preferences") || ""));
  });
  app.querySelectorAll("[data-book-intent], [data-quick-book]").forEach((button) => {
    button.addEventListener("click", () => prepareBooking(button));
  });
  app.querySelector('[data-action="openPlanBookings"]')?.addEventListener("click", () => setState({ planBookingOpen: true }));
  app.querySelectorAll('[data-action="closePlanBookings"]').forEach((button) => {
    button.addEventListener("click", () => setState({ planBookingOpen: false }));
  });
  app.querySelectorAll("[data-plan-booking-choice]").forEach((checkbox) => {
    checkbox.addEventListener("change", updatePlanBookingTotal);
  });
  app.querySelector('[data-action="confirmPlanBookings"]')?.addEventListener("click", (event) => {
    createPlanBookings(event.currentTarget);
  });
  app.querySelector('[data-action="confirmBooking"]')?.addEventListener("click", (event) => createBooking(event.currentTarget));
  app.querySelector('[data-action="cancelBooking"]')?.addEventListener("click", () => setState({ pendingBooking: null, replacesBookingId: null }));
  app.querySelectorAll('[data-action="closeBookingConflict"]').forEach((button) => {
    button.addEventListener("click", () => setState({ bookingConflict: null }));
  });
  app.querySelectorAll("[data-conflict-alternate]").forEach((button) => {
    button.addEventListener("click", () => {
      const pending = state.bookingConflict?.pending;
      if (!pending) return;
      setState({
        bookingConflict: null,
        replacesBookingId: null,
        pendingBooking: { ...pending, slot: button.dataset.conflictAlternate },
      });
    });
  });
  app.querySelector('[data-action="replaceConflictingBooking"]')?.addEventListener("click", () => {
    if (!state.bookingConflict) return;
    setState({
      pendingBooking: state.bookingConflict.pending,
      replacesBookingId: state.bookingConflict.existing.id,
      bookingConflict: null,
    });
  });
  app.querySelectorAll("[data-delete-booking]").forEach((button) => {
    button.addEventListener("click", () => setState({ pendingBookingRemoval: button.dataset.deleteBooking }));
  });
  app.querySelector('[data-action="cancelBookingRemoval"]')?.addEventListener("click", () => {
    setState({ pendingBookingRemoval: null });
  });
  app.querySelector('[data-action="confirmBookingRemoval"]')?.addEventListener("click", (event) => {
    removeBooking(event.currentTarget);
  });
  app.querySelector('[data-action="clearSafeZone"]')?.addEventListener("click", () => {
    setState({ newListingSafeZone: [], newListingLocation: alQuaaCenter });
  });
  installButtonHighlights();
  mountMapIfNeeded();
  mountLocationPickerIfNeeded();
  mountSafeZonePickerIfNeeded();
}

async function saveFarmerListing(form) {
  const button = form.querySelector("button[type='submit'], button:not([type])");
  if (!button) throw new Error("The listing form has no submit button.");
  const originalText = button.textContent;
  if (state.authProvider !== "firebase" || !state.uid) {
    localizedAlert("Provider listings require a connected Firebase account. Sign in again and retry.");
    return;
  }
  button.disabled = true;
  button.textContent = localize("Saving to Firebase...");
  const formData = new FormData(form);
  const file = formData.get("photo");
  const providerType = state.user.providerType || "farmer";
  const isFarmer = providerType === "farmer";
  if (isFarmer && state.newListingSafeZone.length < 3) {
    localizedAlert("Draw at least three boundary points around the farm before saving.");
    button.disabled = false;
    button.textContent = originalText;
    return;
  }
  const safeZone = isFarmer ? [...state.newListingSafeZone] : defaultSafeZone(state.newListingLocation || alQuaaCenter);
  const baseLocation = isFarmer ? polygonCenter(safeZone) : state.newListingLocation || alQuaaCenter;
  const listing = {
    businessId: `business-${state.uid}`,
    businessName: String(formData.get("businessName") || state.user.name).trim(),
    businessType: providerTypeLabel(providerType),
    providerType,
    expertise: String(formData.get("expertise") || "").trim(),
    specialties: String(formData.get("specialties") || "").trim(),
    priceRange:
      providerType === "localBusiness"
        ? { min: Number(formData.get("priceMin") || 0), max: Number(formData.get("priceMax") || 0) }
        : null,
    ownerId: state.uid,
    ownerName: state.user.name,
    ownerPhone: state.user.phone,
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    duration: String(formData.get("duration") || "").trim(),
    bestTime: String(formData.get("bestTime") || "").trim(),
    includes: [providerTypeLabel(providerType), "Visitor guidance", "Mapped safe zone"],
    photo: seedListings[0].photo,
    map: locationToFallbackMapPoint(baseLocation),
    location: baseLocation,
    safeZone,
    activities: [
      {
        id: `activity-${Date.now()}`,
        name: String(formData.get("activity") || "").trim(),
        price: Number(formData.get("price") || 0),
        duration: String(formData.get("duration") || "").trim(),
        bestTime: String(formData.get("bestTime") || "").trim(),
        slots: String(formData.get("slots") || "")
          .split(",")
          .map((slot) => slot.trim())
          .filter(Boolean),
      },
    ],
  };

  state.firebaseStatus = "Saving listing to Firebase...";

  try {
    if (file?.size) {
      try {
        listing.photo = await withTimeout(uploadListingImage(state.uid, file), authTimeoutMs, "Image upload timed out.");
      } catch (imageError) {
        console.warn("Could not upload listing image; saving listing with fallback image.", imageError);
      }
    }
    const id = await withTimeout(createListingRecord(listing), authTimeoutMs, "Listing save timed out.");
    const savedListing = { ...listing, id };
    listings = mergeListings([savedListing], listings);
    state.newListingLocation = alQuaaCenter;
    state.newListingSafeZone = [];
    setState({
      selectedListingId: id,
      screen: "listings",
      firebaseStatus: "Firebase connected",
      listingSaveConfirmation: savedListing,
    });
  } catch (error) {
    console.warn("Could not save listing to Firebase.", error);
    setState({ firebaseStatus: "Listing save failed" });
    localizedAlert(`Listing was not published: ${error?.message || "Firebase save failed."}`);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function generateItinerary(arrival, budget, preferences) {
  const result = app.querySelector("#planResult");
  state.planSuggestions = recommendPlanActivities(arrival, budget, preferences);
  state.planBudget = budget;
  state.planBookingOpen = false;
  state.planItinerary = null;
  state.planSource = null;
  result.innerHTML = `<h2>Suggested schedule</h2><p class="muted">Generating...</p>`;
  if (state.language === "ar") applyArabicUi(result);
  try {
    const response = await fetch("/api/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arrival, budget, preferences, listings, localSpots, language: state.language }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Planner failed.");
    setState({ planItinerary: payload.itinerary, planSource: payload.source });
    return;
  } catch (error) {
    console.warn(error);
    result.innerHTML = `<h2>Suggested schedule</h2>${itineraryHtml(arrival, budget, preferences)}`;
    if (state.language === "ar") applyArabicUi(result);
  }
  wireApp();
}

function planTextHtml(text) {
  return `<div class="grid">${String(text)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `<div class="stat plan-line">${escapeHtml(line)}</div>`)
    .join("")}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function prepareBooking(button) {
  const listingId = button.dataset.bookIntent || button.dataset.quickBook;
  const listing = listings.find((item) => item.id === listingId);
  const activity = listing.activities.find((item) => item.id === button.dataset.activity) || listing.activities[0];
  const slot = button.dataset.slot || activity.slots[0];
  const pending = { listingId, activity, slot };
  let conflict = state.bookings.find(
    (booking) => booking.slot === slot && booking.status !== "completed" && booking.status !== "cancelled",
  );
  if (state.authProvider === "firebase" && state.uid) {
    try {
      conflict = await withTimeout(
        findBookingConflict(state.uid, slot),
        authTimeoutMs,
        "Booking conflict check timed out.",
      );
    } catch (error) {
      console.warn("Could not verify the time slot with Firebase; using loaded bookings.", error);
    }
  }
  if (conflict) {
    setState({ bookingConflict: { existing: conflict, pending }, pendingBooking: null, replacesBookingId: null });
    return;
  }
  setState({ pendingBooking: pending, bookingConflict: null, replacesBookingId: null });
}

async function createBooking(button) {
  const pending = state.pendingBooking;
  if (!pending) return;
  const replacementId = state.replacesBookingId;
  const originalText = button?.textContent || "Yes, book it";
  if (button) {
    button.disabled = true;
    button.textContent = localize("Saving to Firebase...");
  }

  try {
    const savedBooking = await savePendingBooking(pending, replacementId);
    let replacementRemoved = false;
    if (replacementId) {
      try {
        await withTimeout(
          deleteBookingRecord(
            state.uid,
            replacementId,
            state.bookings.find((booking) => booking.id === replacementId)?.ownerId,
          ),
          authTimeoutMs,
          "The old booking removal timed out.",
        );
        replacementRemoved = true;
      } catch (replacementError) {
        console.warn("New booking saved, but the old booking could not be removed.", replacementError);
        localizedAlert("The new booking was saved, but the old booking could not be removed. Remove it manually from My bookings.");
      }
    }
    state.bookings = [
      savedBooking,
      ...state.bookings.filter(
        (item) => item.id !== savedBooking.id && (!replacementRemoved || item.id !== replacementId),
      ),
    ];
    setState({
      screen: "bookings",
      pendingBooking: null,
      replacesBookingId: null,
      firebaseStatus: "Firebase connected",
    });
  } catch (error) {
    console.warn("Could not save booking to Firebase.", error);
    const errorDetails = [error?.code, error?.message].filter(Boolean).join(": ");
    localizedAlert(`Booking was not saved: ${errorDetails || "Firebase write failed."}`);
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function savePendingBooking(pending, excludeConflictId = null) {
  if (state.authProvider !== "firebase" || !state.uid) {
    throw new Error("Bookings require a Firebase account. Reconnect and sign in again.");
  }
  const listing = listings.find((item) => item.id === pending.listingId);
  if (!listing || !pointInPolygon(listing.location, listing.safeZone)) {
    throw new Error("The booking point is outside the farmer safe zone.");
  }
  if (!listing.ownerId || !(listing.businessName || listing.ownerName)) {
    throw new Error("This experience has no registered farmer, business, or guide and cannot be booked.");
  }
  const conflict = await findBookingConflict(state.uid, pending.slot, excludeConflictId);
  if (conflict) {
    const error = new Error(`You already have ${conflict.activityName} booked at ${pending.slot}.`);
    error.code = "booking/time-conflict";
    throw error;
  }
  const activity = pending.activity;
  const booking = {
    touristId: state.uid,
    ownerId: listing.ownerId,
    businessId: listing.businessId || listing.ownerId,
    businessName: listing.businessName || listing.ownerName,
    listingId: listing.id,
    activityName: activity.name,
    slot: pending.slot,
    price: activity.price,
    duration: activity.duration || listing.duration,
    bestTime: activity.bestTime || listing.bestTime,
    status: "upcoming",
    touristName: state.user.name,
    touristPhone: state.user.phone,
    touristLocation: {
      lat: listing.location.lat - 0.002,
      lng: listing.location.lng + 0.002,
    },
  };
  const firebaseId = await withTimeout(
    createBookingRecord(state.uid, booking),
    authTimeoutMs,
    "Booking save timed out.",
  );
  updateLiveLocation(firebaseId, booking.touristLocation).catch((error) => {
    console.warn("Booking saved, but live location could not be initialized.", error);
  });
  return { ...booking, id: firebaseId };
}

async function removeBooking(button) {
  const bookingId = state.pendingBookingRemoval;
  const booking = state.bookings.find((item) => item.id === bookingId);
  if (!booking || booking.touristId !== state.uid) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = localize("Removing...");
  try {
    await withTimeout(
      deleteBookingRecord(state.uid, bookingId, booking.ownerId),
      authTimeoutMs,
      "Booking removal timed out.",
    );
    state.bookings = state.bookings.filter((item) => item.id !== bookingId);
    state.pendingBookingRemoval = null;
    render();
  } catch (error) {
    console.warn("Could not remove booking.", error);
    localizedAlert(`Booking was not removed: ${error?.message || "Firebase delete failed."}`);
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function updatePlanBookingTotal() {
  const checked = [...app.querySelectorAll("[data-plan-booking-choice]:checked")];
  const total = checked.reduce(
    (sum, checkbox) => sum + Number(state.planSuggestions[Number(checkbox.value)]?.activity.price || 0),
    0,
  );
  const totalElement = app.querySelector("[data-plan-booking-total]");
  const budgetElement = app.querySelector("[data-plan-booking-budget]");
  const confirmButton = app.querySelector('[data-action="confirmPlanBookings"]');
  if (totalElement) totalElement.textContent = localize(`AED ${total}`);
  if (budgetElement) {
    budgetElement.textContent = localize(total > state.planBudget
      ? `AED ${total - state.planBudget} over the plan budget.`
      : `AED ${state.planBudget - total} remaining from the plan budget.`);
  }
  if (confirmButton) confirmButton.disabled = checked.length === 0 || total > state.planBudget;
}

async function createPlanBookings(button) {
  const selected = [...app.querySelectorAll("[data-plan-booking-choice]:checked")]
    .map((checkbox) => state.planSuggestions[Number(checkbox.value)])
    .filter(Boolean);
  if (!selected.length) return;
  const total = selected.reduce((sum, item) => sum + Number(item.activity.price || 0), 0);
  if (total > state.planBudget) return localizedAlert("The selected activities exceed the plan budget.");

  button.disabled = true;
  button.textContent = localize("Saving bookings to Firebase...");
  const saved = [];
  const failed = [];
  for (const suggestion of selected) {
    try {
      saved.push(await savePendingBooking(suggestion));
    } catch (error) {
      failed.push(error);
    }
  }
  const merged = new Map(state.bookings.map((booking) => [booking.id, booking]));
  saved.forEach((booking) => merged.set(booking.id, booking));
  state.bookings = [...merged.values()];

  if (failed.length) {
    const firstError = failed[0]?.message || "Firebase write failed.";
    localizedAlert(`${saved.length} booking(s) saved; ${failed.length} failed: ${firstError}`);
  }
  setState({
    screen: saved.length ? "bookings" : "plan",
    planBookingOpen: false,
    firebaseStatus: saved.length ? "Firebase connected" : state.firebaseStatus,
  });
}

function mountMapIfNeeded() {
  const container = app.querySelector("[data-google-map]");
  if (!container) return;
  mountGoogleMap(container, {
    center: alQuaaCenter,
    listings,
    localSpots,
    highlightedListingId: state.focusedMapListingId,
    onListingSelect: (listingId, openDetails = false) =>
      setState({ selectedListingId: listingId, focusedMapListingId: listingId, screen: openDetails ? "detail" : "map" }),
  }).catch((error) => {
    console.warn(error);
    container.innerHTML = fallbackMapHtml();
    container.querySelectorAll("[data-listing]").forEach((button) => {
      button.addEventListener("click", () => setState({ selectedListingId: button.dataset.listing, screen: "map" }));
    });
    container.querySelectorAll("[data-listing-detail]").forEach((button) => {
      button.addEventListener("click", () => setState({ selectedListingId: button.dataset.listingDetail, screen: "detail" }));
    });
  });
}

function mountLocationPickerIfNeeded() {
  const container = app.querySelector("[data-location-picker]");
  if (!container) return;
  mountLocationPicker(container, {
    center: alQuaaCenter,
    initialLocation: state.newListingLocation,
    onPick: (location) => {
      state.newListingLocation = location;
      const label = app.querySelector("[data-location-label]");
      if (label) label.textContent = localize(`Selected: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
    },
  }).catch((error) => {
    console.warn(error);
    container.innerHTML = `<button class="pin" style="left:50%;top:50%;" type="button"><span>1</span></button>`;
  });
}

function mountSafeZonePickerIfNeeded() {
  const container = app.querySelector("[data-safe-zone-picker]");
  if (!container) return;
  mountSafeZonePicker(container, {
    center: state.newListingLocation || alQuaaCenter,
    initialPoints: state.newListingSafeZone,
    onChange: (points) => {
      state.newListingSafeZone = points;
      if (points.length) state.newListingLocation = polygonCenter(points);
      const label = app.querySelector("[data-safe-zone-label]");
      if (label) {
        label.textContent = localize(points.length >= 3
          ? `${points.length} boundary points selected · polygon ready to save`
          : `${points.length} boundary points selected · add ${3 - points.length} more`);
      }
    },
  }).catch((error) => {
    console.warn(error);
    container.innerHTML = `<p class="auth-error">${localize("Google Maps could not load. The farm boundary cannot be saved yet.")}</p>`;
  });
}

function fallbackMapHtml() {
  return `
    ${listings.map((listing) => zoneView(listing)).join("")}
    ${listings
      .map(
        (listing, index) =>
          `<button class="pin" style="left:${listing.map?.x || 50}%;top:${listing.map?.y || 50}%;" data-listing="${listing.id}" title="${listing.title}"><span>${index + 1}</span></button>`,
      )
      .join("")}
    ${localSpots
      .map((spot) => `<button class="pin shop" style="left:${spot.x}%;top:${spot.y}%;" title="${spot.name}"><span>${spot.type[0]}</span></button>`)
      .join("")}
  `;
}

function readableAuthError(error) {
  const code = error?.code || "";
  if (code.includes("configuration-not-found")) {
    return "Firebase Authentication is not configured for this project yet. Enable Email/Password in Firebase console, or use the local fallback that activates automatically for new attempts.";
  }
  if (code.includes("email-already-in-use")) return "That email is already registered. Sign in instead.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Email or password is incorrect.";
  if (code.includes("operation-not-allowed")) return "Enable Email/Password sign-in in Firebase Authentication.";
  return error?.message || "Authentication failed. Please try again.";
}

function shouldUseLocalAuthFallback(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return (
    code.includes("configuration-not-found") ||
    code.includes("network-request-failed") ||
    code.includes("permission-denied") ||
    message.includes("timed out") ||
    message.includes("Failed to fetch")
  );
}

function getLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(localAuthStorageKey) || "[]");
  } catch {
    return [];
  }
}

function saveLocalUsers(users) {
  localStorage.setItem(localAuthStorageKey, JSON.stringify(users));
}

function registerLocalUser(profile) {
  const users = getLocalUsers();
  const existing = users.find((user) => user.email.toLowerCase() === profile.email.toLowerCase());
  if (existing) return existing;
  const user = {
    id: profile.id || `local-${Date.now()}`,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    password: profile.password,
    roles: profile.roles,
    providerType: profile.providerType || null,
    safetyPledgeAccepted: false,
  };
  saveLocalUsers([...users, user]);
  return user;
}

function loginLocalUser(email, password) {
  return getLocalUsers().find(
    (user) => user.email.toLowerCase() === email.trim().toLowerCase() && user.password === password,
  );
}

function persistUserProfile(user) {
  if (state.firebaseStatus === "Firebase connected" && state.uid) {
    saveUserProfile(state.uid, user).catch((error) => console.warn(error));
    return;
  }
  const users = getLocalUsers();
  const nextUsers = users.map((item) => (item.id === state.uid ? { ...item, ...user } : item));
  saveLocalUsers(nextUsers);
}

function mustCompletePledge() {
  return state.activeRole === "tourist" && !state.user.safetyPledgeAccepted;
}

function loadLocalBookings(uid) {
  try {
    const allBookings = JSON.parse(localStorage.getItem(localBookingsStorageKey) || "[]");
    return allBookings.filter((booking) => booking.touristId === uid || booking.ownerId === uid);
  } catch {
    return [];
  }
}

function saveLocalBooking(booking) {
  try {
    const allBookings = JSON.parse(localStorage.getItem(localBookingsStorageKey) || "[]");
    const nextBookings = [booking, ...allBookings.filter((item) => item.id !== booking.id)];
    localStorage.setItem(localBookingsStorageKey, JSON.stringify(nextBookings));
  } catch {
    localStorage.setItem(localBookingsStorageKey, JSON.stringify([booking]));
  }
}

function loadLocalListings() {
  try {
    return JSON.parse(localStorage.getItem(localListingsStorageKey) || "[]");
  } catch {
    return [];
  }
}

function saveLocalListing(listing) {
  const localListings = loadLocalListings();
  const nextListings = [listing, ...localListings.filter((item) => item.id !== listing.id)];
  localStorage.setItem(localListingsStorageKey, JSON.stringify(nextListings));
}

function replaceLocalListing(oldId, listing) {
  const localListings = loadLocalListings();
  const nextListings = [listing, ...localListings.filter((item) => item.id !== oldId && item.id !== listing.id)];
  localStorage.setItem(localListingsStorageKey, JSON.stringify(nextListings));
}

function mergeListings(...groups) {
  const merged = new Map();
  groups.flat().forEach((listing) => {
    if (!listing?.id) return;
    merged.set(listing.id, { ...merged.get(listing.id), ...listing });
  });
  return [...merged.values()].map((listing) =>
    seedPhotoById.has(listing.id) ? { ...listing, photo: seedPhotoById.get(listing.id) } : listing,
  );
}

function bookingsForCurrentUser() {
  return state.bookings.filter((booking) => booking.touristId === state.uid);
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

async function getFirebaseProfileWithFallback(uid) {
  try {
    return await withTimeout(getUserProfile(uid), authTimeoutMs, "Firebase profile lookup timed out.");
  } catch (error) {
    console.warn("Could not load Firebase profile; continuing with auth user only.", error);
    return null;
  }
}

function syncLocalUserId(oldId, newId) {
  const users = getLocalUsers();
  const nextUsers = users.map((user) => (user.id === oldId ? { ...user, id: newId } : user));
  saveLocalUsers(nextUsers);
}

function defaultSafeZone(center) {
  return [
    { lat: center.lat + 0.004, lng: center.lng - 0.004 },
    { lat: center.lat + 0.004, lng: center.lng + 0.004 },
    { lat: center.lat - 0.004, lng: center.lng + 0.004 },
    { lat: center.lat - 0.004, lng: center.lng - 0.004 },
  ];
}

function polygonCenter(points) {
  if (!points?.length) return alQuaaCenter;
  return points.reduce(
    (center, point) => ({
      lat: center.lat + Number(point.lat) / points.length,
      lng: center.lng + Number(point.lng) / points.length,
    }),
    { lat: 0, lng: 0 },
  );
}

function locationToFallbackMapPoint(location) {
  const x = Math.max(18, Math.min(82, 50 + (location.lng - alQuaaCenter.lng) * 1200));
  const y = Math.max(18, Math.min(82, 50 - (location.lat - alQuaaCenter.lat) * 1200));
  return { x: Math.round(x), y: Math.round(y) };
}

function installButtonHighlights() {
  app.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.add("is-clicked");
      window.setTimeout(() => button.classList.remove("is-clicked"), 700);
    });
  });
}

window.setInterval(() => {
  if (!state.signedIn) return;
  state.quoteIndex = (state.quoteIndex + 1) % spaceNotes.length;
  updateSpaceNote();
}, 30000);

function updateSpaceNote() {
  const note = document.querySelector("[data-space-note]");
  if (!note) return;
  note.classList.remove("fade-note");
  void note.offsetWidth;
  note.textContent = localize(spaceNotes[state.quoteIndex]);
  note.classList.add("fade-note");
}

listings = mergeListings(seedListings, loadLocalListings());
initializeLoginScreen();
