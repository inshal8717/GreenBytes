# Duroob

> A community tourism marketplace connecting visitors with farmers, guides, and local businesses in Al Qua’a.

**Tatweer Hackathon 2026 — Challenge 5: Solve a Real Problem in Your Community**

* **Live application:** [Add deployment link]
* **Demo video:** [Add demo video link]

---

## 1. Problem Definition

Al Qua’a is known for its dark skies, camel farms, desert landscape, and stargazing conditions. Many visitors travel to the area at night, observe the stars, and return home without interacting with local farmers, guides, restaurants, cafés, or shops.

This creates several connected problems.

### Limited local economic benefit

Tourists may visit Al Qua’a without spending money within the community. Local farmers, guides, and small businesses therefore receive little benefit from the tourism already taking place around them.

### Difficulty discovering local experiences

Visitors do not have one clear place to find:

* Stargazing sessions.
* Camel-farm visits.
* Desert guides.
* Local food and hospitality.
* Restaurants, cafés, and shops.
* Prices and available times.

### Safety and accidental trespassing

Tourists visiting unfamiliar desert areas at night may accidentally:

* Enter private farms.
* Wander outside approved visitor areas.
* Disturb livestock.
* Travel to unsafe or unsuitable locations.

### Environmental damage

Unmanaged visitors may leave plastic bottles, food packaging, and other waste in the desert. This can harm the environment and create a direct danger to camels and other animals.

---

## 2. Our Solution

**Duroob** is a community tourism platform designed specifically for Al Qua’a.

The application connects tourists with local farmers, guides, and businesses. It allows local providers to publish experiences, define safe visitor areas, receive bookings, and communicate with tourists.

Tourists can use Duroob to:

* Discover local experiences.
* Explore farms and businesses on a map.
* View approved visitor safe zones.
* Compare activities, prices, durations, and available times.
* Book experiences.
* Generate a personalised evening plan.
* Contact local providers through WhatsApp.
* Explore the night sky and upcoming astronomy events.

Duroob turns unorganised tourism into a structured experience that supports the community while improving visitor safety.

---

## 3. Main Users

### Tourists

Visitors travelling to Al Qua’a for:

* Stargazing.
* Camel experiences.
* Farm visits.
* Desert activities.
* Local food and hospitality.
* Astronomy-related tourism.

Tourists benefit from having one platform where they can find trusted experiences, compare prices, view locations, plan their evening, and make bookings.

### Farmers

Farm owners can:

* Create paid visitor experiences.
* Mark the part of their land where tourists are welcome.
* Publish available times and prices.
* Receive tourist bookings.
* Contact visitors directly.
* Earn additional income without replacing their main farming activity.

### Local Guides

Guides can publish experiences based on their knowledge of:

* Astronomy.
* Desert navigation.
* Wildlife.
* Photography.
* Local heritage.
* Outdoor activities.

They can select a meeting location, describe their expertise, and receive bookings from tourists.

### Local Businesses

Restaurants, cafés, shops, and hospitality providers can:

* Publish their services.
* Display product or food price ranges.
* Describe their specialties.
* Appear on the tourism map.
* Receive additional visitors from nearby activities.
* Benefit from itinerary recommendations.

---

## 4. Benefits to the Local Community

Duroob is intended to keep more tourism value inside Al Qua’a.

### New income opportunities

Farmers and guides can turn their existing land, knowledge, and hospitality into bookable experiences.

### More customers for local businesses

The map and evening planner direct visitors toward local restaurants, cafés, shops, and service providers.

### Safer farm tourism

Farmers can draw approved visitor boundaries so tourists can clearly see where they are allowed to go.

### Reduced accidental trespassing

Safe-zone polygons and mapped meeting points help visitors avoid entering private or unsuitable areas.

### More responsible tourism

The mandatory safety pledge teaches visitors to:

* Stay inside marked zones.
* Respect farms and animals.
* Avoid leaving plastic and waste behind.
* Follow desert safety guidance.

### A reusable rural-tourism model

The same platform structure could later be adapted for other rural communities in the UAE.

---

## 5. Implemented Features

## 5.1 Authentication and Accounts

Duroob supports Firebase Email/Password Authentication.

Users can register as:

* Tourist.
* Farmer.
* Guide.
* Local business.

Provider accounts also receive tourist access, allowing farmers, guides, and business owners to book experiences offered by other providers.

The application stores:

* Name.
* Email.
* WhatsApp phone number.
* User roles.
* Provider type.
* Safety-pledge status.

When Firebase Authentication is unavailable, the prototype can use a local browser-based account fallback.

---

## 5.2 Role-Based Interfaces

The application displays different pages depending on the active user role.

### Tourist navigation

* Al Qua’a map.
* Sky map.
* Evening planner.
* My Bookings.
* Account settings.

### Provider navigation

* Provider dashboard.
* My Listings.
* Sky map.
* Account settings.

The provider title changes depending on whether the account belongs to a farmer, guide, or local business.

---

## 5.3 Mandatory Safety Pledge

First-time tourists must complete a three-step safety introduction before entering the main application.

The pledge covers:

* Leaving no plastic or waste behind.
* Staying inside marked safe zones.
* Respecting farms, animals, guides, and the desert environment.

The user must confirm the pledge before booking features are unlocked.

The completion status is saved to the user profile so the tourist does not need to repeat it after every login.

---

## 5.4 Interactive Google Map

Duroob includes a dark-themed Google Map centred on Al Qua’a.

The map displays:

* Tourism listings.
* Provider locations.
* Farmer safe-zone designations using a polygon on the map.
* Local restaurants and cafés.
* Shops and other local businesses.
* The main Al Qua’a visitor area.

Users can select map markers to view:

* Listing name.
* Provider or business name.
* Experience duration.
* Recommended timing.
* Safe-zone information.

Listings can also be highlighted from the marketplace cards. The map then focuses on the corresponding safe-zone polygon.

---

## 5.5 Marketplace Experience Cards

The tourist home page displays all available experiences in a card-based marketplace.

Each card can show:

* Experience photograph.
* Experience name.
* Starting price.
* Host or business name.
* Provider type.
* Description.
* Number of available activities.
* Duration.
* Best time to visit.
* Guide expertise.
* Business specialties.
* Food or product price ranges.
* Available activities.

Tourists can either:

* Open the complete listing.
* Focus the listing on the Google Map.

---

## 5.6 Detailed Listing View

Opening a listing displays:

* Experience title.
* Provider or business name.
* Provider type.
* Image.
* Full description.
* Experience duration.
* Best timing.
* Included services or items.
* Guide expertise, where applicable.
* Local-business specialties, where applicable.
* Product or food price ranges.
* Safe-zone reminder.
* Available activities.
* Price for each activity.
* Available booking times.

Tourists can select a time directly from the listing details.

---

## 5.7 Provider-Specific Listing Creation

The listing form adapts to the type of provider creating it.

### Farmer listing fields

Farmers can enter:

* Farm name.
* Experience name.
* Description.
* Activity.
* Activity price.
* Available time slots.
* Experience duration.
* Best timing.
* Listing image.
* Farm visitor boundary.

### Guide listing fields

Guides can enter:

* Public or guide name.
* Experience name.
* Area of expertise.
* Description.
* Activity.
* Price.
* Duration.
* Available times.
* Best timing.
* Meeting point.
* Listing image.

### Local-business listing fields

Businesses can enter:

* Business name.
* Experience or service name.
* Food or product price range.
* Specialties.
* Description.
* Activity or offering.
* Price.
* Duration.
* Available times.
* Best timing.
* Business location.
* Listing image.

---

## 5.8 Farmer-Drawn Safe Zones

Farmers can draw the visitor boundary of their land directly on Google Maps.

The farmer:

1. Clicks around the boundary of the approved visitor area.
2. Adds at least three map points.
3. Sees the polygon appear on the map.
4. Can clear and redraw the polygon.
5. Saves the polygon with the listing.

The safe zone is later displayed to tourists as a blue polygon.

Guides and local businesses select a meeting point or business location instead of drawing a farm boundary.

---

## 5.9 Firebase Listing Storage

Published listings are stored in Cloud Firestore.

Listing images are uploaded to Firebase Storage.

The application also mirrors listing information to Firebase Realtime Database and listens for live listing updates.

After Firebase confirms a listing save, the provider sees a publication confirmation showing:

* Listing name.
* Number of activities.
* Number of saved safe-zone points.

The new listing then becomes visible through the live marketplace feed.

---

## 5.10 Local-Business Discovery

Duroob includes nearby local restaurants, cafés, shops, and businesses.

Each local-business entry can show:

* Business name.
* Business type.
* Description.
* Estimated price.
* Price range.
* Opening hours.
* Location.

Users can open external Google Maps directions to the business.

This encourages tourists to spend money at more than one local destination during their visit.

---

## 5.11 Tourist Booking Flow

Tourists can create a booking by:

1. Opening an experience.
2. Selecting an activity.
3. Selecting an available time.
4. Reviewing the price.
5. Confirming the reservation.
6. Viewing it under **My Bookings**.

A booking stores:

* Tourist.
* Provider.
* Listing.
* Activity.
* Time slot.
* Price.
* Duration.
* Tourist phone number.
* Booking status.
* Demonstration location data.

Bookings are stored under the authenticated tourist’s Firestore user record.

---

## 5.12 Booking Conflict Detection

Duroob checks whether a tourist already has another active booking at the selected time.

When a conflict is found, the application shows:

* The existing booking.
* The newly selected activity.
* Both providers.
* Both prices.
* The conflicting time.
* Other available time slots.

The tourist can then:

* Choose another time.
* Keep the original booking.
* Replace the original booking with the new one.

This prevents the same tourist from accidentally booking two activities at the same time.

---

## 5.13 Booking Removal

Tourists can remove bookings from the **My Bookings** page.

Before deletion, Duroob displays a confirmation message explaining:

* Which experience will be cancelled.
* Which provider will lose the reservation.
* Which time slot will be released.
* That the action cannot be undone.

After confirmation, the booking is removed from Firestore and its related location record is cleared.

---

## 5.14 Direct WhatsApp Communication

Each booking includes a WhatsApp Click-to-Chat link.

Tourists can contact the provider from **My Bookings**.

Providers can contact tourists from their dashboard.

This provides direct communication without requiring Duroob to build and maintain a separate messaging system.

---

## 5.15 Provider Dashboard

Farmers, guides, and business owners can view incoming and active bookings.

The dashboard displays:

* Tourist name.
* Booked activity.
* Booking time.
* Booking status.
* Approximate tourist-to-listing distance.
* Booking location preview.
* WhatsApp contact button.

The distance is calculated using geographic coordinates and the Haversine formula.

---

## 5.16 AI Evening Planner

Tourists can generate an evening plan by entering:

* Arrival time.
* Total budget.
* Interests and activity preferences.

Examples include:

* Stargazing.
* Local dinner.
* Camel activities.
* Farm visits.
* Desert experiences.

The planner only uses activities and businesses included in the Duroob marketplace.

It considers:

* Visitor arrival time.
* Available activity slots.
* Budget.
* Visitor interests.
* Activity prices.
* Experience duration.
* Best timing.
* Included services.
* Local-business prices.
* Safe-zone availability.

---

## 5.17 Gemini Itinerary Generation

The Node.js backend includes an `/api/itinerary` endpoint.

When a server-side `GEMINI_API_KEY` is configured, the endpoint uses the Gemini model to generate a personalised itinerary.

The prompt instructs Gemini to:

* Use only marketplace activities and businesses.
* Avoid inventing providers, prices, activities, or time slots.
* Avoid scheduling activities before the visitor arrives.
* Keep the plan within budget.
* Include exact activity and business costs.
* Include duration and host information.
* Remind visitors about mapped safe zones.
* Calculate total and remaining budget.

---

## 5.18 Rule-Based Itinerary Backup

When Gemini is unavailable or no API key is configured, Duroob uses an included local planner.

The fallback planner:

* Filters activities by the tourist’s budget.
* Removes activities that begin before arrival.
* Matches activities to the visitor’s interests.
* Selects available time slots.
* Adds a local restaurant or business when affordable.
* Calculates total spending.
* Shows the remaining budget.
* Uses only marketplace data.

This allows the itinerary feature to remain demonstrable without depending entirely on an external AI service.

---

## 5.19 Booking from Itinerary Suggestions

The evening planner also recommends activities that can be booked directly.

Tourists can:

1. Open the suggested-activities window.
2. Select one or more recommendations.
3. View the time, duration, provider, and price.
4. See the combined total.
5. Compare the total with their budget.
6. Book the selected activities.

The application avoids recommending time slots already occupied by another active booking.

---

## 5.20 Interactive Sky Map

Duroob embeds Stellarium Web inside the platform.

Tourists can use it to:

* Explore the night sky.
* View stars and planets.
* Use geolocation-supported sky information.
* Open the sky map in fullscreen mode.

This connects the tourism marketplace directly with Al Qua’a’s stargazing identity.

---

## 5.21 Upcoming Astronomy Events

The application includes a floating astronomy-events viewer.

Each event can display:

* Event title.
* Date.
* Recommended viewing time.
* Explanation.
* Image.
* External source.

Users can:

* View the next event.
* View the previous event.
* Collapse the event panel.
* Reopen it later.

---

## 5.22 Local and Failure Fallbacks

The prototype includes fallback behaviour for reliability.

When Firebase services are unavailable, the application can use browser storage for:

* Local user accounts.
* Listings.
* Bookings.
* Safety-pledge status.

When Google Maps cannot load, a simplified map view is displayed.

When Gemini is unavailable, the included local itinerary planner is used.

These fallbacks allow judges to test the main prototype flow even when an external service fails.

---

## 6. User Flow

### Tourist flow

1. Register as a tourist.
2. Complete the safety pledge.
3. Explore experiences on the map or marketplace.
4. View listing details.
5. Select an activity and time.
6. Resolve any schedule conflict.
7. Confirm the booking.
8. View or remove the booking.
9. Contact the provider through WhatsApp.
10. Generate an evening itinerary.
11. Book recommended activities.
12. Explore the sky map and astronomy events.

### Provider flow

1. Register as a farmer, guide, or local business.
2. Complete the provider-specific listing form.
3. Upload an image.
4. Select a location or draw a farm safe zone.
5. Publish the listing through Firebase.
6. View the listing in **My Listings**.
7. Receive bookings in the dashboard.
8. View tourist and booking information.
9. Contact tourists through WhatsApp.

---

## 7. Technology Stack

| Technology                 | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| HTML                       | Application structure                                   |
| CSS                        | Responsive interface and visual design                  |
| JavaScript ES Modules      | Application logic and components                        |
| Node.js                    | Static server and itinerary API                         |
| Firebase Authentication    | Registration and login                                  |
| Cloud Firestore            | Profiles, listings, and bookings                        |
| Firebase Realtime Database | Listing mirrors and booking-location records            |
| Firebase Storage           | Listing image uploads                                   |
| Google Maps API            | Markers, safe zones, directions, and location selection |
| Gemini API                 | Personalised itinerary generation                       |
| Stellarium Web             | Interactive sky map                                     |
| Browser Local Storage      | Prototype fallback storage                              |
| WhatsApp Click-to-Chat     | Direct tourist-provider communication                   |

---

## 8. Project Structure

```text
GreenBytes/
├── index.html
├── styles.css
├── server.js
├── package.json
├── README.md
└── src/
    ├── app.js
    ├── firebaseService.js
    ├── maps.js
    ├── geo.js
    ├── data.js
    └── environment.js
```

### Main files

| File                     | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `index.html`             | Loads the Duroob application                                            |
| `styles.css`             | Interface styling and responsive design                                 |
| `server.js`              | Static server, Gemini endpoint, and local itinerary fallback            |
| `src/app.js`             | Screens, state, forms, booking flows, and UI logic                      |
| `src/firebaseService.js` | Firebase authentication, storage, listings, and bookings                |
| `src/maps.js`            | Google Maps, safe zones, markers, and location pickers                  |
| `src/geo.js`             | Point-in-polygon and distance calculations                              |
| `src/data.js`            | Demonstration listings, businesses, safety slides, and astronomy events |
| `src/environment.js`     | Firebase and Google Maps web configuration                              |

---

## 9. Running the Application

### Requirements

* Node.js 18 or newer.
* npm.
* Internet access for Firebase, Google Maps, Gemini, and Stellarium features.

### Start the project

```bash
npm start
```

Open:

```text
http://127.0.0.1:4173
```

The application should be run with the included Node server because the server provides the `/api/itinerary` endpoint.

---

## 10. Gemini Configuration

Create a `.env` file in the repository root:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Do not commit the `.env` file.

Without this key, the application automatically uses its local rule-based itinerary planner.

---

## 11. Firebase Requirements

The application uses:

* Firebase Authentication.
* Cloud Firestore.
* Firebase Realtime Database.
* Firebase Storage.

Before deployment:

1. Enable Email/Password Authentication.
2. Create a Firestore database.
3. Enable Realtime Database.
4. Enable Firebase Storage.
5. Configure Firestore security rules.
6. Configure Realtime Database rules.
7. Configure Storage rules.
8. Add the deployed domain to Firebase authorised domains.
9. Restrict API keys to the required domains and services.

---

## 12. How to Verify the Prototype

### Tourist test

1. Register as a tourist.
2. Confirm that the safety pledge blocks the main application.
3. Complete the pledge.
4. Explore the map and listing cards.
5. Open a listing.
6. Book an available activity.
7. Attempt another booking at the same time.
8. Verify that the conflict window appears.
9. Select an alternative or replace the original booking.
10. Open **My Bookings**.
11. Test the WhatsApp contact button.
12. Remove a booking.
13. Generate an evening plan.
14. Select and book an itinerary recommendation.
15. Open the sky map.
16. Browse upcoming astronomy events.

### Provider test

1. Register as a farmer, guide, or local business.
2. Complete the provider-specific listing form.
3. Upload a listing image.
4. Draw a farm safe zone or choose a location.
5. Publish the listing.
6. Confirm that the Firebase publication message appears.
7. Open **My Listings**.
8. Confirm that the listing appears in the tourist marketplace.
9. Open the provider dashboard.
10. View booking and tourist information.
11. Test the tourist WhatsApp button.

---

## 13. Current Limitations

Duroob is a hackathon prototype.

* Online payments are not implemented.
* Providers cannot yet confirm, reject, or mark bookings as completed.
* Continuous browser GPS tracking is not implemented.
* The prototype stores booking-location data for distance demonstration.
* Capacity-based slot limits are not implemented.
* Provider identity and business verification are not implemented.
* Ratings and reviews are not implemented.
* Push notifications are not included.
* Some listings, businesses, locations, prices, and astronomy events use demonstration data.
* The embedded sky map requires internet access to Stellarium Web.
* Gemini generation requires a server-side API key, although the local fallback planner remains available.

---

## 14. Scalability

Duroob can be expanded by adding:

* More farms, guides, and businesses.
* More rural tourism regions.
* Arabic and multilingual support.
* Provider verification.
* Online payments.
* Ratings and reviews.
* Push notifications.
* Capacity and group-booking controls.
* Booking confirmation workflows.
* Tourism analytics.
* Weather and cloud-cover information.
* Emergency and roadside assistance.
* A mobile application.

The separation between application logic, maps, Firebase services, geographic calculations, and data makes these additions possible without rebuilding the entire platform.

---

## 15. Team

| Team Member         | Contribution                                  |
| ------------------- | --------------------------------------------- |
| Mohammed Faheem     | Backend, debugging for system reliability, Team Management|
| Inshal Ahmed Syed   | System design, frontend, and project planning |
| Syed Mustafa Hassan | Frontend and Team management                  |
| Ismail Abu Baker    | Frontend design                               |
| Mohammed Rashid     | Frontend and Backend integration, First working prototype, Core requirements|

---

## 16. Acknowledgements

Built for the **Tatweer Hackathon 2026** in collaboration with Abu Dhabi University and inspired by the tourism opportunities and needs of the Al Qua’a community.
