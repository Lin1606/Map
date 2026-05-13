import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot } from "firebase/firestore";

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

// ============================================================
// 👋 CATEGORIES
// ============================================================
const CATEGORIES = [
  { id: "hiking",     label: "Hiking",             emoji: "🥾" },
  { id: "nature",     label: "Relaxed Nature",      emoji: "🌿" },
  { id: "museum",     label: "Museum",              emoji: "🏛️" },
  { id: "food",       label: "Food & Drinks",       emoji: "🍜" },
  { id: "historical", label: "Historical & Hidden", emoji: "🏯" },
];

// ============================================================
// 👋 YOUR SPOTS
// ============================================================
const INITIAL_SPOTS = [
  {
    id: 1, name: "Maxipark Hamm", category: "nature",
    lat: 51.6912, lng: 7.8601, country: "Germany", city: "Hamm",
    content: "<h2>About</h2><p>Beautiful park with open meadows, a lake and lovely walking paths. Perfect for a slow morning with the pram.</p>",
    images: [], coverIndex: 0,
    links: [{ label: "Official website", url: "https://www.maximilianpark.de/" }],
    status: "visited", rating: 4, strollerFriendly: true,
    visitedDate: "2024-09-15", updatedAt: "2025-01-10",
  },
  {
    id: 2, name: "Westfälisches Freilichtmuseum", category: "museum",
    lat: 51.3602, lng: 7.4856, country: "Germany", city: "Hagen",
    content: "<h2>About</h2><p>Open air museum with historical crafts, old buildings and a working water mill. A real half-day trip.</p>",
    images: [], coverIndex: 0,
    links: [],
    status: "visited", rating: 5, strollerFriendly: true,
    visitedDate: "2024-10-02", updatedAt: "2025-01-08",
  },
  {
    id: 3, name: "Arashiyama Bamboo Grove", category: "nature",
    lat: 35.0094, lng: 135.6722, country: "Japan", city: "Kyoto",
    content: "<h2>About</h2><p>The iconic bamboo forest just outside Kyoto. Ethereal morning light filters through the tall stalks.</p>",
    images: ["https://images.unsplash.com/photo-1611918900220-de58f4374b85?w=800&q=80"],
    coverIndex: 0,
    links: [],
    status: "want", rating: null, strollerFriendly: true,
    visitedDate: null, updatedAt: "2025-01-09",
  },
  {
    id: 4, name: "Philosopher's Path", category: "nature",
    lat: 35.0272, lng: 135.7936, country: "Japan", city: "Kyoto",
    content: "<h2>About</h2><p>A quiet canal-side walk lined with hundreds of cherry trees. One of the most beautiful walks in Japan.</p>",
    images: [], coverIndex: 0,
    links: [],
    status: "want", rating: null, strollerFriendly: true,
    visitedDate: null, updatedAt: "2025-01-09",
  },
  {
    id: 5, name: "Teutoburger Wald", category: "hiking",
    lat: 51.9127, lng: 8.7564, country: "Germany", city: "Detmold",
    content: "<h2>About</h2><p>Beautiful forested hills with marked trails of varying difficulty. Feels remote but very accessible from NRW.</p>",
    images: [], coverIndex: 0,
    links: [{ label: "View trails on Outdooractive", url: "https://www.outdooractive.com/" }],
    status: "want", rating: null, strollerFriendly: false,
    visitedDate: null, updatedAt: "2025-01-09",
  },
  {
    id: 6, name: "Fushimi Inari Taisha", category: "historical",
    lat: 34.9671, lng: 135.7727, country: "Japan", city: "Kyoto",
    content: "<h2>About</h2><p>Thousands of vermillion torii gates winding up a forested mountain. Magical at any time of day.</p>",
    images: [], coverIndex: 0,
    links: [],
    status: "want", rating: null, strollerFriendly: false,
    visitedDate: null, updatedAt: "2025-01-09",
  },
];

// ============================================================
// STAR RATING
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
// RICH TEXT EDITOR — only shown in edit mode
// ============================================================
function RichEditor({ content, onChange }) {
  const editorRef = useRef(null);
  const savedRange = useRef(null);

  // Save the cursor position before toolbar button steals focus
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0);
    }
  };

  // Restore cursor position back into the editor
  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (savedRange.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const exec = (cmd, value = null) => {
    restoreSelection();
    document.execCommand(cmd, false, value);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    savedRange.current = null;
  };

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey)) {
      if (e.key === 'b') { e.preventDefault(); exec('bold'); }
      if (e.key === 'i') { e.preventDefault(); exec('italic'); }
      if (e.key === 'u') { e.preventDefault(); exec('underline'); }
    }
  };

  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>exec('formatBlock','H2')}><strong style={{fontSize:'15px'}}>H1</strong></button>
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>exec('formatBlock','H3')}><strong style={{fontSize:'13px'}}>H2</strong></button>
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>exec('formatBlock','P')}>T</button>
        <span className="tb-sep"/>
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>exec('bold')}><strong>B</strong></button>
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>exec('italic')}><em>I</em></button>
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>exec('underline')}><u>U</u></button>
        <span className="tb-sep"/>
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>exec('insertUnorderedList')}>•</button>
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>exec('insertOrderedList')}>1.</button>
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>{
          restoreSelection();
          document.execCommand('insertHTML', false, '<div class="todo-item"><input type="checkbox"/> <span>To do…</span></div>');
          handleInput();
          savedRange.current = null;
        }}>☐</button>
        <span className="tb-sep"/>
        <button type="button" className="tb-btn" onMouseDown={e=>{e.preventDefault();saveSelection();}} onClick={()=>exec('formatBlock','BLOCKQUOTE')}>"</button>
      </div>
      <div
        ref={editorRef}
        className="editor"
        contentEditable
        autoFocus
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        dangerouslySetInnerHTML={{ __html: content || "<p></p>" }}
      />
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function AdventureMap() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("map"); // "map" | "gallery" | "spot"
  const [selectedSpotId, setSelectedSpotId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [activeCategories, setActiveCategories] = useState(new Set(CATEGORIES.map(c => c.id)));
  const [statusFilter, setStatusFilter] = useState("all");
  const [strollerFilter, setStrollerFilter] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [shareNotice, setShareNotice] = useState(false);
  const [newSpot, setNewSpot] = useState({
    name:"", category:"nature", lat:"", lng:"",
    country:"", city:"", content:"<p></p>",
    status:"want", rating:null, strollerFriendly:false, links:[], images:[], coverIndex:0,
  });
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const clusterRef = useRef(null);

  const selectedSpot = spots.find(s => s.id === selectedSpotId);
  const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
  const today = () => new Date().toISOString().split("T")[0];

  // 👋 FIREBASE: Load spots in real time
  // onSnapshot = every time data changes in Firebase, update the screen
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "spots"), (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
      setSpots(data);
      setLoading(false);
    });
    return () => unsub(); // cleanup when component unmounts
  }, []);

  const filtered = spots.filter(s => {
    if (!activeCategories.has(s.category)) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (strollerFilter && !s.strollerFriendly) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${s.name} ${s.city||""} ${s.country||""} ${s.content||""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const openSpot = (id) => {
    setSelectedSpotId(id);
    setEditing(false);
    setEditDraft(null);
    // stays in current view (map or gallery), just selects the spot in sidebar
  };

  const openFullPage = (id) => {
    setSelectedSpotId(id);
    setEditing(false);
    setEditDraft(null);
    setView("spot");
  };

  const startEditing = () => {
    setEditDraft({ ...selectedSpot });
    setEditing(true);
  };

  const saveEditing = async () => {
    const updated = { ...editDraft, updatedAt: today() };
    // 👋 Update in Firebase
    if (updated.firestoreId) {
      const { firestoreId, ...data } = updated;
      await updateDoc(doc(db, "spots", firestoreId), data);
    }
    setSelectedSpotId(editDraft.id);
    setEditing(false);
    setEditDraft(null);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditDraft(null);
  };

  const updateDraft = (field, value) => setEditDraft(p => ({ ...p, [field]: value }));

  const updateSpot = async (id, field, value) => {
    const spot = spots.find(s => s.id === id);
    if (!spot || !spot.firestoreId) return;
    await updateDoc(doc(db, "spots", spot.firestoreId), { [field]: value, updatedAt: today() });
  };

  const toggleVisited = async (id) => {
    const spot = spots.find(s => s.id === id);
    if (!spot) return;
    const newStatus = spot.status === "visited" ? "want" : "visited";
    const updates = { status: newStatus, visitedDate: newStatus === "visited" ? (spot.visitedDate || today()) : null, updatedAt: today() };
    // 👋 Update in Firebase
    if (spot.firestoreId) await updateDoc(doc(db, "spots", spot.firestoreId), updates);
  };

  const addSpot = async () => {
    if (!newSpot.name || !newSpot.lat || !newSpot.lng) return;
    const spot = {
      ...newSpot,
      id: Date.now(),
      lat: parseFloat(newSpot.lat),
      lng: parseFloat(newSpot.lng),
      visitedDate: newSpot.status === "visited" ? today() : null,
      updatedAt: today(),
    };
    // 👋 Save to Firebase
    await addDoc(collection(db, "spots"), spot);
    setShowAddForm(false);
    setNewSpot({ name:"", category:"nature", lat:"", lng:"", country:"", city:"", content:"<p></p>", status:"want", rating:null, strollerFriendly:false, links:[], images:[], coverIndex:0 });
  };

  const addImage = (target, setTarget) => {
    const url = prompt("Paste a photo URL:");
    if (!url) return;
    setTarget({ ...target, images: [...(target.images||[]), url] });
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
    if (!spot.images || spot.images.length === 0) return null;
    return spot.images[spot.coverIndex ?? 0] || spot.images[0];
  };

  // Load Leaflet + Cluster
  useEffect(() => {
    if (window.L && window.L.markerClusterGroup) { setMapReady(true); return; }
    const addCss = (href) => { const l = document.createElement("link"); l.rel="stylesheet"; l.href=href; document.head.appendChild(l); };
    addCss("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    addCss("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css");
    addCss("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css");
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
      s2.onload = () => setMapReady(true);
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMap.current) return;
    if (view !== "map") return; // wait until map is visible
    const L = window.L;
    const map = L.map(mapRef.current, { center: [40, 20], zoom: 3 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (e) => {
      if (!showAddForm) return;
      setNewSpot(p => ({ ...p, lat: e.latlng.lat.toFixed(5), lng: e.latlng.lng.toFixed(5) }));
    });
    leafletMap.current = map;
    clusterRef.current = L.markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => L.divIcon({
        html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
        className: '', iconSize: [36, 36],
      })
    });
    map.addLayer(clusterRef.current);
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !clusterRef.current) return;
    const L = window.L;
    clusterRef.current.clearLayers();
    filtered.forEach(spot => {
      const cat = getCat(spot.category);
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin-marker">${spot.status==="visited" ? "✓" : cat.emoji}</div>`,
        iconSize: [12, 12], iconAnchor: [6, 6],
      });
      const marker = L.marker([spot.lat, spot.lng], { icon })
        .bindTooltip(spot.name, { direction: "top", offset: [0, -10], className: "map-tooltip" });
      marker.on("click", () => openSpot(spot.id));
      clusterRef.current.addLayer(marker);
    });
  }, [mapReady, filtered, spots]);

  useEffect(() => {
    if (!leafletMap.current || !selectedSpot || view !== "map") return;
    leafletMap.current.flyTo([selectedSpot.lat, selectedSpot.lng], 11, { duration: 1.2 });
  }, [selectedSpotId]);

  // When switching to map view: init if needed, or just invalidate size
  useEffect(() => {
    if (view !== "map") return;
    if (leafletMap.current) {
      setTimeout(() => leafletMap.current.invalidateSize(), 100);
    } else if (mapReady && mapRef.current) {
      // trigger re-run of map init effect
      setTimeout(() => {
        if (!leafletMap.current && mapRef.current && window.L) {
          const L = window.L;
          const map = L.map(mapRef.current, { center: [40, 20], zoom: 3 });
          L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19,
          }).addTo(map);
          map.on("click", (e) => {
            setNewSpot(p => ({ ...p, lat: e.latlng.lat.toFixed(5), lng: e.latlng.lng.toFixed(5) }));
            if (!showAddForm) { setShowAddForm(true); setSelectedSpotId(null); }
          });
          leafletMap.current = map;
          clusterRef.current = L.markerClusterGroup({
            maxClusterRadius: 50,
            showCoverageOnHover: false,
            iconCreateFunction: (cluster) => L.divIcon({
              html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
              className: '', iconSize: [36, 36],
            })
          });
          map.addLayer(clusterRef.current);
        }
      }, 100);
    }
  }, [view, mapReady]);

  // Update map click handler when showAddForm changes
  useEffect(() => {
    if (!leafletMap.current) return;
    leafletMap.current.off("click");
    leafletMap.current.on("click", (e) => {
      setNewSpot(p => ({ ...p, lat: e.latlng.lat.toFixed(5), lng: e.latlng.lng.toFixed(5) }));
      if (!showAddForm) { setShowAddForm(true); setSelectedSpotId(null); }
    });
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

    /* HEADER */
    .hdr{padding:14px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;background:var(--bg);flex-shrink:0}
    .hdr-title{font-family:var(--fd);font-size:26px;font-weight:500;letter-spacing:.01em;color:var(--text);line-height:1;margin-right:8px}
    .hdr-title em{font-style:italic;font-weight:400;color:var(--text-mid)}
    .nav-btn{background:none;border:none;padding:7px 14px;border-radius:22px;font-family:var(--fb);font-size:13px;font-weight:400;color:var(--text-mid);cursor:pointer;transition:all .18s;display:flex;align-items:center;gap:6px}
    .nav-btn:hover{background:var(--bg-soft);color:var(--text)}
    .nav-btn.active{background:var(--accent);color:white}
    .hdr-right{margin-left:auto;display:flex;align-items:center;gap:8px}

    /* SEARCH */
    .search-wrap{position:relative;display:flex;align-items:center}
    .search-wrap.open{min-width:220px}
    .search-toggle{width:34px;height:34px;border-radius:50%;background:var(--bg);border:1px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-mid);transition:all .18s;padding:0;flex-shrink:0}
    .search-toggle:hover{border-color:var(--text-mid);color:var(--text)}
    .search-toggle svg{width:15px;height:15px}
    .search-wrap.open .search-toggle{position:absolute;left:8px;border:none;background:transparent;width:26px;height:26px;z-index:2}
    .search-input{width:100%;padding:8px 14px 8px 38px;border:1px solid var(--border);border-radius:22px;background:var(--bg);font-family:var(--fb);font-size:13px;color:var(--text);outline:none;transition:border-color .15s;animation:fi .2s ease}
    .search-input:focus{border-color:var(--text-mid)}

    /* FILTER BAR */
    .filter-bar{padding:8px 28px;border-bottom:1px solid var(--border);background:var(--bg);display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap}
    .filter-toggle{background:none;border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-family:var(--fb);font-size:12px;font-weight:400;color:var(--text-mid);cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .18s}
    .filter-toggle:hover{border-color:var(--text-mid);color:var(--text)}
    .filter-toggle.on{background:var(--accent);color:white;border-color:var(--accent)}
    .filter-count{font-size:12px;color:var(--text-light);margin-left:auto}
    .filters-expanded{padding:12px 28px 16px;border-bottom:1px solid var(--border);background:var(--bg-soft);display:flex;gap:20px;flex-wrap:wrap;flex-shrink:0;animation:slideDown .2s ease}
    @keyframes slideDown{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
    .fg{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
    .fl{font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--text-light);margin-right:4px;width:100%;margin-bottom:4px}
    .chip{padding:4px 11px;border-radius:16px;font-size:12px;font-weight:400;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--text-mid);transition:all .18s;font-family:var(--fb)}
    .chip:hover{border-color:var(--text-mid);color:var(--text)}
    .chip.on{background:var(--accent);color:white;border-color:var(--accent)}

    /* MAP VIEW */
    .map-main{display:grid;grid-template-columns:1fr 420px;flex:1;overflow:hidden}
    .map-wrap{position:relative;overflow:hidden}
    .sb{border-left:1px solid var(--border);overflow-y:auto;background:var(--bg)}

    /* GALLERY VIEW */
    .gallery-view{flex:1;overflow-y:auto;padding:28px 32px}
    .gallery-grid-view{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}
    .gallery-card{border-radius:12px;overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:all .2s;background:var(--bg)}
    .gallery-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.1);border-color:var(--text-light)}
    .gallery-card-cover{width:100%;height:180px;background:var(--bg-panel);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
    .gallery-card-cover img{width:100%;height:100%;object-fit:cover}
    .gallery-card-cover-empty{font-size:44px;opacity:.25}
    .gallery-card-body{padding:14px 16px}
    .gallery-card-name{font-family:var(--fd);font-size:19px;font-weight:500;color:var(--text);margin-bottom:4px;line-height:1.2}
    .gallery-card-sub{font-size:11px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--text-light);margin-bottom:8px}
    .gallery-card-tags{display:flex;gap:6px;flex-wrap:wrap}
    .gallery-card-tag{padding:2px 8px;border-radius:10px;font-size:11px;border:1px solid var(--border);color:var(--text-mid)}
    .gallery-card-tag.visited{background:#f0f7f1;border-color:#b8d8bc;color:#4a7c50}
    .gallery-card-tag.want{background:#fdf0ef;border-color:#e8bfbb;color:#9b5650}

    /* FULL SPOT PAGE */
    .spot-page{flex:1;overflow-y:auto;animation:fi .25s ease}
    .spot-hero{position:relative;width:100%;height:320px;background:var(--bg-panel);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
    .spot-hero img{width:100%;height:100%;object-fit:cover}
    .spot-hero-empty{font-size:80px;opacity:.2}
    .spot-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.5) 100%);pointer-events:none}
    .spot-hero-actions{position:absolute;top:16px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between}
    .hero-btn{background:rgba(255,255,255,0.92);border:1px solid rgba(255,255,255,0.5);cursor:pointer;font-size:13px;font-weight:400;color:var(--text);font-family:var(--fb);padding:7px 14px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;transition:all .15s;backdrop-filter:blur(8px)}
    .hero-btn:hover{background:white}
    .hero-btn.primary{background:var(--accent);color:white;border-color:var(--accent)}
    .hero-btn.primary:hover{background:var(--text)}
    .hero-btns-right{display:flex;gap:8px}

    .spot-body{max-width:720px;margin:0 auto;padding:36px 32px 60px}
    .spot-cat-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:500;letter-spacing:.05em;margin-bottom:14px;color:var(--text-mid);background:var(--bg-panel);border:1px solid var(--border)}
    .spot-title{font-family:var(--fd);font-size:42px;font-weight:500;line-height:1.1;color:var(--text);margin-bottom:8px;letter-spacing:.005em}
    .spot-loc{font-size:13px;font-weight:400;letter-spacing:.1em;text-transform:uppercase;color:var(--text-light);margin-bottom:18px}
    .spot-meta{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid var(--border-soft)}
    .tag{padding:4px 12px;border-radius:14px;font-size:12px;font-weight:400;border:1px solid var(--border);color:var(--text-mid);background:var(--bg-soft);cursor:pointer;transition:all .15s}
    .tag:hover{border-color:var(--text-mid)}
    .tag.active{background:var(--accent);color:white;border-color:var(--accent)}
    .tag.plain{cursor:default}
    .tag.plain:hover{border-color:var(--border)}
    .dates-row{font-size:12px;color:var(--text-light);margin-bottom:20px;display:flex;gap:16px;flex-wrap:wrap}
    .dates-row strong{font-weight:500;color:var(--text-mid)}

    /* CONTENT — read mode */
    .content-read{font-size:16px;line-height:1.8;color:var(--text);margin-bottom:32px}
    .content-read p{margin:0 0 12px}
    .content-read p:last-child{margin:0}
    .content-read h2{font-family:var(--fd);font-size:28px;font-weight:500;margin:24px 0 12px;color:var(--text)}
    .content-read h3{font-family:var(--fd);font-size:22px;font-weight:500;margin:20px 0 10px;color:var(--text)}
    .content-read ul,.content-read ol{margin:8px 0 12px 24px}
    .content-read li{margin-bottom:6px}
    .content-read blockquote{border-left:3px solid var(--border);padding:8px 16px;margin:12px 0;color:var(--text-mid);font-style:italic;background:var(--bg-soft);border-radius:0 8px 8px 0}
    .content-read .todo-item{display:flex;align-items:flex-start;gap:10px;margin:6px 0}
    .content-read .todo-item input{margin-top:4px;cursor:pointer;flex-shrink:0}

    /* PHOTO GRID in spot page */
    .photo-section{margin-bottom:32px}
    .photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .photo-item{position:relative;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:var(--bg-panel)}
    .photo-item img{width:100%;height:100%;object-fit:cover;display:block}
    .photo-item-actions{position:absolute;top:8px;right:8px;display:flex;gap:6px;opacity:0;transition:opacity .15s}
    .photo-item:hover .photo-item-actions{opacity:1}
    .photo-action-btn{background:rgba(0,0,0,0.6);color:white;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:var(--fb);backdrop-filter:blur(4px)}
    .photo-action-btn:hover{background:rgba(0,0,0,0.85)}
    .photo-add{aspect-ratio:4/3;border:1px dashed var(--border);border-radius:10px;background:var(--bg-soft);color:var(--text-light);font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;font-family:var(--fb)}
    .photo-add:hover{border-color:var(--text-mid);color:var(--text);background:var(--bg)}

    /* EDIT MODE */
    .edit-field{margin-bottom:18px}
    .edit-label{font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--text-light);margin-bottom:6px;display:block}
    .edit-input{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-family:var(--fb);font-size:15px;font-weight:400;color:var(--text);outline:none;transition:border-color .18s}
    .edit-input:focus{border-color:var(--text-mid)}
    .edit-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .edit-check{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text);cursor:pointer}

    /* RICH TEXT EDITOR */
    .editor-wrap{margin-bottom:22px}
    .editor-toolbar{display:flex;align-items:center;gap:2px;padding:6px;background:var(--bg-soft);border:1px solid var(--border);border-bottom:none;border-radius:8px 8px 0 0;flex-wrap:wrap}
    .tb-btn{background:transparent;border:none;width:30px;height:30px;border-radius:5px;cursor:pointer;color:var(--text-mid);font-family:var(--fb);font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s;padding:0}
    .tb-btn:hover{background:var(--bg);color:var(--text)}
    .tb-sep{width:1px;height:18px;background:var(--border);margin:0 4px}
    .editor{min-height:200px;padding:16px;border:1px solid var(--border);border-radius:0 0 8px 8px;background:var(--bg);font-family:var(--fb);font-size:15px;line-height:1.75;color:var(--text);outline:none}
    .editor:focus{border-color:var(--text-mid)}
    .editor p{margin:0 0 10px}
    .editor h2{font-family:var(--fd);font-size:26px;font-weight:500;margin:16px 0 8px}
    .editor h3{font-family:var(--fd);font-size:20px;font-weight:500;margin:14px 0 8px}
    .editor ul,.editor ol{margin:8px 0 10px 24px}
    .editor blockquote{border-left:3px solid var(--border);padding:8px 16px;margin:8px 0;color:var(--text-mid);font-style:italic;background:var(--bg-soft);border-radius:0 6px 6px 0}

    /* LINKS */
    .links-section{margin-bottom:28px}
    .slbl{font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--text-light);margin-bottom:10px;display:block}
    .link-item{display:flex;align-items:center;gap:10px;padding:11px 14px;border:1px solid var(--border);border-radius:8px;margin-bottom:7px;transition:all .15s;text-decoration:none;color:var(--text);font-size:14px;background:var(--bg)}
    .link-item:hover{border-color:var(--text-mid);background:var(--bg-soft)}
    .add-link-btn{font-size:13px;color:var(--text-light);background:none;border:1px dashed var(--border);padding:10px 14px;border-radius:8px;cursor:pointer;font-family:var(--fb);width:100%;text-align:left;transition:all .15s}
    .add-link-btn:hover{border-color:var(--text-mid);color:var(--text)}

    /* BUTTONS */
    .btn{padding:9px 18px;border-radius:22px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--text);transition:all .18s;font-family:var(--fb)}
    .btn:hover{background:var(--bg-soft)}
    .btn.p{background:var(--accent);color:white;border-color:var(--accent)}
    .btn.p:hover{background:var(--text)}

    /* SIDEBAR LIST */
    .list-hdr{padding:20px 24px 12px;font-family:var(--fd);font-size:22px;font-weight:500;color:var(--text);border-bottom:1px solid var(--border)}
    .list-cnt{font-size:11px;font-weight:400;color:var(--text-light);letter-spacing:.08em;font-family:var(--fb);display:block;margin-top:3px}
    .si{padding:14px 24px;border-bottom:1px solid var(--border-soft);cursor:pointer;transition:background .13s;display:flex;align-items:flex-start;gap:12px}
    .si:hover{background:var(--bg-soft)}
    .si-emoji{font-size:20px;flex-shrink:0;margin-top:2px}
    .si-name{font-family:var(--fd);font-size:17px;font-weight:500;color:var(--text);line-height:1.2}
    .si-sub{font-size:11px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--text-light);margin-top:3px}
    .si-dot{width:7px;height:7px;border-radius:50%;margin-top:7px;flex-shrink:0;margin-left:auto;background:var(--accent)}
    .si-dot.want{background:var(--bg);border:1.5px solid var(--accent)}

    /* ADD FORM */
    .add-form{padding:24px}
    .add-form-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
    .add-form-title{font-family:var(--fd);font-size:24px;font-weight:500;color:var(--text)}
    .close-btn{background:none;border:none;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-light);font-size:20px;transition:all .15s;font-family:var(--fb)}
    .close-btn:hover{background:var(--bg-soft);color:var(--text)}
    .fg2{margin-bottom:14px}
    .flbl{display:block;font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--text-light);margin-bottom:5px}
    .finp{width:100%;padding:9px 13px;border:1px solid var(--border);border-radius:7px;background:var(--bg);font-family:var(--fb);font-size:14px;font-weight:400;color:var(--text);outline:none;transition:border-color .18s}
    .finp:focus{border-color:var(--text-mid)}
    .frow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .fchk{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text);cursor:pointer}
    .factions{display:flex;gap:10px;margin-top:20px}
    .hint{font-size:11px;color:var(--text-light);margin-top:-4px;margin-bottom:12px;line-height:1.5}

    /* MAP PINS */
    .pin-marker{width:12px;height:12px;border-radius:50%;background:white;border:1.5px solid #333;display:flex;align-items:center;justify-content:center;font-size:7px;box-shadow:0 2px 6px rgba(0,0,0,0.18);cursor:pointer;transition:transform .15s}
    .pin-marker:hover{transform:scale(1.4)}
    .cluster-icon{width:36px;height:36px;border-radius:50%;background:#333;color:white;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;font-weight:500;font-size:13px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25)}
    .leaflet-marker-icon.leaflet-div-icon{background:transparent;border:none}
    .map-tooltip{background:var(--text)!important;color:white!important;border:none!important;border-radius:6px!important;font-family:var(--fb)!important;font-size:13px!important;font-weight:400!important;padding:5px 11px!important;box-shadow:0 2px 8px rgba(0,0,0,.18)!important}
    .map-tooltip::before{display:none!important}
    .leaflet-control-attribution{font-size:10px!important;opacity:0.5}

    .add-btn{position:absolute;bottom:22px;right:22px;width:46px;height:46px;border-radius:50%;background:var(--accent);color:white;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.18);transition:transform .18s;z-index:999;font-family:var(--fb)}
    .add-btn:hover{transform:scale(1.08)}
    .map-hint{position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(26,26,26,0.85);color:white;padding:7px 16px;border-radius:22px;font-size:13px;font-family:var(--fb);pointer-events:none;backdrop-filter:blur(4px);z-index:999;white-space:nowrap}

    .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:var(--text);color:white;padding:10px 18px;border-radius:22px;font-family:var(--fb);font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,0.2);z-index:9999;animation:toastIn .25s ease}
    @keyframes toastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
    @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}

    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @media(max-width:700px){
      .map-main{grid-template-columns:1fr;grid-template-rows:45vh 1fr}
      .spot-hero{height:220px}
      .spot-body{padding:24px 18px 40px}
      .spot-title{font-size:32px}
      .gallery-grid-view{grid-template-columns:1fr 1fr}
    }
  `;

  const hasActiveFilters = activeCategories.size < CATEGORIES.length || statusFilter !== "all" || strollerFilter;

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* HEADER */}
        <div className="hdr">
          <div className="hdr-title">Our <em>Map</em></div>
          <button className={`nav-btn ${view==="map"?"active":""}`} onClick={()=>setView("map")}>🗺 Map</button>
          <button className={`nav-btn ${view==="gallery"?"active":""}`} onClick={()=>setView("gallery")}>🖼 Gallery</button>
          <div className="hdr-right">
            <div className={`search-wrap ${searchOpen?"open":""}`}>
              <button className="search-toggle" onClick={()=>{if(searchOpen&&search)setSearch("");setSearchOpen(o=>!o);}}>
                {searchOpen&&search ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                )}
              </button>
              {searchOpen && <input className="search-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus/>}
            </div>
          </div>
        </div>

        {/* FILTERS */}
        {view !== "spot" && (
          <div className="filter-bar">
            <button className={`filter-toggle ${showFilters||hasActiveFilters?"on":""}`} onClick={()=>setShowFilters(f=>!f)}>
              ⚙ Filters {hasActiveFilters&&`(${[activeCategories.size<CATEGORIES.length,statusFilter!=="all",strollerFilter].filter(Boolean).length})`}
            </button>
            <span className="filter-count">{filtered.length} {filtered.length===1?"spot":"spots"}</span>
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
          </div>
        )}

        {/* ==================== MAP VIEW — always rendered so Leaflet can init ==================== */}
        <div className="map-main" style={{display: view === "map" ? "grid" : "none"}}>
            <div className="map-wrap">
              <div ref={mapRef} style={{width:"100%",height:"100%",cursor:showAddForm?"crosshair":"auto"}}/>
              {!mapReady&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-soft)",fontSize:"14px",color:"var(--text-light)"}}>Loading map…</div>}
              {loading&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-soft)",fontFamily:"var(--fb)",fontSize:"14px",color:"var(--text-light)",gap:10,zIndex:999}}>
                <div style={{width:20,height:20,border:"2px solid var(--border)",borderTop:"2px solid var(--accent)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                Loading your spots…
              </div>}
              {showAddForm && <div className="map-hint">👆 Click on the map to place your spot</div>}
              {!showAddForm && <button className="add-btn" onClick={()=>{setShowAddForm(true);setSelectedSpotId(null);}}>+</button>}
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
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 13px",border:"1px solid var(--border)",borderRadius:"7px",background:"var(--bg-soft)",fontSize:"13px",color:"var(--text-mid)"}}>
                        <span>📍 {parseFloat(newSpot.lat).toFixed(4)}, {parseFloat(newSpot.lng).toFixed(4)}</span>
                        <button onClick={()=>setNewSpot(p=>({...p,lat:"",lng:""}))} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"var(--text-light)",fontSize:"18px"}}>×</button>
                      </div>
                    ) : (
                      <div style={{padding:"14px",border:"1px dashed var(--border)",borderRadius:"7px",background:"var(--bg-soft)",fontSize:"13px",color:"var(--text-light)",textAlign:"center",lineHeight:1.5}}>
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
                  <label className="fchk"><input type="checkbox" checked={newSpot.strollerFriendly} onChange={e=>setNewSpot(p=>({...p,strollerFriendly:e.target.checked}))}/> 🍼 Stroller friendly</label>
                  <div className="factions">
                    <button className="btn p" onClick={addSpot}>Save spot</button>
                    <button className="btn" onClick={()=>setShowAddForm(false)}>Cancel</button>
                  </div>
                </div>
              ) : selectedSpot ? (
                /* SIDEBAR SPOT PREVIEW */
                <div className="sb-preview" style={{animation:"fi .22s ease"}}>
                  {/* Cover */}
                  <div style={{position:"relative",width:"100%",height:"180px",background:"var(--bg-panel)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
                    {getCover(selectedSpot) ? (
                      <img src={getCover(selectedSpot)} alt={selectedSpot.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    ) : (
                      <div style={{fontSize:"50px",opacity:.2}}>{getCat(selectedSpot.category).emoji}</div>
                    )}
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.4) 100%)",pointerEvents:"none"}}/>
                    <button onClick={()=>setSelectedSpotId(null)} style={{position:"absolute",top:12,left:12,background:"rgba(255,255,255,0.9)",border:"1px solid rgba(255,255,255,0.5)",cursor:"pointer",fontSize:"12px",color:"var(--text)",fontFamily:"var(--fb)",padding:"5px 12px",borderRadius:"16px",backdropFilter:"blur(6px)"}}>← Back</button>
                  </div>

                  <div style={{padding:"18px 22px 28px"}}>
                    <span className="spot-cat-badge" style={{marginBottom:10}}>{getCat(selectedSpot.category).emoji} {getCat(selectedSpot.category).label}</span>
                    <div style={{fontFamily:"var(--fd)",fontSize:"26px",fontWeight:500,color:"var(--text)",lineHeight:1.15,marginBottom:4}}>{selectedSpot.name}</div>
                    <div style={{fontSize:"12px",fontWeight:400,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-light)",marginBottom:14}}>{selectedSpot.city}{selectedSpot.city&&selectedSpot.country?" · ":""}{selectedSpot.country}</div>

                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:16,paddingBottom:16,borderBottom:"1px solid var(--border-soft)"}}>
                      <span className={`tag ${selectedSpot.status==="visited"?"active":""}`} onClick={()=>toggleVisited(selectedSpot.id)}>
                        {selectedSpot.status==="visited"?"✅ Visited":"🌟 Want to go"}
                      </span>
                      {selectedSpot.strollerFriendly&&<span className="tag plain">🍼</span>}
                      <div style={{marginLeft:"auto"}}><StarRating rating={selectedSpot.rating} onRate={r=>updateSpot(selectedSpot.id,"rating",r)} readonly={selectedSpot.status!=="visited"}/></div>
                    </div>

                    {/* Short content preview */}
                    {selectedSpot.content && selectedSpot.content !== "<p></p>" && (
                      <div style={{fontSize:"14px",lineHeight:1.7,color:"var(--text-mid)",marginBottom:18,display:"-webkit-box",WebkitLineClamp:4,WebkitBoxOrient:"vertical",overflow:"hidden"}} dangerouslySetInnerHTML={{__html:selectedSpot.content}}/>
                    )}

                    {/* Full view button */}
                    <button className="btn p" style={{width:"100%",justifyContent:"center",display:"flex",gap:6}} onClick={()=>openFullPage(selectedSpot.id)}>
                      ⤢ Open full page
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="list-hdr">Your spots<span className="list-cnt">{filtered.length} {filtered.length===1?"place":"places"} showing</span></div>
                  {filtered.length===0 ? (
                    <div style={{padding:"28px 24px",textAlign:"center",color:"var(--text-light)",fontSize:"14px",lineHeight:1.7}}>No spots match.<br/>Try adjusting filters or add a new spot!</div>
                  ) : filtered.map(s => {
                    const cat = getCat(s.category);
                    return (
                      <div key={s.id} className="si" onClick={()=>openSpot(s.id)}>
                        <span className="si-emoji">{cat.emoji}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="si-name">{s.name}</div>
                          <div className="si-sub">{s.city}{s.city&&s.country?" · ":""}{s.country}</div>
                          {s.rating&&<div style={{marginTop:"4px"}}><StarRating rating={s.rating} readonly/></div>}
                        </div>
                        <div className={`si-dot ${s.status==="want"?"want":""}`}/>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================== GALLERY VIEW ==================== */}
        {!loading && view === "gallery" && (
          <div className="gallery-view">
            <div className="gallery-grid-view">
              {filtered.map(s => {
                const cat = getCat(s.category);
                const cover = getCover(s);
                return (
                  <div key={s.id} className="gallery-card" onClick={()=>openFullPage(s.id)}>
                    <div className="gallery-card-cover">
                      {cover ? <img src={cover} alt={s.name} loading="lazy"/> : <div className="gallery-card-cover-empty">{cat.emoji}</div>}
                    </div>
                    <div className="gallery-card-body">
                      <div className="gallery-card-name">{s.name}</div>
                      <div className="gallery-card-sub">{s.city}{s.city&&s.country?" · ":""}{s.country}</div>
                      <div className="gallery-card-tags">
                        <span className={`gallery-card-tag ${s.status}`}>{s.status==="visited"?"✅ Visited":"🌟 Want to go"}</span>
                        {s.strollerFriendly && <span className="gallery-card-tag">🍼</span>}
                        <span className="gallery-card-tag">{cat.emoji} {cat.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{gridColumn:"1/-1",padding:"40px",textAlign:"center",color:"var(--text-light)",fontSize:"14px",lineHeight:1.7}}>
                  No spots match your filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== SPOT FULL PAGE ==================== */}
        {!loading && view === "spot" && spot && (
          <div className="spot-page">
            {/* HERO */}
            <div className="spot-hero">
              {getCover(spot) ? (
                <><img src={getCover(spot)} alt={spot.name}/><div className="spot-hero-overlay"/></>
              ) : (
                <div className="spot-hero-empty">{getCat(spot.category).emoji}</div>
              )}
              <div className="spot-hero-actions">
                <button className="hero-btn" onClick={()=>{setView("map");setEditing(false);setEditDraft(null);}}>← Back</button>
                <div className="hero-btns-right">
                  {!editing && <button className="hero-btn" onClick={()=>shareSpot(spot)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Share
                  </button>}
                  {!editing ? (
                    <button className="hero-btn primary" onClick={startEditing}>✎ Edit</button>
                  ) : (
                    <>
                      <button className="hero-btn" onClick={cancelEditing}>Cancel</button>
                      <button className="hero-btn primary" onClick={saveEditing}>Save</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="spot-body">
              {/* CATEGORY + TITLE */}
              {editing ? (
                <>
                  <div className="edit-field">
                    <label className="edit-label">Category</label>
                    <select className="edit-input" value={editDraft.category} onChange={e=>updateDraft("category",e.target.value)}>
                      {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Name</label>
                    <input className="edit-input" value={editDraft.name} onChange={e=>updateDraft("name",e.target.value)}/>
                  </div>
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

              {/* META */}
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
                    {spot.strollerFriendly&&<span className="tag plain">🍼 Stroller friendly</span>}
                    <div style={{marginLeft:"auto"}}>
                      <StarRating rating={spot.rating} onRate={r=>{setSpots(p=>p.map(s=>s.id===spot.id?{...s,rating:r,updatedAt:today()}:s));}} readonly={spot.status!=="visited"}/>
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
                      <label className="edit-check"><input type="checkbox" checked={editDraft.strollerFriendly} onChange={e=>updateDraft("strollerFriendly",e.target.checked)}/> 🍼 Stroller friendly</label>
                    </div>
                  </div>
                </div>
              )}

              {/* PHOTOS */}
              <div className="photo-section">
                <span className="slbl">Photos</span>
                <div className="photo-grid">
                  {(editing ? editDraft.images : spot.images || []).map((src, i) => (
                    <div key={i} className="photo-item">
                      <img src={src} alt={`photo ${i+1}`} loading="lazy"/>
                      {editing && (
                        <div className="photo-item-actions">
                          <button className="photo-action-btn" onClick={()=>updateDraft("coverIndex",i)}>
                            {editDraft.coverIndex===i?"★ Cover":"☆ Set cover"}
                          </button>
                          <button className="photo-action-btn" onClick={()=>{
                            const next=[...editDraft.images];next.splice(i,1);
                            updateDraft("images",next);
                            if(editDraft.coverIndex>=next.length)updateDraft("coverIndex",0);
                          }}>Remove</button>
                        </div>
                      )}
                      {!editing && spot.coverIndex===i && (
                        <div style={{position:"absolute",top:8,left:8,background:"rgba(0,0,0,0.55)",color:"white",fontSize:"11px",padding:"3px 8px",borderRadius:"6px",backdropFilter:"blur(4px)"}}>★ Cover</div>
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
                  <RichEditor key={editDraft.id} content={editDraft.content} onChange={v=>updateDraft("content",v)}/>
                </div>
              ) : (
                <div className="content-read" dangerouslySetInnerHTML={{__html: spot.content||""}}/>
              )}

              {/* LINKS */}
              <div className="links-section">
                <span className="slbl">🔗 Links & Resources</span>
                {(editing ? editDraft.links : spot.links || []).map((link, i) => (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                    <a href={link.url} target="_blank" rel="noopener" className="link-item" style={{flex:1}}>
                      <svg style={{width:16,height:16,flexShrink:0,color:"var(--text-light)"}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      {link.label}
                    </a>
                    {editing && <button onClick={()=>{const n=[...editDraft.links];n.splice(i,1);updateDraft("links",n);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-light)",fontSize:"18px",flexShrink:0}}>×</button>}
                  </div>
                ))}
                {editing && (
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

        {shareNotice && <div className="toast">✓ Link copied!</div>}
      </div>
    </>
  );
}
