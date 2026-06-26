import { environment } from "./environment.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getDatabase,
  onValue,
  ref,
  set,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseApp = initializeApp(environment.firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const rtdb = getDatabase(firebaseApp);

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function registerUserAccount(profile) {
  const credential = await createUserWithEmailAndPassword(auth, profile.email, profile.password);
  const user = credential.user;
  await updateProfile(user, { displayName: profile.name });
  await setDoc(
    doc(db, "users", user.uid),
    {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      roles: profile.roles,
      safetyPledgeAccepted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return user;
}

export async function loginUserAccount(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function logoutFirebaseUser() {
  await signOut(auth);
}

export async function saveUserProfile(uid, profile) {
  await setDoc(
    doc(db, "users", uid),
    {
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function seedListingsIfEmpty(listings) {
  const snapshot = await getDocs(collection(db, "listings"));
  if (!snapshot.empty) return;
  await Promise.all(
    listings.map((listing) =>
      setDoc(doc(db, "listings", listing.id), {
        ...listing,
        createdAt: serverTimestamp(),
      }),
    ),
  );
}

export function watchListings(callback, onError) {
  return onSnapshot(
    collection(db, "listings"),
    (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    },
    onError,
  );
}

export function watchBookingsForUser(uid, callback, onError) {
  const touristQuery = query(collection(db, "bookings"), where("touristId", "==", uid));
  return onSnapshot(
    touristQuery,
    (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    },
    onError,
  );
}

export function watchAllBookings(callback, onError) {
  return onSnapshot(
    collection(db, "bookings"),
    (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    },
    onError,
  );
}

export async function createBookingRecord(booking) {
  const docRef = await addDoc(collection(db, "bookings"), {
    ...booking,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateLiveLocation(bookingId, location) {
  await set(ref(rtdb, `bookingLocations/${bookingId}`), {
    ...location,
    updatedAt: Date.now(),
  });
}

export function watchLiveLocation(bookingId, callback) {
  return onValue(ref(rtdb, `bookingLocations/${bookingId}`), (snapshot) => {
    callback(snapshot.val());
  });
}
