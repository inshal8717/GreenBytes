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
  collectionGroup,
  deleteDoc,
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
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import {
  getDatabase,
  onValue,
  ref,
  remove,
  set,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseApp = initializeApp(environment.firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const rtdb = getDatabase(firebaseApp);
const storage = getStorage(firebaseApp);

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getCurrentFirebaseUser() {
  await auth.authStateReady();
  return auth.currentUser;
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
      providerType: profile.providerType || null,
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

export async function createListingRecord(listing) {
  const docRef = await addDoc(collection(db, "listings"), {
    ...listing,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  set(ref(rtdb, `listings/${docRef.id}`), {
      ...listing,
      id: docRef.id,
      updatedAt: Date.now(),
    }).catch((realtimeError) => {
      console.warn("Listing saved to Firestore, but its Realtime Database mirror failed.", realtimeError);
    });
  return docRef.id;
}

export async function uploadListingImage(ownerId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const path = `listing-images/${ownerId}/${Date.now()}-${safeName}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

export function watchListings(callback, onError) {
  let firestoreListings = [];
  let realtimeListings = [];
  const emit = () => callback(mergeListings(firestoreListings, realtimeListings));

  const unsubscribeFirestore = onSnapshot(
    collection(db, "listings"),
    (snapshot) => {
      firestoreListings = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      emit();
    },
    onError,
  );

  const realtimeUnsubscribe = onValue(
    ref(rtdb, "listings"),
    (snapshot) => {
      const value = snapshot.val() || {};
      realtimeListings = Object.entries(value).map(([id, listing]) => ({ id, ...listing }));
      emit();
    },
    onError,
  );

  return () => {
    unsubscribeFirestore();
    realtimeUnsubscribe();
  };
}

function mergeListings(...groups) {
  const merged = new Map();
  groups.flat().forEach((listing) => {
    if (!listing?.id) return;
    merged.set(listing.id, { ...merged.get(listing.id), ...listing });
  });
  return [...merged.values()];
}

export function watchBookingsForUser(uid, callback, onError) {
  const touristBookings = collection(db, "users", uid, "bookings");
  return onSnapshot(
    touristBookings,
    (snapshot) => {
      callback(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })));
    },
    onError,
  );
}

export function watchBookingsForFarmer(uid, callback, onError) {
  const ownerQuery = query(collectionGroup(db, "bookings"), where("ownerId", "==", uid));
  return onSnapshot(
    ownerQuery,
    (snapshot) => {
      callback(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })));
    },
    onError,
  );
}

export async function findBookingConflict(uid, slot, excludeBookingId = null) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("You must be signed in with Firebase to check booking availability.");
  }
  const slotQuery = query(collection(db, "users", uid, "bookings"), where("slot", "==", slot));
  const snapshot = await getDocs(slotQuery);
  const conflict = snapshot.docs
    .map((item) => ({ ...item.data(), id: item.id }))
    .find((booking) => booking.id !== excludeBookingId && booking.status !== "completed" && booking.status !== "cancelled");
  return conflict || null;
}

export async function createBookingRecord(uid, booking) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("You must be signed in with Firebase to create a booking.");
  }
  const { id: _localId, touristId: _untrustedTouristId, ...bookingData } = booking;
  const docRef = await addDoc(collection(db, "users", uid, "bookings"), {
    ...bookingData,
    touristId: uid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteBookingRecord(uid, bookingId) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("You must be signed in with Firebase to remove a booking.");
  }
  await deleteDoc(doc(db, "users", uid, "bookings", bookingId));
  await remove(ref(rtdb, `bookingLocations/${bookingId}`)).catch((error) => {
    console.warn("Booking removed, but its live-location record could not be cleared.", error);
  });
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
