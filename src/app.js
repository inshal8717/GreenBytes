import { alQuaaCenter, demoUser, listings as seedListings, localSpots, safetySlides } from "./data.js";
import {
  createBookingRecord,
  getUserProfile,
  loginUserAccount,
  logoutFirebaseUser,
  registerUserAccount,
  saveUserProfile,
  seedListingsIfEmpty,
  updateLiveLocation,
  watchAllBookings,
  watchListings,
} from "./firebaseService.js";
import { distanceLabel, pointInPolygon, safeZoneBox } from "./geo.js";
import { mountGoogleMap } from "./maps.js";

let listings = [...seedListings];
let unsubscribeListings = null;
let unsubscribeBookings = null;

const state = {
  user: { ...demoUser },
  uid: null,
  signedIn: false,
  activeRole: "tourist",
  screen: "welcome",
  selectedListingId: seedListings[0].id,
  skyOverlay: false,
  safetySlide: 0,
  authMode: "signin",
  authError: "",
  firebaseStatus: "Not connected",
  bookings: [
    {
      id: "b1",
      touristId: "demo-tourist",
      ownerId: "farmer-1",
      listingId: "l1",
      activityName: "Guided stargazing",
      slot: "19:30",
      price: 120,
      status: "active",
      touristName: "Rashi",
      touristPhone: "971501234567",
      touristLocation: { lat: 23.5322, lng: 55.6105 },
    },
  ],
};

const app = document.querySelector("#app");
const localAuthStorageKey = "alquaa.localUsers";
const authTimeoutMs = 8000;

function setState(patch) {
  Object.assign(state, patch);
  render();
}

async function registerWithPassword(form) {
  const role = form.get("role");
  const roles = role === "farmer" ? ["farmer", "tourist"] : ["tourist"];
  const profile = {
    name: String(form.get("name") || "").trim(),
    email: String(form.get("email") || "").trim(),
    phone: String(form.get("phone") || "").trim(),
    password: String(form.get("password") || ""),
    roles,
  };
  const mirroredLocalUser = registerLocalUser(profile);
  try {
    const firebaseUser = await withTimeout(registerUserAccount(profile), authTimeoutMs, "Firebase registration timed out.");
    syncLocalUserId(mirroredLocalUser.id, firebaseUser.uid);
    seedFirebaseListings();
    startFirebaseListeners();
    setState({
      uid: firebaseUser.uid,
      signedIn: true,
      activeRole: role,
      authError: "",
      firebaseStatus: "Firebase connected",
      user: { ...demoUser, ...profile, password: undefined, safetyPledgeAccepted: false },
      screen: role === "farmer" ? "farmerOnboarding" : "safety",
    });
  } catch (error) {
    if (shouldUseLocalAuthFallback(error)) {
      setState({
        uid: mirroredLocalUser.id,
        signedIn: true,
        activeRole: role,
        authError: "",
        firebaseStatus: "Local auth fallback",
        user: { ...demoUser, ...mirroredLocalUser, password: undefined },
        screen: role === "farmer" ? "farmerOnboarding" : "safety",
      });
      return;
    }
    setState({ authError: readableAuthError(error) });
  }
}

async function signInWithPassword(form) {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const localUser = loginLocalUser(email, password);
  if (localUser) {
    setState({
      uid: localUser.id,
      signedIn: true,
      activeRole: localUser.roles.includes("farmer") ? "farmer" : "tourist",
      authError: "",
      firebaseStatus: "Local auth fallback",
      user: { ...demoUser, ...localUser, password: undefined },
      screen: localUser.safetyPledgeAccepted ? "map" : "safety",
    });
    return;
  }

  try {
    const firebaseUser = await withTimeout(loginUserAccount(email, password), authTimeoutMs, "Firebase sign-in timed out.");
    const profile = await getFirebaseProfileWithFallback(firebaseUser.uid);
    const user = {
      ...demoUser,
      id: firebaseUser.uid,
      name: profile?.name || firebaseUser.displayName || email.split("@")[0],
      email,
      phone: profile?.phone || demoUser.phone,
      roles: profile?.roles?.length ? profile.roles : ["tourist"],
      safetyPledgeAccepted: Boolean(profile?.safetyPledgeAccepted),
    };
    seedFirebaseListings();
    startFirebaseListeners();
    setState({
      uid: firebaseUser.uid,
      signedIn: true,
      activeRole: user.roles.includes("farmer") ? "farmer" : "tourist",
      authError: "",
      firebaseStatus: "Firebase connected",
      user,
      screen: user.safetyPledgeAccepted ? "map" : "safety",
    });
  } catch (error) {
    if (shouldUseLocalAuthFallback(error)) {
      setState({ authError: "No matching account found. Create an account first, then sign in with the same email and password." });
      return;
    }
    setState({ authError: readableAuthError(error) });
  }
}

function startFirebaseListeners() {
  unsubscribeListings?.();
  unsubscribeBookings?.();
  unsubscribeListings = watchListings(
    (items) => {
      listings = items.length ? items : [...seedListings];
      render();
    },
    (error) => console.warn("Could not watch listings.", error),
  );
  unsubscribeBookings = watchAllBookings(
    (items) => {
      if (items.length) state.bookings = items;
      render();
    },
    (error) => console.warn("Could not watch bookings.", error),
  );
}

function seedFirebaseListings() {
  seedListingsIfEmpty(seedListings).catch((error) => {
    console.warn("Could not seed listings.", error);
  });
}

function roleLabel() {
  return state.activeRole === "farmer" ? "Farmer / Guide" : "Tourist";
}

function pageTitle() {
  const titles = {
    map: "Al Qua'a map",
    plan: "Plan my evening",
    bookings: "My bookings",
    dashboard: "Farmer dashboard",
    listings: "My listings",
    settings: "Account settings",
    farmerOnboarding: "Create your first listing",
  };
  return titles[state.screen] || "Al Qua'a Tourism";
}

function render() {
  if (!state.signedIn || state.screen === "welcome") {
    app.innerHTML = welcomeView();
    wireWelcome();
    return;
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
            <button class="ghost-btn" data-action="logout">Log out</button>
          </div>
        </div>
        ${screenView()}
      </main>
    </div>
    ${modalView()}
  `;
  wireApp();
}

function welcomeView() {
  const isRegister = state.authMode === "register";
  return `
    <section class="hero">
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
            <label>Register as</label>
            <select name="role">
              <option value="tourist">Tourist</option>
              <option value="farmer">Farmer / Guide, also tourist</option>
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

function sidebarView() {
  const touristItems = [
    ["map", "Map"],
    ["plan", "Plan evening"],
    ["bookings", "My bookings"],
  ];
  const farmerItems = [
    ["dashboard", "Dashboard"],
    ["listings", "My listings"],
    ["map", "Book as tourist"],
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
  return `
    <div class="split">
      <form class="card" data-create-listing><div class="card-body">
        <h2>Farm or guide listing</h2>
        <div class="field"><label>Title</label><input value="New Al Qua'a hosting stop" required></div>
        <div class="field"><label>Description</label><textarea required>A visitor-friendly stop with a clear safe zone and evening activity slots.</textarea></div>
        <div class="grid two">
          <div class="field"><label>Activity</label><input value="Sunset farm visit" required></div>
          <div class="field"><label>Price AED</label><input type="number" value="85" required></div>
        </div>
        <div class="field"><label>Available slots</label><input value="17:30, 19:00" required></div>
        <button class="primary-btn">Save listing</button>
      </div></form>
      <div class="card"><div class="card-body">
        <h2>Safe zone preview</h2>
        <p class="muted">Production saves Google Maps polygon coordinates in Firestore.</p>
        ${miniMap(listings[1] || seedListings[1])}
      </div></div>
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
          <p class="muted">${selected.description}</p>
          <div class="listing-img" style="background-image: url('${selected.photo}')"></div>
          <div class="pill-row" style="margin: 14px 0;">
            ${selected.activities.map((a) => `<span class="pill">${a.name}</span>`).join("")}
          </div>
          <button class="primary-btn" data-action="openDetail">View and book</button>
        </div></div>
        <div class="card"><div class="card-body">
          <h3>Nearby spending stops</h3>
          ${localSpots.map((s) => `<p class="muted"><strong>${s.name}</strong><br>${s.type} | approx. AED ${s.price}</p>`).join("")}
        </div></div>
      </aside>
    </div>
  `;
}

function mainMapView() {
  return `
    <section class="map google-map-shell ${state.skyOverlay ? "sky" : ""}" data-map>
      <div id="googleMap" class="google-map-canvas" data-google-map></div>
      <div class="map-popup">
        <div class="row" style="justify-content: space-between;">
          <strong>Al Qua'a Google map</strong>
          <button class="icon-btn" data-action="toggleSky" title="Toggle sky overlay">*</button>
        </div>
        <p class="muted" style="margin-bottom: 0;">
          ${state.skyOverlay ? "Sky overlay on: the highlighted rectangle marks the stargazing context layer." : "Google Maps shows farms, safe-zone polygons, restaurants, and shops."}
        </p>
      </div>
    </section>
  `;
}

function zoneView(listing) {
  const box = safeZoneBox(listing.safeZone);
  return `<div class="safe-zone" style="left:${box.left}%;top:${box.top}%;width:${box.width}%;height:${box.height}%;"></div>`;
}

function miniMap(listing) {
  return `<div class="map" style="min-height: 260px;">${zoneView(listing)}<button class="pin" style="left:${listing.map?.x || 50}%;top:${listing.map?.y || 50}%;"><span>1</span></button></div>`;
}

function planView() {
  return `
    <div class="split">
      <form class="card" data-plan-form><div class="card-body">
        <h2>AI evening planner</h2>
        <div class="grid two">
          <div class="field"><label>Arrival time</label><input name="arrival" type="time" value="17:00"></div>
          <div class="field"><label>Budget AED</label><input name="budget" type="number" value="260"></div>
        </div>
        <button class="primary-btn">Generate plan</button>
        <p class="muted" style="margin: 14px 0 0;">This calls /api/itinerary. If GEMINI_API_KEY is not set, the backend returns a local fallback plan.</p>
      </div></form>
      <div class="card"><div class="card-body" id="planResult">
        <h2>Suggested schedule</h2>
        ${itineraryHtml("17:00", 260)}
      </div></div>
    </div>
  `;
}

function itineraryHtml(arrival, budget) {
  const affordable = listings
    .flatMap((listing) => listing.activities.map((activity) => ({ listing, activity })))
    .filter((item) => item.activity.price <= budget)
    .sort((a, b) => b.activity.price - a.activity.price)[0];
  const dinner = localSpots.find((spot) => spot.type === "Restaurant");
  if (!affordable) return `<p class="empty">No activity fits this budget yet.</p>`;
  return `
    <div class="grid">
      <div class="stat"><strong>${arrival}</strong> Arrive near Al Qua'a and collect water or snacks locally.</div>
      <div class="stat"><strong>18:30</strong> Dinner at ${dinner.name}, approx. AED ${dinner.price}.</div>
      <div class="stat"><strong>${affordable.activity.slots[0]}</strong> ${affordable.activity.name} at ${affordable.listing.title}, AED ${affordable.activity.price}.</div>
      <button class="primary-btn" data-quick-book="${affordable.listing.id}" data-activity="${affordable.activity.id}">Book suggested activity</button>
    </div>
  `;
}

function bookingsView() {
  return `
    <div class="grid">
      ${state.bookings.map(bookingCard).join("") || `<div class="empty">No bookings yet.</div>`}
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
      <div class="booking-actions">
        <a class="whatsapp-btn" href="https://wa.me/${listing.ownerPhone}" target="_blank" rel="noreferrer">Message on WhatsApp</a>
        <button class="secondary-btn" data-screen="map">View safe zone</button>
      </div>
    </div></div>
  `;
}

function dashboardView() {
  const active = state.bookings.filter((booking) => booking.status !== "completed");
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
  return `
    <div class="grid three">
      ${listings
        .map(
          (listing) => `
          <div class="card">
            <div class="listing-img" style="background-image: url('${listing.photo}')"></div>
            <div class="card-body">
              <h3>${listing.title}</h3>
              <p class="muted">${listing.activities.length} activities | safe zone mapped</p>
              <button class="secondary-btn" data-listing="${listing.id}">Preview</button>
            </div>
          </div>
        `,
        )
        .join("")}
    </div>
  `;
}

function settingsView() {
  return `
    <div class="card"><div class="card-body">
      <h2>Account</h2>
      <p class="muted">Name: ${state.user.name}</p>
      <p class="muted">Email: ${state.user.email || "Not set"}</p>
      <p class="muted">Current roles: ${state.user.roles.join(", ")}</p>
      <p class="muted">Roles are selected during registration.</p>
    </div></div>
  `;
}

function modalView() {
  if (state.screen !== "detail") return "";
  const listing = listings.find((item) => item.id === state.selectedListingId) || listings[0];
  return `
    <div class="modal">
      <div class="modal-panel">
        <div class="row" style="justify-content: space-between;">
          <h2>${listing.title}</h2>
          <button class="icon-btn" data-action="closeDetail">x</button>
        </div>
        <div class="listing-img" style="background-image: url('${listing.photo}')"></div>
        <p class="muted" style="margin-top: 14px;">${listing.description}</p>
        <div class="grid">
          ${listing.activities
            .map(
              (activity) => `
                <div class="stat">
                  <strong>AED ${activity.price}</strong>
                  ${activity.name}
                  <div class="actions" style="margin-top: 10px;">
                    ${activity.slots.map((slot) => `<button class="secondary-btn" data-book="${listing.id}" data-activity="${activity.id}" data-slot="${slot}">${slot}</button>`).join("")}
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

function wireWelcome() {
  app.querySelector("[data-auth-mode]")?.addEventListener("click", (event) => {
    setState({ authMode: event.currentTarget.dataset.authMode, authError: "" });
  });
  app.querySelector("[data-auth-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Please wait...";
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
  app.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => setState({ screen: button.dataset.screen }));
  });
  app.querySelector('[data-action="logout"]')?.addEventListener("click", async () => {
    try {
      if (state.firebaseStatus === "Firebase connected") await logoutFirebaseUser();
    } catch (error) {
      console.warn(error);
    }
    unsubscribeListings?.();
    unsubscribeBookings?.();
    setState({ signedIn: false, screen: "welcome", uid: null, firebaseStatus: "Not connected" });
  });
  app.querySelectorAll("[data-listing]").forEach((button) => {
    button.addEventListener("click", () => setState({ selectedListingId: button.dataset.listing, screen: "map" }));
  });
  app.querySelector('[data-action="toggleSky"]')?.addEventListener("click", () => setState({ skyOverlay: !state.skyOverlay }));
  app.querySelector('[data-action="openDetail"]')?.addEventListener("click", () => setState({ screen: "detail" }));
  app.querySelector('[data-action="closeDetail"]')?.addEventListener("click", () => setState({ screen: "map" }));
  app.querySelector('[data-action="nextSafety"]')?.addEventListener("click", () => setState({ safetySlide: state.safetySlide + 1 }));
  app.querySelector('[data-action="prevSafety"]')?.addEventListener("click", () => setState({ safetySlide: state.safetySlide - 1 }));
  app.querySelector('[data-action="acceptSafety"]')?.addEventListener("click", () => {
    const checked = Boolean(app.querySelector("[data-safety-check]")?.checked);
    if (!checked) return alert("Please confirm the safety pledge first.");
    const user = { ...state.user, safetyPledgeAccepted: true };
    persistUserProfile(user);
    setState({ user, screen: "map" });
  });
  app.querySelector("[data-create-listing]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    setState({ screen: "dashboard" });
  });
  app.querySelector("[data-plan-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    generateItinerary(data.get("arrival"), Number(data.get("budget")));
  });
  app.querySelectorAll("[data-book], [data-quick-book]").forEach((button) => {
    button.addEventListener("click", () => createBooking(button));
  });
  mountMapIfNeeded();
}

async function generateItinerary(arrival, budget) {
  const result = app.querySelector("#planResult");
  result.innerHTML = `<h2>Suggested schedule</h2><p class="muted">Generating...</p>`;
  try {
    const response = await fetch("/api/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arrival, budget, listings, localSpots }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Planner failed.");
    result.innerHTML = `<h2>Suggested schedule</h2>${planTextHtml(payload.itinerary)}<p class="muted">Source: ${payload.source}</p>`;
  } catch (error) {
    console.warn(error);
    result.innerHTML = `<h2>Suggested schedule</h2>${itineraryHtml(arrival, budget)}`;
  }
  wireApp();
}

function planTextHtml(text) {
  return `<div class="grid">${String(text)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `<div class="stat">${line}</div>`)
    .join("")}</div>`;
}

async function createBooking(button) {
  const listingId = button.dataset.book || button.dataset.quickBook;
  const listing = listings.find((item) => item.id === listingId);
  const activity = listing.activities.find((item) => item.id === button.dataset.activity) || listing.activities[0];
  const slot = button.dataset.slot || activity.slots[0];
  const pickupPoint = listing.location;

  if (!pointInPolygon(pickupPoint, listing.safeZone)) {
    alert("This booking point is outside the farmer safe zone.");
    return;
  }

  const booking = {
    id: `b${Date.now()}`,
    touristId: state.uid,
    ownerId: listing.ownerId,
    listingId,
    activityName: activity.name,
    slot,
    price: activity.price,
    status: "upcoming",
    touristName: state.user.name,
    touristPhone: state.user.phone,
    touristLocation: {
      lat: listing.location.lat - 0.002,
      lng: listing.location.lng + 0.002,
    },
  };

  try {
    const firebaseId = await createBookingRecord(booking);
    booking.id = firebaseId;
    await updateLiveLocation(firebaseId, booking.touristLocation);
  } catch (error) {
    console.warn("Could not save booking to Firebase; using local state.", error);
  }

  state.bookings = [booking, ...state.bookings];
  setState({ screen: "bookings" });
}

function mountMapIfNeeded() {
  const container = app.querySelector("[data-google-map]");
  if (!container) return;
  mountGoogleMap(container, {
    center: alQuaaCenter,
    listings,
    localSpots,
    skyOverlay: state.skyOverlay,
    onListingSelect: (listingId) => setState({ selectedListingId: listingId, screen: "map" }),
  }).catch((error) => {
    console.warn(error);
    container.innerHTML = fallbackMapHtml();
    container.querySelectorAll("[data-listing]").forEach((button) => {
      button.addEventListener("click", () => setState({ selectedListingId: button.dataset.listing, screen: "map" }));
    });
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

render();
