import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

// ============================================================
// FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAOewwuO9vnZHMTHwojLE1XBO0wIuM-IIU",
  authDomain: "our-map-9f7f7.firebaseapp.com",
  projectId: "our-map-9f7f7",
  storageBucket: "our-map-9f7f7.firebasestorage.app",
  messagingSenderId: "116966481134",
  appId: "1:116966481134:web:7bc16b55e66f25adebe7ff"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// ============================================================
// 🗺 GOOGLE MAPS
// 👇👇👇 HIER deinen eingeschränkten Maps API Key zwischen die
//        Anführungszeichen einsetzen (die " " müssen bleiben!)
// ============================================================
const GOOGLE_MAPS_API_KEY = "AIzaSyChVCf5wrydzuAAuoFkUjOB8h9OaRA5Q5U";

// TWO MAP MODES:
// OVERVIEW = calm, almost colourless, your spots stand out. The default.
// FULL     = normal Google Maps with cafés, attractions, everything — for searching.

// Overview: greyscale-ish, no POI/road/transit labels, but keeps city & country names.
const OVERVIEW_STYLE = [
  { elementType: "geometry", stylers: [{ saturation: -100 }, { lightness: 15 }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ saturation: -70 }, { lightness: 30 }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ saturation: -80 }, { lightness: 25 }] },
];

// Full: empty array = the normal, full-colour Google Maps with all places.
const FULL_STYLE = [];

const MAP_STYLES = { overview: OVERVIEW_STYLE, full: FULL_STYLE };

// Loads the Google Maps script once, then remembers it's loaded.
let googleMapsPromise = null;
function loadGoogleMaps() {
  if (window.google && window.google.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

// ============================================================
// 👋 CATEGORIES — copy a line and change details to add new one!
// ============================================================
const CATEGORIES = [
  { id: "hiking",     label: "Hiking",             emoji: "🥾" },
  { id: "nature",     label: "Relaxed Nature",      emoji: "🌿" },
  { id: "museum",     label: "Museum",              emoji: "🏛️" },
  { id: "food",       label: "Food & Drinks",       emoji: "🍜" },
  { id: "historical", label: "Historical & Hidden", emoji: "🏯" },
];

// ============================================================
// 🗓 TIMING / CALENDAR HELPERS
// Each spot can say WHEN it's worth visiting:
//   type "all"  → good all year (default; old spots count as this)
//   type "best" → best in a season, still OK otherwise (FADES out of season)
//   type "only" → only worth it on these dates, e.g. a festival (HIDDEN if trip misses)
// mode "range" → month range (May–Jun)   |   mode "date" → exact days (5–8 Aug)
// Everything repeats every year.
// ============================================================
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];

function defaultTiming() {
  return { type: "all", mode: "range", startMonth: 1, startDay: 1, endMonth: 12, endDay: 31 };
}

// Turn month+day into a "day of year" number (1–365) so dates can be compared.
function toDOY(month, day) {
  let d = 0;
  for (let m = 0; m < month - 1; m++) d += MONTH_DAYS[m];
  const safeDay = Math.min(Math.max(day || 1, 1), MONTH_DAYS[month - 1]);
  return d + safeDay;
}

// A range might wrap past New Year (Dec–Feb). Split it into normal pieces.
function rangeSegments(start, end) {
  return start <= end ? [[start, end]] : [[start, 365], [1, end]];
}

// Do two date ranges overlap on the calendar? (handles year wrap)
function rangesOverlap(s1, e1, s2, e2) {
  for (const [a1, a2] of rangeSegments(s1, e1)) {
    for (const [b1, b2] of rangeSegments(s2, e2)) {
      if (a1 <= b2 && b1 <= a2) return true;
    }
  }
  return false;
}

// Does this spot's season overlap with the trip the user is planning?
function timingMatchesTrip(t, trip) {
  const s1 = toDOY(t.startMonth, t.startDay || 1);
  const e1 = toDOY(t.endMonth, t.endDay || MONTH_DAYS[t.endMonth - 1]);
  const s2 = toDOY(trip.startMonth, trip.startDay || 1);
  const e2 = toDOY(trip.endMonth, trip.endDay || MONTH_DAYS[trip.endMonth - 1]);
  return rangesOverlap(s1, e1, s2, e2);
}

// Short label like "Best May–Jun" or "Only 5–8 Aug" to show on a spot.
function formatTiming(t) {
  if (!t || t.type === "all") return null;
  const startD = t.mode === "date" ? `${t.startDay} ${MONTHS[t.startMonth - 1]}` : MONTHS[t.startMonth - 1];
  const endD = t.mode === "date" ? `${t.endDay} ${MONTHS[t.endMonth - 1]}` : MONTHS[t.endMonth - 1];
  const span = startD === endD ? startD : `${startD}–${endD}`;
  return (t.type === "only" ? "Only " : "Best ") + span;
}

// ============================================================
// 👋 YOUR SPOTS — data now lives in Firebase, not here!
// ============================================================

function StarRating({ rating, onRate, readonly = false }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ display: "flex", gap: "3px" }}>
      {[1,2,3,4,5].map(s => (
        <span key={s}
          onClick={() => !readonly && onRate?.(s)}
          onMouseEnter={() => !readonly && setHovered(s)}
          onMouseLeave={() => !readonly && setHovered(null)}
          style={{ cursor: readonly ? "default" : "pointer", fontSize: "18px", color: s <= (hovered ?? rating ?? 0) ? "#333" : "#DDD", transition: "color 0.15s" }}
        >★</span>
      ))}
    </div>
  );
}

// ============================================================
// 🗓 TIMING EDITOR — used in the add form and the edit page
// ============================================================
function TimingEditor({ timing, onChange, inputClass = "finp" }) {
  const t = timing || defaultTiming();
  const allYear = t.type === "all";
  const startMonth = t.startMonth || 1;
  const endMonth = t.endMonth || 12;
  const startDay = t.mode === "date" ? (t.startDay ?? null) : null;
  const endDay = t.mode === "date" ? (t.endDay ?? null) : null;

  // The clever bit: if BOTH a start day and end day are picked → exact dates.
  // If you only pick months (days left on "any") → it's a season. Auto-detected.
  const apply = (sm, sd, em, ed) => {
    const hasDays = sd != null && ed != null;
    onChange({
      startMonth: sm, endMonth: em, startDay: sd, endDay: ed,
      type: hasDays ? "only" : "best",
      mode: hasDays ? "date" : "range",
    });
  };

  const hint = allYear ? null
    : (startDay != null && endDay != null)
      ? "→ Exact dates — hidden if your trip misses them."
      : "→ A season — just fades when you travel outside it.";

  return (
    <div>
      <label className="fchk" style={{ marginBottom: allYear ? 0 : 12 }}>
        <input type="checkbox" checked={allYear}
          onChange={e => e.target.checked ? onChange(defaultTiming()) : apply(startMonth, null, endMonth, null)} />
        🗓 Good all year
      </label>

      {!allYear && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-light)", width: 42 }}>From</span>
            <select className={inputClass} value={startMonth} onChange={e => apply(+e.target.value, startDay, endMonth, endDay)}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className={inputClass} value={startDay ?? ""} onChange={e => apply(startMonth, e.target.value === "" ? null : +e.target.value, endMonth, endDay)}>
              <option value="">any day</option>
              {Array.from({ length: MONTH_DAYS[startMonth - 1] }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-light)", width: 42 }}>To</span>
            <select className={inputClass} value={endMonth} onChange={e => apply(startMonth, startDay, +e.target.value, endDay)}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className={inputClass} value={endDay ?? ""} onChange={e => apply(startMonth, startDay, endMonth, e.target.value === "" ? null : +e.target.value)}>
              <option value="">any day</option>
              {Array.from({ length: MONTH_DAYS[endMonth - 1] }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 8, lineHeight: 1.4 }}>{hint}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// QUILL EDITOR — proper rich text, no cursor bugs!
// ============================================================
function QuillEditor({ content, onChange }) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!document.querySelector('link[href*="quill"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css";
      document.head.appendChild(link);
    }
    if (window.Quill) { setReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js";
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready || !editorRef.current || quillRef.current) return;
    const Quill = window.Quill;
    quillRef.current = new Quill(editorRef.current, {
      theme: "snow",
      placeholder: "Write about this place… use headings, bullet lists, checkboxes…",
      modules: {
        toolbar: [
          [{ header: [2, 3, false] }],
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
          ["blockquote"],
          ["clean"],
        ],
      },
    });
    if (content) quillRef.current.clipboard.dangerouslyPasteHTML(content);
    quillRef.current.on("text-change", () => {
      onChange(quillRef.current.root.innerHTML);
    });
  }, [ready]);

  return (
    <div className="quill-wrap">
      {!ready && <div style={{padding:"14px",color:"var(--text-light)",fontSize:"13px"}}>Loading editor…</div>}
      <div ref={editorRef} style={{display: ready ? "block" : "none"}}/>
    </div>
  );
}

// ============================================================
// 🗺 GOOGLE MAP VIEW — replaces the old Leaflet map
// Draws the map, the spot pins, and the blue "pending" marker.
// ============================================================
function GoogleMapView({ spots, pendingPlace, draftPoint, onMapClick, onMarkerClick, getCat, mode }) {
  const mapRef = useRef(null);        // the <div> the map draws into
  const mapObj = useRef(null);        // the google.maps.Map instance
  const markers = useRef([]);         // current spot pins
  const pendingMarker = useRef(null); // the blue search pin
  const draftMarker = useRef(null);   // the pin shown while placing a new spot
  const onMapClickRef = useRef(onMapClick);
  const [ready, setReady] = useState(false);

  // keep the latest click handler without re-creating the map
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  // a tiny signature so we only redraw pins when something actually changes
  const sig = useMemo(
    () => spots.map(s => `${s.id}:${s.lat}:${s.lng}:${s.status}:${s.category}:${s._faded ? 1 : 0}`).join("|"),
    [spots]
  );

  // 1) create the map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current || mapObj.current) return;
        const g = window.google;
        mapObj.current = new g.maps.Map(mapRef.current, {
          center: { lat: 40, lng: 20 },
          zoom: 3,
          styles: MAP_STYLES[mode] || OVERVIEW_STYLE,
          clickableIcons: mode === "full",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });
        mapObj.current.addListener("click", (e) => {
          onMapClickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        setReady(true);
      })
      .catch((err) => console.error(err));
    return () => { cancelled = true; };
  }, []);

  // switch the map style live when the mode toggle changes
  useEffect(() => {
    if (!ready || !mapObj.current) return;
    mapObj.current.setOptions({
      styles: MAP_STYLES[mode] || OVERVIEW_STYLE,
      clickableIcons: mode === "full",
    });
  }, [mode, ready]);

  // 2) redraw the spot pins whenever the spots change
  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];
    spots.forEach(spot => {
      const cat = getCat(spot.category);
      const isVisited = spot.status === "visited";
      const marker = new g.maps.Marker({
        position: { lat: spot.lat, lng: spot.lng },
        map: mapObj.current,
        title: spot.name,
        opacity: spot._faded ? 0.35 : 1,
        label: { text: isVisited ? "✓" : cat.emoji, fontSize: "11px" },
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: "#ffffff",
          fillOpacity: 1,
          strokeColor: "#333333",
          strokeWeight: 1.5,
          scale: 11,
        },
      });
      marker.addListener("click", () => onMarkerClick(spot.id));
      markers.current.push(marker);
    });
  }, [sig, ready]);

  // 3) blue "pending" marker + fly there when you pick a search result
  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    if (pendingMarker.current) { pendingMarker.current.setMap(null); pendingMarker.current = null; }
    if (pendingPlace) {
      pendingMarker.current = new g.maps.Marker({
        position: { lat: pendingPlace.lat, lng: pendingPlace.lng },
        map: mapObj.current,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: "#4A90D9",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
          scale: 8,
        },
      });
      mapObj.current.panTo({ lat: pendingPlace.lat, lng: pendingPlace.lng });
      mapObj.current.setZoom(Math.max(mapObj.current.getZoom() || 3, 11));
    }
  }, [pendingPlace, ready]);

  // 4) the pin shown at the spot you're currently placing (click-to-add)
  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    if (draftMarker.current) { draftMarker.current.setMap(null); draftMarker.current = null; }
    if (draftPoint) {
      draftMarker.current = new g.maps.Marker({
        position: { lat: draftPoint.lat, lng: draftPoint.lng },
        map: mapObj.current,
        zIndex: 9999,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: "#333333",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: 9,
        },
      });
    }
  }, [draftPoint, ready]);

  return (
    <div className="gmap-wrap">
      {GOOGLE_MAPS_API_KEY === "PASTE_YOUR_MAPS_KEY_HERE" && (
        <div className="gmap-keynote">⚠ Add your Google Maps API key in the code (top of the file) to see the map.</div>
      )}
      <div ref={mapRef} className="gmap" />
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function AdventureMap() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("map");
  const [selectedSpotId, setSelectedSpotId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [activeCategories, setActiveCategories] = useState(new Set(CATEGORIES.map(c => c.id)));
  const [statusFilter, setStatusFilter] = useState("all");
  const [strollerFilter, setStrollerFilter] = useState(false);
  const [tripFilter, setTripFilter] = useState({ active: false, start: "", end: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [nominatimResults, setNominatimResults] = useState([]);
  const [pendingPlace, setPendingPlace] = useState(null);
  const [mapMode, setMapMode] = useState("overview");
  const [shareNotice, setShareNotice] = useState(false);
  const searchTimeout = useRef(null);
  const [newSpot, setNewSpot] = useState({
    name:"", category:"nature", lat:"", lng:"",
    country:"", city:"", content:"",
    status:"want", rating:null, strollerFriendly:false, links:[], images:[], coverIndex:0,
    timing: defaultTiming(),
  });

  const selectedSpot = spots.find(s => s.id === selectedSpotId);
  const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
  const today = () => new Date().toISOString().split("T")[0];

  // STEP 1: basic filters (category / status / stroller / text search)
  const filtered = spots.filter(s => {
    if (!activeCategories.has(s.category)) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (strollerFilter && !s.strollerFriendly) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${s.name} ${s.city||""} ${s.country||""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // STEP 2: trip-date filter (the calendar). Adds _faded and hides "only" misses.
  const displaySpots = useMemo(() => {
    // turn the two picked calendar dates into a {month,day} trip we can compare
    const tripActive = tripFilter.active && tripFilter.start && tripFilter.end;
    let trip = null;
    if (tripActive) {
      trip = {
        startMonth: +tripFilter.start.slice(5, 7), startDay: +tripFilter.start.slice(8, 10),
        endMonth: +tripFilter.end.slice(5, 7), endDay: +tripFilter.end.slice(8, 10),
      };
    }
    const list = filtered.map(s => {
      const t = s.timing || defaultTiming();
      let faded = false, visible = true;
      if (trip) {
        const matches = timingMatchesTrip(t, trip);
        if (t.type === "only" && !matches) visible = false;
        else if (t.type === "best" && !matches) faded = true;
      }
      return { ...s, _faded: faded, _visible: visible };
    }).filter(s => s._visible);
    // faded ones sink to the bottom of lists
    list.sort((a, b) => (a._faded ? 1 : 0) - (b._faded ? 1 : 0));
    return list;
  }, [filtered, tripFilter]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return () => unsub();
  }, []);

  // Firebase spots listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "spots"), (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
      setSpots(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signIn = async () => { try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error(e); } };
  const signOutUser = async () => { try { await signOut(auth); } catch (e) { console.error(e); } };

  const handleSearch = (val) => {
    setSearch(val);
    if (!val.trim()) { setSearchResults([]); setNominatimResults([]); return; }
    const q = val.toLowerCase();
    setSearchResults(spots.filter(s => `${s.name} ${s.city||""} ${s.country||""}`.toLowerCase().includes(q)).slice(0, 4));
    clearTimeout(searchTimeout.current);
    // Wait until you've stopped typing for 500ms, then do ONE Google search.
    // This keeps the number of paid calls tiny.
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            // only ask for the fields we use → keeps it in the cheapest tier
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
          },
          body: JSON.stringify({ textQuery: val, maxResultCount: 5 }),
        });
        const data = await res.json();
        setNominatimResults(data.places || []);
      } catch (e) { console.error(e); }
    }, 500);
  };

  const flyToPlace = (place) => {
    // Google Places returns: displayName.text, formattedAddress, location.latitude/longitude
    const name = place.displayName?.text || place.formattedAddress?.split(",")[0] || "Place";
    const addr = place.formattedAddress || "";
    const parts = addr.split(",").map(s => s.trim());
    const country = parts.length ? parts[parts.length - 1] : "";
    const city = parts.length >= 2 ? parts[parts.length - 2].replace(/\d+/g, "").trim() : "";
    setPendingPlace({
      name,
      lat: place.location.latitude,
      lng: place.location.longitude,
      city, country,
    });
    setSearch(""); setSearchResults([]); setNominatimResults([]);
    setView("map");
  };

  const addPendingAsSpot = () => {
    if (!pendingPlace) return;
    setNewSpot(p => ({ ...p, ...pendingPlace }));
    setShowAddForm(true); setSelectedSpotId(null); setPendingPlace(null);
  };

  const openSpot = (id) => { setSelectedSpotId(id); setEditing(false); setEditDraft(null); };
  const openFullPage = (id) => { setSelectedSpotId(id); setEditing(false); setEditDraft(null); setView("spot"); };

  const startEditing = () => { setEditDraft({ ...selectedSpot }); setEditing(true); };
  const cancelEditing = () => { setEditing(false); setEditDraft(null); };

  const saveEditing = async () => {
    const updated = { ...editDraft, updatedAt: today() };
    if (updated.firestoreId) {
      const { firestoreId, ...data } = updated;
      await updateDoc(doc(db, "spots", firestoreId), data);
    }
    setSelectedSpotId(editDraft.id); setEditing(false); setEditDraft(null);
  };

  const updateDraft = (field, value) => setEditDraft(p => ({ ...p, [field]: value }));

  const addSpot = async () => {
    if (!newSpot.name || !newSpot.lat || !newSpot.lng) return;
    const spot = { ...newSpot, id: Date.now(), lat: parseFloat(newSpot.lat), lng: parseFloat(newSpot.lng), visitedDate: newSpot.status === "visited" ? today() : null, updatedAt: today() };
    await addDoc(collection(db, "spots"), spot);
    setShowAddForm(false);
    setNewSpot({ name:"", category:"nature", lat:"", lng:"", country:"", city:"", content:"", status:"want", rating:null, strollerFriendly:false, links:[], images:[], coverIndex:0, timing: defaultTiming() });
  };

  const toggleVisited = async (id) => {
    const spot = spots.find(s => s.id === id);
    if (!spot || !spot.firestoreId) return;
    const newStatus = spot.status === "visited" ? "want" : "visited";
    await updateDoc(doc(db, "spots", spot.firestoreId), { status: newStatus, visitedDate: newStatus === "visited" ? (spot.visitedDate || today()) : null, updatedAt: today() });
  };

  const updateSpot = async (id, field, value) => {
    const spot = spots.find(s => s.id === id);
    if (!spot || !spot.firestoreId) return;
    await updateDoc(doc(db, "spots", spot.firestoreId), { [field]: value, updatedAt: today() });
  };

  const shareSpot = (spot) => {
    const url = `${window.location.origin}${window.location.pathname}#spot=${spot.id}`;
    navigator.clipboard.writeText(url).then(() => { setShareNotice(true); setTimeout(() => setShareNotice(false), 2200); });
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const getCover = (spot) => {
    if (!spot?.images || spot.images.length === 0) return null;
    return spot.images[spot.coverIndex ?? 0] || spot.images[0];
  };

  const handleMapClick = useCallback((latlng) => {
    setNewSpot(p => ({ ...p, lat: latlng.lat.toFixed(5), lng: latlng.lng.toFixed(5) }));
    if (!showAddForm) { setShowAddForm(true); setSelectedSpotId(null); }
  }, [showAddForm]);

  const spot = editing ? editDraft : selectedSpot;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#FFFFFF;--bg-soft:#FAFAFA;--bg-panel:#F5F5F5;
      --border:#E5E5E5;--border-soft:#EFEFEF;
      --text:#1A1A1A;--text-mid:#555555;--text-light:#999999;--accent:#333333;
      --fd:'Cormorant Garamond',serif;--fb:'Inter',sans-serif;
    }
    body{background:var(--bg);overflow:hidden}
    .app{height:100vh;display:flex;flex-direction:column;background:var(--bg);font-family:var(--fb);color:var(--text);font-size:15px}

    .hdr{padding:14px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;background:var(--bg);flex-shrink:0}
    .hdr-title{font-family:var(--fd);font-size:26px;font-weight:500;letter-spacing:.01em;color:var(--text);line-height:1;margin-right:8px}
    .hdr-title em{font-style:italic;font-weight:400;color:var(--text-mid)}
    .nav-btn{background:none;border:none;padding:7px 14px;border-radius:22px;font-family:var(--fb);font-size:13px;font-weight:400;color:var(--text-mid);cursor:pointer;transition:all .18s}
    .nav-btn:hover{background:var(--bg-soft);color:var(--text)}
    .nav-btn.active{background:var(--accent);color:white}
    .hdr-right{margin-left:auto;display:flex;align-items:center;gap:8px}

    .search-wrap{position:relative;display:flex;align-items:center}
    .search-wrap.open{min-width:260px}
    .search-toggle{width:34px;height:34px;border-radius:50%;background:var(--bg);border:1px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-mid);transition:all .18s;padding:0;flex-shrink:0}
    .search-toggle:hover{border-color:var(--text-mid);color:var(--text)}
    .search-toggle svg{width:15px;height:15px}
    .search-wrap.open .search-toggle{position:absolute;left:8px;border:none;background:transparent;width:26px;height:26px;z-index:2}
    .search-input{width:100%;padding:8px 14px 8px 38px;border:1px solid var(--border);border-radius:22px;background:var(--bg);font-family:var(--fb);font-size:13px;color:var(--text);outline:none;transition:border-color .15s}
    .search-input:focus{border-color:var(--text-mid)}

    .filter-bar{padding:8px 28px;border-bottom:1px solid var(--border);background:var(--bg);display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap}
    .filter-toggle{background:none;border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-family:var(--fb);font-size:12px;color:var(--text-mid);cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .18s}
    .filter-toggle:hover{border-color:var(--text-mid);color:var(--text)}
    .filter-toggle.on{background:var(--accent);color:white;border-color:var(--accent)}
    .filter-count{font-size:12px;color:var(--text-light);margin-left:auto}
    .filters-expanded{padding:12px 28px 16px;border-bottom:1px solid var(--border);background:var(--bg-soft);display:flex;gap:20px;flex-wrap:wrap;flex-shrink:0;animation:slideDown .2s ease}
    @keyframes slideDown{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
    .fg{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
    .fl{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--text-light);margin-right:4px;width:100%;margin-bottom:4px}
    .chip{padding:4px 11px;border-radius:16px;font-size:12px;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--text-mid);transition:all .18s;font-family:var(--fb)}
    .chip:hover{border-color:var(--text-mid);color:var(--text)}
    .chip.on{background:var(--accent);color:white;border-color:var(--accent)}
    select.chip{padding:4px 8px}
    .trip-date{padding:4px 10px;border-radius:16px;font-size:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--fb);cursor:pointer;outline:none}
    .trip-date:focus{border-color:var(--text-mid)}

    .map-main{display:grid;grid-template-columns:1fr 420px;flex:1;overflow:hidden}
    .map-wrap{position:relative;overflow:hidden}
    .gmap-wrap{width:100%;height:100%;position:relative}
    .gmap{width:100%;height:100%}
    .gmap-keynote{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:5;background:#fff4f4;border:1px solid #e8bfbb;color:#9b5650;padding:8px 16px;border-radius:10px;font-size:13px;font-family:var(--fb);max-width:90%;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,0.08)}
    .sb{border-left:1px solid var(--border);overflow-y:auto;background:var(--bg)}

    .gallery-view{flex:1;overflow-y:auto;padding:28px 32px}
    .gallery-grid-view{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px}
    .gallery-card{border-radius:12px;overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:all .2s;background:var(--bg)}
    .gallery-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.1);border-color:var(--text-light)}
    .gallery-card-cover{width:100%;height:170px;background:var(--bg-panel);display:flex;align-items:center;justify-content:center;overflow:hidden}
    .gallery-card-cover img{width:100%;height:100%;object-fit:cover}
    .gallery-card-cover-empty{font-size:42px;opacity:.25}
    .gallery-card-body{padding:13px 15px}
    .gallery-card-name{font-family:var(--fd);font-size:18px;font-weight:500;color:var(--text);margin-bottom:3px;line-height:1.2}
    .gallery-card-sub{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-light);margin-bottom:7px}
    .gallery-card-tags{display:flex;gap:5px;flex-wrap:wrap}
    .gallery-card-tag{padding:2px 8px;border-radius:10px;font-size:11px;border:1px solid var(--border);color:var(--text-mid)}
    .gallery-card-tag.visited{background:#f0f7f1;border-color:#b8d8bc;color:#4a7c50}
    .gallery-card-tag.want{background:#fdf0ef;border-color:#e8bfbb;color:#9b5650}
    .gallery-card.faded{opacity:.5}

    .spot-page{flex:1;overflow-y:auto;animation:fi .25s ease}
    .spot-hero{position:relative;width:100%;height:300px;background:var(--bg-panel);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
    .spot-hero img{width:100%;height:100%;object-fit:cover}
    .spot-hero-empty{font-size:72px;opacity:.2}
    .spot-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.5) 100%);pointer-events:none}
    .spot-hero-actions{position:absolute;top:16px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between}
    .hero-btn{background:rgba(255,255,255,0.92);border:1px solid rgba(255,255,255,0.5);cursor:pointer;font-size:13px;color:var(--text);font-family:var(--fb);padding:7px 14px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;transition:all .15s;backdrop-filter:blur(8px)}
    .hero-btn:hover{background:white}
    .hero-btn.primary{background:var(--accent);color:white;border-color:var(--accent)}
    .hero-btn.primary:hover{background:var(--text)}
    .hero-btns-right{display:flex;gap:8px}

    .spot-body{max-width:700px;margin:0 auto;padding:32px 28px 56px}
    .spot-cat-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:500;letter-spacing:.05em;margin-bottom:12px;color:var(--text-mid);background:var(--bg-panel);border:1px solid var(--border)}
    .spot-title{font-family:var(--fd);font-size:40px;font-weight:500;line-height:1.1;color:var(--text);margin-bottom:6px}
    .spot-loc{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-light);margin-bottom:16px}
    .spot-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:24px;padding-bottom:22px;border-bottom:1px solid var(--border-soft)}
    .tag{padding:4px 12px;border-radius:14px;font-size:12px;border:1px solid var(--border);color:var(--text-mid);background:var(--bg-soft);cursor:pointer;transition:all .15s}
    .tag:hover{border-color:var(--text-mid)}
    .tag.active{background:var(--accent);color:white;border-color:var(--accent)}
    .tag.plain{cursor:default}
    .tag.plain:hover{border-color:var(--border)}
    .tag.timing{cursor:default;background:#f3f6fb;border-color:#cdddf2;color:#3f6699}
    .tag.dir{background:#eef6f0;border-color:#bfddc6;color:#3f7a52;text-decoration:none;cursor:pointer}
    .tag.dir:hover{background:#e3f0e7;border-color:#9ecaa8}
    .dates-row{font-size:12px;color:var(--text-light);margin-bottom:18px;display:flex;gap:14px;flex-wrap:wrap}
    .dates-row strong{font-weight:500;color:var(--text-mid)}

    .content-read{font-size:16px;line-height:1.8;color:var(--text);margin-bottom:28px}
    .content-read p{margin:0 0 12px}
    .content-read h2{font-family:var(--fd);font-size:26px;font-weight:500;margin:20px 0 10px}
    .content-read h3{font-family:var(--fd);font-size:20px;font-weight:500;margin:16px 0 8px}
    .content-read ul,.content-read ol{margin:8px 0 12px 24px}
    .content-read li{margin-bottom:5px}
    .content-read blockquote{border-left:3px solid var(--border);padding:8px 16px;margin:12px 0;color:var(--text-mid);font-style:italic;background:var(--bg-soft);border-radius:0 8px 8px 0}

    .photo-section{margin-bottom:28px}
    .photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .photo-item{position:relative;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:var(--bg-panel)}
    .photo-item img{width:100%;height:100%;object-fit:cover;display:block}
    .photo-item-actions{position:absolute;top:8px;right:8px;display:flex;gap:6px;opacity:0;transition:opacity .15s}
    .photo-item:hover .photo-item-actions{opacity:1}
    .photo-action-btn{background:rgba(0,0,0,0.6);color:white;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:var(--fb);backdrop-filter:blur(4px)}
    .photo-action-btn:hover{background:rgba(0,0,0,0.85)}
    .photo-add{aspect-ratio:4/3;border:1px dashed var(--border);border-radius:10px;background:var(--bg-soft);color:var(--text-light);font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
    .photo-add:hover{border-color:var(--text-mid);color:var(--text);background:var(--bg)}

    .quill-wrap{margin-bottom:22px;border:1px solid var(--border);border-radius:8px;overflow:hidden}
    .quill-wrap .ql-toolbar{background:var(--bg-soft);border:none;border-bottom:1px solid var(--border);font-family:var(--fb)}
    .quill-wrap .ql-container{border:none;font-family:var(--fb);font-size:15px}
    .quill-wrap .ql-editor{min-height:180px;padding:16px;line-height:1.75;color:var(--text)}
    .quill-wrap .ql-editor.ql-blank::before{color:var(--text-light);font-style:italic}
    .quill-wrap .ql-editor h2{font-family:var(--fd);font-size:26px;font-weight:500;line-height:1.2}
    .quill-wrap .ql-editor h3{font-family:var(--fd);font-size:20px;font-weight:500;line-height:1.2}

    .edit-field{margin-bottom:16px}
    .edit-label{font-size:10px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--text-light);margin-bottom:5px;display:block}
    .edit-input{width:100%;padding:9px 13px;border:1px solid var(--border);border-radius:7px;background:var(--bg);font-family:var(--fb);font-size:14px;color:var(--text);outline:none;transition:border-color .18s}
    .edit-input:focus{border-color:var(--text-mid)}
    .edit-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .edit-check{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text);cursor:pointer}

    .links-section{margin-bottom:24px}
    .slbl{font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--text-light);margin-bottom:8px;display:block}
    .link-item{display:flex;align-items:center;gap:10px;padding:10px 13px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;transition:all .15s;text-decoration:none;color:var(--text);font-size:14px;background:var(--bg)}
    .link-item:hover{border-color:var(--text-mid);background:var(--bg-soft)}
    .add-link-btn{font-size:13px;color:var(--text-light);background:none;border:1px dashed var(--border);padding:9px 13px;border-radius:8px;cursor:pointer;font-family:var(--fb);width:100%;text-align:left;transition:all .15s}
    .add-link-btn:hover{border-color:var(--text-mid);color:var(--text)}

    .btn{padding:9px 18px;border-radius:22px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--text);transition:all .18s;font-family:var(--fb)}
    .btn:hover{background:var(--bg-soft)}
    .btn.p{background:var(--accent);color:white;border-color:var(--accent)}
    .btn.p:hover{background:var(--text)}

    .list-hdr{padding:18px 22px 12px;font-family:var(--fd);font-size:21px;font-weight:500;color:var(--text);border-bottom:1px solid var(--border)}
    .list-cnt{font-size:11px;color:var(--text-light);letter-spacing:.08em;font-family:var(--fb);display:block;margin-top:3px}
    .si{padding:13px 22px;border-bottom:1px solid var(--border-soft);cursor:pointer;transition:background .13s;display:flex;align-items:flex-start;gap:12px}
    .si:hover{background:var(--bg-soft)}
    .si.faded{opacity:.5}
    .si-name{font-family:var(--fd);font-size:17px;font-weight:500;color:var(--text);line-height:1.2}
    .si-sub{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-light);margin-top:3px}
    .si-dot{width:7px;height:7px;border-radius:50%;margin-top:7px;flex-shrink:0;margin-left:auto;background:var(--accent)}
    .si-dot.want{background:var(--bg);border:1.5px solid var(--accent)}

    .add-form{padding:22px}
    .add-form-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
    .add-form-title{font-family:var(--fd);font-size:22px;font-weight:500;color:var(--text)}
    .close-btn{background:none;border:none;cursor:pointer;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-light);font-size:20px;transition:all .15s}
    .close-btn:hover{background:var(--bg-soft);color:var(--text)}
    .fg2{margin-bottom:13px}
    .flbl{display:block;font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--text-light);margin-bottom:5px}
    .finp{width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:7px;background:var(--bg);font-family:var(--fb);font-size:14px;color:var(--text);outline:none;transition:border-color .18s}
    .finp:focus{border-color:var(--text-mid)}
    .frow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .fchk{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text);cursor:pointer}
    .factions{display:flex;gap:10px;margin-top:18px}
    .hint{font-size:11px;color:var(--text-light);margin-top:-3px;margin-bottom:10px;line-height:1.5}

    .map-mode-toggle{position:absolute;top:14px;left:14px;z-index:5;background:rgba(255,255,255,0.95);border:1px solid var(--border);border-radius:22px;padding:7px 14px;font-family:var(--fb);font-size:13px;color:var(--text);cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.1);backdrop-filter:blur(6px);transition:all .15s}
    .map-mode-toggle:hover{background:#fff;border-color:var(--text-mid)}

    .add-btn{position:absolute;bottom:22px;right:22px;width:44px;height:44px;border-radius:50%;background:var(--accent);color:white;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.18);transition:transform .18s;z-index:999;font-family:var(--fb)}
    .add-btn:hover{transform:scale(1.08)}
    .map-hint{position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(26,26,26,0.85);color:white;padding:7px 16px;border-radius:22px;font-size:13px;font-family:var(--fb);pointer-events:none;backdrop-filter:blur(4px);z-index:999;white-space:nowrap}

    .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:var(--text);color:white;padding:10px 18px;border-radius:22px;font-family:var(--fb);font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,0.2);z-index:9999;animation:toastIn .25s ease}
    @keyframes toastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
    @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}

    @media(max-width:700px){
      .map-main{grid-template-columns:1fr;grid-template-rows:45vh 1fr}
      .spot-hero{height:220px}
      .spot-body{padding:22px 18px 40px}
      .spot-title{font-size:32px}
      .gallery-grid-view{grid-template-columns:1fr 1fr}
    }
  `;

  const hasActiveFilters = activeCategories.size < CATEGORIES.length || statusFilter !== "all" || strollerFilter || tripFilter.active;
  const timingTag = !editing && selectedSpot ? formatTiming(selectedSpot.timing) : null;
  const fullTimingTag = spot ? formatTiming(spot.timing) : null;

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* AUTH LOADING */}
        {authLoading && (
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:24,height:24,border:"2px solid var(--border)",borderTop:"2px solid var(--accent)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          </div>
        )}

        {/* LOGIN SCREEN */}
        {!authLoading && !user && (
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,padding:32}}>
            <div style={{fontFamily:"var(--fd)",fontSize:"48px",fontWeight:500,color:"var(--text)",textAlign:"center",lineHeight:1.1}}>Our <em style={{fontStyle:"italic",color:"var(--text-mid)"}}>Map</em></div>
            <div style={{fontSize:"12px",color:"var(--text-light)",letterSpacing:".15em",textTransform:"uppercase"}}>Adventures & Places We Love</div>
            <div style={{height:1,width:50,background:"var(--border)",margin:"4px 0"}}/>
            <button onClick={signIn} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 26px",border:"1px solid var(--border)",borderRadius:"26px",background:"var(--bg)",cursor:"pointer",fontFamily:"var(--fb)",fontSize:"15px",color:"var(--text)",boxShadow:"0 2px 10px rgba(0,0,0,0.08)",transition:"all .18s"}}>
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>
            <div style={{fontSize:"12px",color:"var(--text-light)",textAlign:"center",maxWidth:260,lineHeight:1.6}}>Private access only.</div>
          </div>
        )}

        {/* MAIN APP */}
        {!authLoading && user && <>

        <div className="hdr">
          <div className="hdr-title">Our <em>Map</em></div>
          <button className={`nav-btn ${view==="map"?"active":""}`} onClick={()=>setView("map")}>🗺 Map</button>
          <button className={`nav-btn ${view==="gallery"?"active":""}`} onClick={()=>setView("gallery")}>🖼 Gallery</button>
          <div className="hdr-right">
            <div className={`search-wrap ${searchOpen?"open":""}`}>
              <button className="search-toggle" onClick={()=>{if(searchOpen&&search){setSearch("");setSearchResults([]);setNominatimResults([]);}setSearchOpen(o=>!o);}}>
                {searchOpen&&search ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                )}
              </button>
              {searchOpen && (
                <div style={{position:"relative",flex:1}}>
                  <input className="search-input" placeholder="Search spots or find a place…" value={search}
                    onChange={e=>handleSearch(e.target.value)}
                    onFocus={()=>setSearchFocused(true)}
                    onBlur={()=>setTimeout(()=>setSearchFocused(false),200)}
                    autoFocus/>
                  {searchFocused && (searchResults.length > 0 || nominatimResults.length > 0) && (
                    <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"10px",boxShadow:"0 4px 20px rgba(0,0,0,0.12)",zIndex:9999,overflow:"hidden",maxHeight:"320px",overflowY:"auto"}}>
                      {searchResults.length > 0 && (
                        <>
                          <div style={{padding:"8px 14px 4px",fontSize:"10px",fontWeight:500,letterSpacing:".14em",textTransform:"uppercase",color:"var(--text-light)"}}>Your spots</div>
                          {searchResults.map(s => (
                            <div key={s.id} style={{padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}
                              onMouseDown={()=>{openSpot(s.id);setSearchOpen(false);setSearch("");setSearchResults([]);setNominatimResults([]);setView("map");}}>
                              <span style={{fontSize:"16px"}}>{getCat(s.category).emoji}</span>
                              <div>
                                <div style={{fontSize:"14px",color:"var(--text)"}}>{s.name}</div>
                                <div style={{fontSize:"11px",color:"var(--text-light)"}}>{s.city}{s.city&&s.country?" · ":""}{s.country}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      {nominatimResults.length > 0 && (
                        <>
                          <div style={{padding:"8px 14px 4px",fontSize:"10px",fontWeight:500,letterSpacing:".14em",textTransform:"uppercase",color:"var(--text-light)",borderTop:searchResults.length>0?"1px solid var(--border-soft)":"none"}}>Places on the map</div>
                          {nominatimResults.map((p,i) => (
                            <div key={i} style={{padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}
                              onMouseDown={()=>flyToPlace(p)}>
                              <span style={{fontSize:"16px"}}>📍</span>
                              <div>
                                <div style={{fontSize:"14px",color:"var(--text)"}}>{p.displayName?.text||"Place"}</div>
                                <div style={{fontSize:"11px",color:"var(--text-light)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"240px"}}>{p.formattedAddress||""}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={signOutUser} style={{background:"none",border:"1px solid var(--border)",borderRadius:"22px",padding:"6px 12px",fontFamily:"var(--fb)",fontSize:"12px",color:"var(--text-light)",cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all .15s"}}>
              {user?.photoURL && <img src={user.photoURL} style={{width:20,height:20,borderRadius:"50%"}} alt=""/>}
              Sign out
            </button>
          </div>
        </div>

        {view !== "spot" && (
          <div className="filter-bar">
            <button className={`filter-toggle ${showFilters||hasActiveFilters?"on":""}`} onClick={()=>setShowFilters(f=>!f)}>
              ⚙ Filters {hasActiveFilters&&`(${[activeCategories.size<CATEGORIES.length,statusFilter!=="all",strollerFilter,tripFilter.active].filter(Boolean).length})`}
            </button>
            <span className="filter-count">{displaySpots.length} {displaySpots.length===1?"spot":"spots"}</span>
          </div>
        )}
        {showFilters && view !== "spot" && (
          <div className="filters-expanded">
            <div className="fg">
              <span className="fl">Category</span>
              {CATEGORIES.map(cat=>(
                <button key={cat.id} className={`chip ${activeCategories.has(cat.id)?"on":""}`}
                  onClick={()=>setActiveCategories(p=>{const n=new Set(p);n.has(cat.id)?n.delete(cat.id):n.add(cat.id);return n;})}>
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
            <div className="fg">
              <span className="fl">Status</span>
              {[["all","All"],["visited","Visited"],["want","Want to go"]].map(([v,l])=>(
                <button key={v} className={`chip ${statusFilter===v?"on":""}`} onClick={()=>setStatusFilter(v)}>{l}</button>
              ))}
            </div>
            <div className="fg">
              <span className="fl">Other</span>
              <button className={`chip ${strollerFilter?"on":""}`} onClick={()=>setStrollerFilter(f=>!f)}>🍼 Stroller</button>
            </div>
            <div className="fg">
              <span className="fl">🗓 When are you visiting?</span>
              <button className={`chip ${tripFilter.active?"on":""}`} onClick={()=>setTripFilter(p=>({...p,active:!p.active}))}>
                {tripFilter.active?"Trip dates on":"Off"}
              </button>
              {tripFilter.active && (
                <>
                  <input type="date" className="trip-date" value={tripFilter.start} onChange={e=>setTripFilter(p=>({...p,start:e.target.value}))}/>
                  <span style={{color:"var(--text-light)",fontSize:12}}>→</span>
                  <input type="date" className="trip-date" value={tripFilter.end} onChange={e=>setTripFilter(p=>({...p,end:e.target.value}))}/>
                </>
              )}
            </div>
          </div>
        )}

        {/* MAP VIEW */}
        {view === "map" && (
          <div className="map-main">
            <div className="map-wrap">
              <GoogleMapView
                spots={displaySpots}
                pendingPlace={pendingPlace}
                draftPoint={showAddForm && newSpot.lat && newSpot.lng ? { lat: parseFloat(newSpot.lat), lng: parseFloat(newSpot.lng) } : null}
                onMapClick={handleMapClick}
                onMarkerClick={openSpot}
                getCat={getCat}
                mode={mapMode}
              />

              {/* Map mode toggle: overview (calm) vs full (search everything) */}
              <button className="map-mode-toggle"
                onClick={()=>setMapMode(m=>m==="overview"?"full":"overview")}
                title="Switch map mode">
                {mapMode==="overview" ? "🔍 Search mode" : "🗺 Overview"}
              </button>

              {showAddForm && <div className="map-hint">👆 Click on the map to place your spot</div>}

              {pendingPlace && !showAddForm && (
                <div style={{position:"absolute",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:999,display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"22px",padding:"9px 16px",fontSize:"14px",color:"var(--text)",fontFamily:"var(--fb)",boxShadow:"0 4px 14px rgba(0,0,0,.12)",whiteSpace:"nowrap"}}>
                    📍 {pendingPlace.name}
                  </div>
                  <button style={{background:"var(--accent)",color:"white",border:"none",borderRadius:"22px",padding:"9px 16px",fontSize:"14px",fontWeight:500,cursor:"pointer",fontFamily:"var(--fb)",boxShadow:"0 4px 14px rgba(0,0,0,.12)",whiteSpace:"nowrap"}} onClick={addPendingAsSpot}>
                    + Add as spot
                  </button>
                  <button style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"50%",width:34,height:34,fontSize:"16px",cursor:"pointer",color:"var(--text-mid)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setPendingPlace(null)}>✕</button>
                </div>
              )}

              {!showAddForm && !pendingPlace && <button className="add-btn" onClick={()=>{setShowAddForm(true);setSelectedSpotId(null);}}>+</button>}
            </div>

            <div className="sb">
              {showAddForm ? (
                <div className="add-form">
                  <div className="add-form-hdr">
                    <div className="add-form-title">Add a new spot</div>
                    <button className="close-btn" onClick={()=>setShowAddForm(false)}>×</button>
                  </div>
                  <div className="fg2"><label className="flbl">Name *</label><input className="finp" placeholder="e.g. Arashiyama Bamboo Grove" value={newSpot.name} onChange={e=>setNewSpot(p=>({...p,name:e.target.value}))}/></div>
                  <div className="fg2">
                    <label className="flbl">Category</label>
                    <select className="finp" value={newSpot.category} onChange={e=>setNewSpot(p=>({...p,category:e.target.value}))}>
                      {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                    </select>
                  </div>
                  <div className="frow">
                    <div className="fg2"><label className="flbl">Country</label><input className="finp" placeholder="Japan" value={newSpot.country} onChange={e=>setNewSpot(p=>({...p,country:e.target.value}))}/></div>
                    <div className="fg2"><label className="flbl">City</label><input className="finp" placeholder="Kyoto" value={newSpot.city} onChange={e=>setNewSpot(p=>({...p,city:e.target.value}))}/></div>
                  </div>
                  <div className="fg2">
                    <label className="flbl">Location *</label>
                    {newSpot.lat && newSpot.lng ? (
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",border:"1px solid var(--border)",borderRadius:"7px",background:"var(--bg-soft)",fontSize:"13px",color:"var(--text-mid)"}}>
                        <span>📍 {parseFloat(newSpot.lat).toFixed(4)}, {parseFloat(newSpot.lng).toFixed(4)}</span>
                        <button onClick={()=>setNewSpot(p=>({...p,lat:"",lng:""}))} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"var(--text-light)",fontSize:"18px"}}>×</button>
                      </div>
                    ) : (
                      <div style={{padding:"12px",border:"1px dashed var(--border)",borderRadius:"7px",background:"var(--bg-soft)",fontSize:"13px",color:"var(--text-light)",textAlign:"center",lineHeight:1.5}}>
                        👆 Click anywhere on the map to place your spot
                      </div>
                    )}
                  </div>
                  <div className="fg2">
                    <label className="flbl">Status</label>
                    <select className="finp" value={newSpot.status} onChange={e=>setNewSpot(p=>({...p,status:e.target.value}))}>
                      <option value="want">🌟 Want to go</option>
                      <option value="visited">✅ Already visited</option>
                    </select>
                  </div>
                  <div className="fg2">
                    <label className="flbl">🗓 When is it worth visiting?</label>
                    <TimingEditor timing={newSpot.timing} onChange={tg=>setNewSpot(p=>({...p,timing:tg}))}/>
                  </div>
                  <label className="fchk"><input type="checkbox" checked={newSpot.strollerFriendly} onChange={e=>setNewSpot(p=>({...p,strollerFriendly:e.target.checked}))}/> 🍼 Stroller friendly</label>
                  <div className="factions">
                    <button className="btn p" onClick={addSpot}>Save spot</button>
                    <button className="btn" onClick={()=>setShowAddForm(false)}>Cancel</button>
                  </div>
                </div>
              ) : selectedSpot ? (
                <div style={{animation:"fi .22s ease"}}>
                  <div style={{position:"relative",width:"100%",height:"175px",background:"var(--bg-panel)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                    {getCover(selectedSpot) ? (
                      <img src={getCover(selectedSpot)} alt={selectedSpot.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    ) : (
                      <div style={{fontSize:"48px",opacity:.2}}>{getCat(selectedSpot.category).emoji}</div>
                    )}
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.4) 100%)",pointerEvents:"none"}}/>
                    <button onClick={()=>setSelectedSpotId(null)} style={{position:"absolute",top:10,left:12,background:"rgba(255,255,255,0.9)",border:"none",cursor:"pointer",fontSize:"12px",color:"var(--text)",fontFamily:"var(--fb)",padding:"5px 11px",borderRadius:"14px",backdropFilter:"blur(6px)"}}>← Back</button>
                    <button onClick={()=>openFullPage(selectedSpot.id)}
                      title="Open full page"
                      style={{position:"absolute",top:10,right:12,background:"rgba(255,255,255,0.9)",border:"none",cursor:"pointer",width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",color:"var(--text)",transition:"all .15s"}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </button>
                  </div>

                  <div style={{padding:"16px 20px 24px"}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:"12px",fontSize:"11px",fontWeight:500,letterSpacing:".05em",marginBottom:9,color:"var(--text-mid)",background:"var(--bg-panel)",border:"1px solid var(--border)"}}>{getCat(selectedSpot.category).emoji} {getCat(selectedSpot.category).label}</span>
                    <div style={{fontFamily:"var(--fd)",fontSize:"24px",fontWeight:500,color:"var(--text)",lineHeight:1.15,marginBottom:3}}>{selectedSpot.name}</div>
                    <div style={{fontSize:"11px",letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-light)",marginBottom:12}}>{selectedSpot.city}{selectedSpot.city&&selectedSpot.country?" · ":""}{selectedSpot.country}</div>

                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:14,paddingBottom:14,borderBottom:"1px solid var(--border-soft)"}}>
                      <span className={`tag ${selectedSpot.status==="visited"?"active":""}`} onClick={()=>toggleVisited(selectedSpot.id)}>
                        {selectedSpot.status==="visited"?"✅ Visited":"🌟 Want to go"}
                      </span>
                      {timingTag && <span className="tag timing">🗓 {timingTag}</span>}
                      <a className="tag dir" href={`https://www.google.com/maps/dir/?api=1&destination=${selectedSpot.lat},${selectedSpot.lng}`} target="_blank" rel="noopener">🧭 Directions</a>
                      {selectedSpot.strollerFriendly&&<span className="tag plain">🍼</span>}
                      <div style={{marginLeft:"auto"}}><StarRating rating={selectedSpot.rating} onRate={r=>updateSpot(selectedSpot.id,"rating",r)} readonly={selectedSpot.status!=="visited"}/></div>
                    </div>

                    {selectedSpot.content && selectedSpot.content !== "<p><br></p>" && (
                      <div style={{fontSize:"13px",lineHeight:1.7,color:"var(--text-mid)",marginBottom:14,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}} dangerouslySetInnerHTML={{__html:selectedSpot.content}}/>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="list-hdr">Your spots<span className="list-cnt">{loading?"Loading…":`${displaySpots.length} ${displaySpots.length===1?"place":"places"} showing`}</span></div>
                  {displaySpots.length===0&&!loading ? (
                    <div style={{padding:"28px 22px",textAlign:"center",color:"var(--text-light)",fontSize:"14px",lineHeight:1.7}}>No spots match.<br/>Try adjusting filters or add a new spot!</div>
                  ) : displaySpots.map(s => {
                    const cat = getCat(s.category);
                    const tg = formatTiming(s.timing);
                    return (
                      <div key={s.id} className={`si ${s._faded?"faded":""}`} onClick={()=>openSpot(s.id)}>
                        <span style={{fontSize:"20px",flexShrink:0,marginTop:2}}>{cat.emoji}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="si-name">{s.name}</div>
                          <div className="si-sub">{s.city}{s.city&&s.country?" · ":""}{s.country}{tg?` · ${tg}`:""}</div>
                          {s.rating&&<div style={{marginTop:4}}><StarRating rating={s.rating} readonly/></div>}
                        </div>
                        <div className={`si-dot ${s.status==="want"?"want":""}`}/>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* GALLERY VIEW */}
        {view === "gallery" && (
          <div className="gallery-view">
            <div className="gallery-grid-view">
              {displaySpots.map(s => {
                const cat = getCat(s.category);
                const cover = getCover(s);
                const tg = formatTiming(s.timing);
                return (
                  <div key={s.id} className={`gallery-card ${s._faded?"faded":""}`} onClick={()=>openFullPage(s.id)}>
                    <div className="gallery-card-cover">
                      {cover ? <img src={cover} alt={s.name} loading="lazy"/> : <div className="gallery-card-cover-empty">{cat.emoji}</div>}
                    </div>
                    <div className="gallery-card-body">
                      <div className="gallery-card-name">{s.name}</div>
                      <div className="gallery-card-sub">{s.city}{s.city&&s.country?" · ":""}{s.country}</div>
                      <div className="gallery-card-tags">
                        <span className={`gallery-card-tag ${s.status}`}>{s.status==="visited"?"✅ Visited":"🌟 Want to go"}</span>
                        {tg&&<span className="gallery-card-tag">🗓 {tg}</span>}
                        {s.strollerFriendly&&<span className="gallery-card-tag">🍼</span>}
                        <span className="gallery-card-tag">{cat.emoji} {cat.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {displaySpots.length===0&&(
                <div style={{gridColumn:"1/-1",padding:"40px",textAlign:"center",color:"var(--text-light)",fontSize:"14px"}}>No spots match your filters.</div>
              )}
            </div>
          </div>
        )}

        {/* SPOT FULL PAGE */}
        {view === "spot" && spot && (
          <div className="spot-page">
            <div className="spot-hero">
              {getCover(spot) ? (
                <><img src={getCover(spot)} alt={spot.name}/><div className="spot-hero-overlay"/></>
              ) : (
                <div className="spot-hero-empty">{getCat(spot.category).emoji}</div>
              )}
              <div className="spot-hero-actions">
                <button className="hero-btn" onClick={()=>{setView("map");setEditing(false);setEditDraft(null);}}>← Back</button>
                <div className="hero-btns-right">
                  {!editing&&<button className="hero-btn" onClick={()=>shareSpot(spot)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Share
                  </button>}
                  {!editing ? (
                    <button className="hero-btn primary" onClick={startEditing}>✎ Edit</button>
                  ) : (
                    <><button className="hero-btn" onClick={cancelEditing}>Cancel</button><button className="hero-btn primary" onClick={saveEditing}>Save</button></>
                  )}
                </div>
              </div>
            </div>

            <div className="spot-body">
              {editing ? (
                <>
                  <div className="edit-field">
                    <label className="edit-label">Category</label>
                    <select className="edit-input" value={editDraft.category} onChange={e=>updateDraft("category",e.target.value)}>
                      {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                    </select>
                  </div>
                  <div className="edit-field"><label className="edit-label">Name</label><input className="edit-input" value={editDraft.name} onChange={e=>updateDraft("name",e.target.value)}/></div>
                  <div className="edit-row">
                    <div className="edit-field"><label className="edit-label">City</label><input className="edit-input" value={editDraft.city||""} onChange={e=>updateDraft("city",e.target.value)}/></div>
                    <div className="edit-field"><label className="edit-label">Country</label><input className="edit-input" value={editDraft.country||""} onChange={e=>updateDraft("country",e.target.value)}/></div>
                  </div>
                </>
              ) : (
                <>
                  <span className="spot-cat-badge">{getCat(spot.category).emoji} {getCat(spot.category).label}</span>
                  <div className="spot-title">{spot.name}</div>
                  <div className="spot-loc">{spot.city}{spot.city&&spot.country?" · ":""}{spot.country}</div>
                </>
              )}

              {!editing && (
                <>
                  <div className="dates-row">
                    {spot.visitedDate&&<span><strong>Visited:</strong> {formatDate(spot.visitedDate)}</span>}
                    {spot.updatedAt&&<span><strong>Updated:</strong> {formatDate(spot.updatedAt)}</span>}
                  </div>
                  <div className="spot-meta">
                    <span className={`tag ${spot.status==="visited"?"active":""}`} onClick={()=>toggleVisited(spot.id)}>
                      {spot.status==="visited"?"✅ Visited":"🌟 Want to go"}
                    </span>
                    {fullTimingTag && <span className="tag timing">🗓 {fullTimingTag}</span>}
                    <a className="tag dir" href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`} target="_blank" rel="noopener">🧭 Get directions</a>
                    {spot.strollerFriendly&&<span className="tag plain">🍼 Stroller friendly</span>}
                    <div style={{marginLeft:"auto"}}>
                      <StarRating rating={spot.rating} onRate={r=>updateSpot(spot.id,"rating",r)} readonly={spot.status!=="visited"}/>
                    </div>
                  </div>
                </>
              )}

              {editing && (
                <div className="edit-field" style={{marginBottom:18}}>
                  <div className="edit-row">
                    <div>
                      <label className="edit-label">Status</label>
                      <select className="edit-input" value={editDraft.status} onChange={e=>updateDraft("status",e.target.value)}>
                        <option value="want">🌟 Want to go</option>
                        <option value="visited">✅ Visited</option>
                      </select>
                    </div>
                    <div style={{display:"flex",alignItems:"flex-end",paddingBottom:4}}>
                      <label className="edit-check"><input type="checkbox" checked={editDraft.strollerFriendly||false} onChange={e=>updateDraft("strollerFriendly",e.target.checked)}/> 🍼 Stroller</label>
                    </div>
                  </div>
                  <div style={{marginTop:14}}>
                    <label className="edit-label">🗓 When is it worth visiting?</label>
                    <TimingEditor timing={editDraft.timing} onChange={tg=>updateDraft("timing",tg)} inputClass="edit-input"/>
                  </div>
                </div>
              )}

              {/* PHOTOS */}
              <div className="photo-section">
                <span className="slbl">Photos</span>
                <div className="photo-grid">
                  {(editing ? editDraft.images : spot.images||[]).map((src,i)=>(
                    <div key={i} className="photo-item">
                      <img src={src} alt={`photo ${i+1}`} loading="lazy"/>
                      {editing && (
                        <div className="photo-item-actions">
                          <button className="photo-action-btn" onClick={()=>updateDraft("coverIndex",i)}>
                            {editDraft.coverIndex===i?"★ Cover":"☆ Cover"}
                          </button>
                          <button className="photo-action-btn" onClick={()=>{
                            const next=[...editDraft.images];next.splice(i,1);
                            updateDraft("images",next);
                            if(editDraft.coverIndex>=next.length)updateDraft("coverIndex",0);
                          }}>Remove</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button className="photo-add" onClick={()=>{
                      const url=prompt("Paste a photo URL:");
                      if(url)updateDraft("images",[...(editDraft.images||[]),url]);
                    }}>+</button>
                  )}
                </div>
              </div>

              {/* CONTENT */}
              {editing ? (
                <div className="edit-field">
                  <label className="edit-label">Content</label>
                  <QuillEditor key={editDraft.id} content={editDraft.content} onChange={v=>updateDraft("content",v)}/>
                </div>
              ) : (
                <div className="content-read" dangerouslySetInnerHTML={{__html:spot.content||""}}/>
              )}

              {/* LINKS */}
              <div className="links-section">
                <span className="slbl">🔗 Links & Resources</span>
                {(editing ? editDraft.links : spot.links||[]).map((link,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <a href={link.url} target="_blank" rel="noopener" className="link-item" style={{flex:1}}>
                      <svg style={{width:15,height:15,flexShrink:0,color:"var(--text-light)"}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      {link.label}
                    </a>
                    {editing&&<button onClick={()=>{const n=[...editDraft.links];n.splice(i,1);updateDraft("links",n);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-light)",fontSize:"18px",flexShrink:0}}>×</button>}
                  </div>
                ))}
                {editing&&(
                  <button className="add-link-btn" onClick={()=>{
                    const label=prompt("Link name:");if(!label)return;
                    const url=prompt("URL:");if(!url)return;
                    updateDraft("links",[...(editDraft.links||[]),{label,url}]);
                  }}>+ Add a link</button>
                )}
              </div>
            </div>
          </div>
        )}

        </> /* end logged in */}

        {shareNotice && <div className="toast">✓ Link copied!</div>}
      </div>
    </>
  );
}
