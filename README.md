# Duroob - Tourism for Al-Qua'a region
This repository is a submission for the Tatweer Hackathon, taking place in June 2026.
Duroob is a community platform for facilitating and promoting tourism in the Al-Qua'a region. It allows users to discover events and activities, for instance, stargazing and camel riding inthe  Al-Qua'a region.
# Al Qua’a Tourism Exchange

A tourism marketplace connecting visitors with farmers and local guides in Al Qua’a through safe stargazing, camel-farm, and desert experiences.

**Tatweer Hackathon 2026 — Challenge 5: Solve a Real Problem in Your Community**

* **Live demo:**
* **Demo video:** 

---

## The Problem

Al Qua’a attracts visitors because of its dark skies, but many tourists arrive, view the stars, and leave without contributing to the local economy.

Unmanaged night tourism may also lead to:

* Accidental entry into private farms.
* Tourists moving through unsafe desert areas.
* Litter that can harm camels and other animals.
* Limited access to local guides, farms, restaurants, and shops.

Our project creates a digital connection between tourists and local providers, allowing visitors to discover and book experiences inside safe visitor zones.

---

## Target Users

### Tourists

Visitors looking for safe and organised:

* Stargazing experiences.
* Camel-farm visits.
* Desert hospitality.
* Local restaurants and shops.

### Farmers and Guides

Local providers who want to:

* Publish tourism experiences.
* Set prices and available times.
* Receive bookings.
* Communicate directly with tourists.
* Earn additional income from existing tourism.
All specifically designed for the Al-Qua'a region.
---

## Implemented Features

### Authentication and Roles

Users can register or sign in as:

* Tourist.
* Farmer or guide.

A farmer account also receives tourist access, allowing providers to book experiences offered by other providers.

Firebase Email/Password Authentication is supported. A browser-based local fallback keeps the prototype usable when Firebase Authentication is unavailable.

### Mandatory Safety Pledge

Tourists must complete a three-step safety introduction before accessing the application.

It covers:

* Leaving no waste behind.
* Remaining inside marked visitor zones.
* Respecting farms, animals, and the desert environment.

Booking access remains locked until the tourist accepts the pledge.
This ensures safety and cleanliness of the environment of the region, aligning with the Sustainable Development Goals put forth by the United Arab Emirates.

### Interactive Al Qua’a Map

The application includes a dark-themed Google Map showing:

* Farm and guide listings.
* Safe-zone polygons.
* Nearby restaurants and shops.
* Listing information when a marker is selected.
* An optional stargazing context overlay.

A simplified map is displayed if Google Maps cannot load.

### Tourism Listings

Tourists can view listings containing:

* Provider name.
* Description.
* Photograph.
* Activities.
* Prices.
* Available time slots.
* Safe-zone location.

The prototype includes sample stargazing, camel-farm, desert dining, restaurant, and shop data.

### Farmer Listing Creation

Farmers and guides can create listings with:

* Listing name.
* Description.
* Activity.
* Price.
* Available time slots.
* Image upload.
* Map-selected location.
* Automatically generated visitor safe zone.

Listings are saved using Firebase when available and fall back to browser storage if the Firebase request fails.

### Booking Flow

Tourists can:

1. Open a listing.
2. Select an activity.
3. Select an available time.
4. Review the price.
5. Confirm the booking.
6. View the booking in **My Bookings**.

Before saving, the application checks that the listing location is inside the provider’s safe-zone polygon.

Bookings are stored in Firestore when available and also saved locally for prototype reliability.

### Farmer Dashboard

Farmers can view incoming and active bookings.

Each booking shows:

* Tourist name.
* Activity.
* Time.
* Booking status.
* Approximate distance between the tourist and the listing.

Distance is calculated using the Haversine formula.

### WhatsApp Contact

Tourists can open a WhatsApp conversation with the provider directly from their booking.

Farmers can also contact tourists through WhatsApp from the dashboard.

### Evening Planner

Tourists enter:

* Arrival time.
* Available budget.

The application requests an itinerary from `/api/itinerary`. If the backend or AI service is unavailable, it generates a local fallback plan using existing activities, restaurants, prices, and time slots.

### Sky Map

The application embeds Stellarium Web, allowing tourists to explore an interactive night-sky map from inside the platform.

---

## How the Prototype Works

### Tourist Flow

1. Register as a tourist.
2. Complete the safety pledge.
3. Explore listings on the Al Qua’a map.
4. Select an activity and time slot.
5. Confirm the booking.
6. View the reservation under **My Bookings**.
7. Contact the provider through WhatsApp.
8. Use the evening planner or sky map.

### Farmer Flow

1. Register as a farmer or guide.
2. Create a listing.
3. Upload an image and select its map location.
4. Add an activity, price, and available times.
5. View bookings in the farmer dashboard.
6. Check the tourist’s approximate distance.
7. Contact the tourist through WhatsApp.

---

## Technology Stack

| Technology                 | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| HTML, CSS and JavaScript   | Application interface and logic            |
| Firebase Authentication    | Account registration and login             |
| Cloud Firestore            | User profiles, listings, and bookings      |
| Firebase Realtime Database | Listing fallback and booking-location data |
| Firebase Storage           | Listing image uploads                      |
| Google Maps API            | Locations, markers, and safe zones         |
| Stellarium Web             | Interactive sky map                        |
| Browser Local Storage      | Offline and Firebase failure fallback      |
| WhatsApp Click-to-Chat     | Tourist-provider communication             |

---

## Project Structure

```text
app.js              Main application screens and user flows
firebaseService.js  Firebase authentication and database operations
maps.js             Google Maps, markers, polygons, and location picker
geo.js              Safe-zone and distance calculations
data.js             Demo listings, local businesses, and safety content
environment.js      Firebase and Google Maps configuration
```

---

## Running the Project

Because the application uses JavaScript modules, run it through a local web server rather than opening the HTML file directly.

### Using Python

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

### Using Node.js

```bash
npm start.
```

---

## Firebase Setup

The application uses:

* Firebase Authentication.
* Cloud Firestore.
* Firebase Realtime Database.
* Firebase Storage.

Before deploying:

1. Create or connect a Firebase project, or use existing API key.
2. Enable Email/Password Authentication.
3. Enable Firestore.
4. Enable Realtime Database.
5. Enable Firebase Storage.
6. Configure appropriate Firebase security rules.
7. Add the deployed domain to Firebase authorised domains.

Do not commit unrestricted API keys or secret credentials to the public repository.

---

## How to Verify the Project

### Tourist Test

1. Register as a tourist.
2. Confirm that the safety pledge appears.
3. Try navigating before accepting the pledge.
4. Complete all safety slides and accept the checkbox.
5. Open a listing from the map.
6. Select an activity and time.
7. Confirm the booking.
8. Open **My Bookings**.
9. Test the provider WhatsApp button.
10. Generate an evening plan.

### Farmer Test

1. Register as a farmer or guide.
2. Create a listing.
3. Upload an image.
4. Select a map location.
5. Confirm that the listing appears under **My Listings**.
6. Open the farmer dashboard.
7. View the tourist distance and WhatsApp button.

---

## Current Limitations

This is a hackathon prototype.

* Online payments are not implemented.
* Continuous real-time GPS tracking is not yet complete.
* Booking confirmation and cancellation controls are limited.
* The itinerary page depends on an external `/api/itinerary` route for AI generation.
* A local rule-based itinerary is used when the API is unavailable.
* The sky map is provided through an embedded Stellarium page.
* Safe zones for new listings are generated automatically rather than manually drawn.
* Some sample listings and locations are demonstration data.
* Arabic language support is not yet included.

---

## Impact

The prototype demonstrates how Al Qua’a can convert passive stargazing traffic into organised community tourism.

It provides a practical way to:

* Promote local farms and guides.
* Direct visitors toward local businesses.
* Create additional income opportunities.
* Show visitors approved areas.
* Reduce accidental trespassing.
* Encourage responsible desert tourism.

The same model could later be adapted for other rural tourism communities in the UAE.

---

## Team

| Team Member | Contribution   |
| ----------- | -------------- |
| [Mohammed Faheem]     | [Backend, Debugging and reliability] |
| [Inshal Ahmed Syed]      | [System Design, Frontend and Project Planning] |
| [Syed Musatafa Hassan]      | [Frontend] |
| [Ismail Abu Baker] |         [Frontend Design]  |
| [Mohammed Rashid]  |      [Front+Backend integration] |

---

## Acknowledgements

Built for the **Tatweer Hackathon 2026** in collaboration with Abu Dhabi University and inspired by the needs of the Al Qua’a community.


