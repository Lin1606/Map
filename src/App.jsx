import { useState, useEffect, useRef } from "react";

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
// 👋 YOUR SPOTS — now with multiple images and dates!
// ============================================================
const INITIAL_SPOTS = [
  {
    id: 1, name: "Maxipark Hamm", category: "nature",
    lat: 51.6912, lng: 7.8601, country: "Germany", city: "Hamm",
    content: "<p>Beautiful park with open meadows, a lake and lovely walking paths. Perfect for a slow morning with the pram.</p>",
    images: [],
    links: [{ label: "Official website", url: "https://www.maximilianpark.de/" }],
    status: "visited", rating: 4, strollerFriendly: true,
    visitedDate: "2024-09-15", updatedAt: "2025-01-10",
  },
  {
    id: 2, name: "Westfälisches Freilichtmuseum", category: "museum",
    lat: 51.3602, lng: 7.4856, country: "Germany", city: "Hagen",
    content: "<p>Open air museum with historical crafts, old buildings and a working water mill. A real half-day trip.</p>",
    images: [],
    links: [],
    status: "visited", rating: 5, strollerFriendly: true,
    visitedDate: "2024-10-02", updatedAt: "2025-01-08",
  },
  {
    id: 3, name: "Arashiyama Bamboo Grove", category: "nature",
    lat: 35.0094, lng: 135.6722, country: "Japan", city: "Kyoto",
    content: "<p>The iconic bamboo forest just outside Kyoto.</p>",
    images: ["https://images.unsplash.com/photo-1611918900220-de58f4374b85?w=800&q=80"],
    links: [],
    status: "want", rating: null, strollerFriendly: true,
    visitedDate: null, updatedAt: "2025-01-09",
  },
  {
    id: 4, name: "Philosopher's Path", category: "nature",
    lat: 35.0272, lng: 135.7936, country: "Japan", city: "Kyoto",
    content: "<p>A quiet canal-side walk lined with hundreds of cherry trees.</p>",
    images: [],
    links: [],
    status: "want", rating: null, strollerFriendly: true,
    visitedDate: null, updatedAt: "2025-01-09",
  },
  {
    id: 5, name: "Teutoburger Wald", category: "hiking",
    lat: 51.9127, lng: 8.7564, country: "Germany", city: "Detmold",
    content: "<p>Beautiful forested hills with marked trails of varying difficulty.</p>",
    images: [],
    links: [{ label: "View trails on Outdooractive", url: "https://www.outdooractive.com/" }],
    status: "want", rating: null, strollerFriendly: false,
    visitedDate: null, updatedAt: "2025-01-09",
  },
  {
    id: 6, name: "Fushimi Inari Taisha", category: "historical",
    lat: 34.9671, lng: 135.7727, country: "Japan", city: "Kyoto",
    content: "<p>Thousands of vermillion torii gates winding up a forested mountain.</p>",
    images: [],
    links: [],
    status: "want", rating: null, strollerFriendly: false,
    visitedDate: null, updatedAt: "2025-01-09",
  },
];

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

function RichEditor({ content, onChange }) {
  const [editing, setEditing] = useState(false);
  const editorRef = useRef(null);
  const wrapperRef = useRef(null);

  const exec = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
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

  // Click outside to save and exit edit mode
  useEffect(() => {
    if (!editing) return;
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [editing]);

  const isEmpty = !content || content === "<p></p>" || content === "<p><br></p>";

  if (!editing) {
    return (
      <div className="readmode" onClick={() => setEditing(true)}>
        {isEmpty ? (
          <div className="readmode-empty">Click to add a description, notes, a to-do list…</div>
        ) : (
          <div className="readmode-content" dangerouslySetInnerHTML={{ __html: content }}/>
        )}
        <div className="readmode-hint">✎ Click to edit</div>
      </div>
    );
  }

  return (
    <div className="editor-wrap" ref={wrapperRef}>
      <div className="editor-toolbar">
        <button type="button" className="tb-btn" title="Heading 1" onClick={()=>exec('formatBlock','H2')}><strong style={{fontSize:'15px'}}>H1</strong></button>
        <button type="button" className="tb-btn" title="Heading 2" onClick={()=>exec('formatBlock','H3')}><strong style={{fontSize:'13px'}}>H2</strong></button>
        <button type="button" className="tb-btn" title="Paragraph" onClick={()=>exec('formatBlock','P')}>T</button>
        <span className="tb-sep"/>
        <button type="button" className="tb-btn" title="Bold (Ctrl+B)" onClick={()=>exec('bold')}><strong>B</strong></button>
        <button type="button" className="tb-btn" title="Italic (Ctrl+I)" onClick={()=>exec('italic')}><em>I</em></button>
        <button type="button" className="tb-btn" title="Underline (Ctrl+U)" onClick={()=>exec('underline')}><u>U</u></button>
        <span className="tb-sep"/>
        <button type="button" className="tb-btn" title="Bullet list" onClick={()=>exec('insertUnorderedList')}>•</button>
        <button type="button" className="tb-btn" title="Numbered list" onClick={()=>exec('insertOrderedList')}>1.</button>
        <button type="button" className="tb-btn" title="Checklist" onClick={()=>{
          const checkbox = '<div class="todo-item"><input type="checkbox"/> <span contenteditable="true">To do…</span></div>';
          document.execCommand('insertHTML', false, checkbox);
          handleInput();
        }}>☐</button>
        <span className="tb-sep"/>
        <button type="button" className="tb-btn" title="Quote" onClick={()=>exec('formatBlock','BLOCKQUOTE')}>"</button>
        <div style={{marginLeft:"auto"}}>
          <button type="button" className="tb-done" onClick={()=>setEditing(false)}>Done</button>
        </div>
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
// PHOTO GALLERY — multiple photos with horizontal scroll
// ============================================================
function PhotoGallery({ images, onAdd, onRemove }) {
  return (
    <div className="gallery">
      {images && images.length > 0 ? (
        <div className="gallery-grid">
          {images.map((src, i) => (
            <div key={i} className="gallery-item">
              <img src={src} alt={`photo ${i+1}`}/>
              <button className="gallery-remove" onClick={()=>onRemove(i)} title="Remove">×</button>
            </div>
          ))}
          <button className="gallery-add-tile" onClick={onAdd} title="Add another photo">+</button>
        </div>
      ) : (
        <button className="gallery-empty" onClick={onAdd}>+ Add photos</button>
      )}
    </div>
  );
}

export default function AdventureMap() {
  const [spots, setSpots] = useState(INITIAL_SPOTS);
  const [selectedSpotId, setSelectedSpotId] = useState(null);
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
    status:"want", rating:null, strollerFriendly:false, links:[], images:[],
  });
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const clusterRef = useRef(null);

  const selectedSpot = spots.find(s => s.id === selectedSpotId);

  const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];

  const filtered = spots.filter(s => {
    if (!activeCategories.has(s.category)) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (strollerFilter && !s.strollerFriendly) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${s.name} ${s.city||""} ${s.country||""} ${s.content||""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Load Leaflet + MarkerCluster
  useEffect(() => {
    if (window.L && window.L.markerClusterGroup) { setMapReady(true); return; }

    const leafletCss = document.createElement("link");
    leafletCss.rel = "stylesheet";
    leafletCss.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(leafletCss);

    const clusterCss = document.createElement("link");
    clusterCss.rel = "stylesheet";
    clusterCss.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
    document.head.appendChild(clusterCss);

    const clusterCssD = document.createElement("link");
    clusterCssD.rel = "stylesheet";
    clusterCssD.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
    document.head.appendChild(clusterCssD);

    const leafletScript = document.createElement("script");
    leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    leafletScript.onload = () => {
      const clusterScript = document.createElement("script");
      clusterScript.src = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
      clusterScript.onload = () => setMapReady(true);
      document.head.appendChild(clusterScript);
    };
    document.head.appendChild(leafletScript);
  }, []);

  // Init map
  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMap.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: [40, 20], zoom: 3, zoomControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    leafletMap.current = map;

    // Marker cluster group
    clusterRef.current = L.markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="cluster-icon">${count}</div>`,
          className: '',
          iconSize: [36, 36],
        });
      }
    });
    map.addLayer(clusterRef.current);
  }, [mapReady]);

  // Sync markers
  useEffect(() => {
    if (!mapReady || !clusterRef.current) return;
    const L = window.L;
    clusterRef.current.clearLayers();

    filtered.forEach(spot => {
      const cat = getCat(spot.category);
      const isVisited = spot.status === "visited";
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin-marker ${isVisited ? 'visited' : ''}">${isVisited ? "" : cat.emoji}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = L.marker([spot.lat, spot.lng], { icon })
        .bindTooltip(spot.name, { direction: "top", offset: [0, -10], className: "map-tooltip" });
      marker.on("click", () => { setSelectedSpotId(spot.id); setShowAddForm(false); });
      clusterRef.current.addLayer(marker);
    });
  }, [mapReady, filtered, spots]);

  // Fly to selected
  useEffect(() => {
    if (!leafletMap.current || !selectedSpot) return;
    leafletMap.current.flyTo([selectedSpot.lat, selectedSpot.lng], 11, { duration: 1.2 });
  }, [selectedSpotId]);

  // Read shared spot from URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#spot=")) {
      const id = parseInt(hash.replace("#spot=", ""));
      if (!isNaN(id)) setSelectedSpotId(id);
    }
  }, []);

  const today = () => new Date().toISOString().split("T")[0];

  const addSpot = () => {
    if (!newSpot.name || !newSpot.lat || !newSpot.lng) return;
    const spot = {
      ...newSpot,
      id: Date.now(),
      lat: parseFloat(newSpot.lat),
      lng: parseFloat(newSpot.lng),
      visitedDate: newSpot.status === "visited" ? today() : null,
      updatedAt: today(),
    };
    setSpots(p => [...p, spot]);
    setShowAddForm(false);
    setNewSpot({ name:"", category:"nature", lat:"", lng:"", country:"", city:"", content:"<p></p>", status:"want", rating:null, strollerFriendly:false, links:[], images:[] });
  };

  const updateSpot = (id, field, value) => {
    setSpots(p => p.map(s => s.id === id ? { ...s, [field]: value, updatedAt: today() } : s));
  };

  const toggleVisited = (id) => {
    setSpots(p => p.map(s => {
      if (s.id !== id) return s;
      const newStatus = s.status === "visited" ? "want" : "visited";
      return {
        ...s,
        status: newStatus,
        visitedDate: newStatus === "visited" ? (s.visitedDate || today()) : null,
        updatedAt: today(),
      };
    }));
  };

  const updateRating = (id, rating) => {
    setSpots(p => p.map(s => s.id === id ? { ...s, rating, updatedAt: today() } : s));
  };

  const shareSpot = (spot) => {
    const url = `${window.location.origin}${window.location.pathname}#spot=${spot.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareNotice(true);
      setTimeout(() => setShareNotice(false), 2200);
    });
  };

  const addImage = (id) => {
    const url = prompt("Paste a photo URL (Unsplash, Nextcloud link, etc):");
    if (!url) return;
    setSpots(p => p.map(s => s.id === id ? { ...s, images: [...(s.images || []), url], updatedAt: today() } : s));
  };

  const removeImage = (id, index) => {
    setSpots(p => p.map(s => {
      if (s.id !== id) return s;
      const next = [...(s.images || [])];
      next.splice(index, 1);
      return { ...s, images: next, updatedAt: today() };
    }));
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg: #FFFFFF;
      --bg-soft: #FAFAFA;
      --bg-panel: #F5F5F5;
      --border: #E5E5E5;
      --border-soft: #EFEFEF;
      --text: #1A1A1A;
      --text-mid: #555555;
      --text-light: #999999;
      --accent: #333333;
      --fd: 'Cormorant Garamond', serif;
      --fb: 'Inter', sans-serif;
    }
    body{background:var(--bg)}
    .app{min-height:100vh;background:var(--bg);font-family:var(--fb);color:var(--text);font-size:15px;font-weight:400}

    .hdr{padding:18px 32px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;background:var(--bg)}
    .hdr-title{font-family:var(--fd);font-size:30px;font-weight:500;letter-spacing:.01em;color:var(--text);line-height:1.1}
    .hdr-title em{font-style:italic;font-weight:400;color:var(--text-mid)}
    .hdr-sub{font-size:11px;font-weight:400;letter-spacing:.15em;text-transform:uppercase;color:var(--text-light);margin-top:3px}

    /* SEARCH BAR — collapsible */
    .search-row{padding:10px 32px;border-bottom:1px solid var(--border);background:var(--bg);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .search-wrap{position:relative;display:flex;align-items:center;transition:flex .3s ease}
    .search-wrap.open{flex:1;min-width:200px}
    .search-toggle{width:36px;height:36px;border-radius:50%;background:var(--bg);border:1px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-mid);transition:all .18s;padding:0;flex-shrink:0}
    .search-toggle:hover{border-color:var(--text-mid);color:var(--text)}
    .search-toggle svg{width:16px;height:16px}
    .search-wrap.open .search-toggle{position:absolute;left:6px;border:none;background:transparent;width:28px;height:28px;z-index:2}
    .search-input{width:100%;padding:8px 14px 8px 40px;border:1px solid var(--border);border-radius:22px;background:var(--bg);font-family:var(--fb);font-size:14px;color:var(--text);outline:none;transition:border-color .15s;animation:fi .25s ease}
    .search-input:focus{border-color:var(--text-mid)}
    .filter-toggle{background:none;border:1px solid var(--border);padding:7px 14px;border-radius:22px;font-family:var(--fb);font-size:13px;font-weight:400;color:var(--text-mid);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .18s;white-space:nowrap}
    .filter-toggle:hover{border-color:var(--text-mid);color:var(--text)}
    .filter-toggle.on{background:var(--accent);color:white;border-color:var(--accent)}
    .filter-count{font-size:12px;color:var(--text-light);font-weight:400;white-space:nowrap}

    .filters-expanded{padding:14px 32px 18px;border-bottom:1px solid var(--border);background:var(--bg-soft);display:flex;gap:24px;flex-wrap:wrap;animation:slideDown .25s ease}
    @keyframes slideDown{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
    .fg{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .fl{font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--text-light);margin-right:6px;width:100%;margin-bottom:6px}
    .chip{padding:5px 13px;border-radius:18px;font-size:13px;font-weight:400;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--text-mid);transition:all .18s;font-family:var(--fb)}
    .chip:hover{border-color:var(--text-mid);color:var(--text)}
    .chip.on{background:var(--accent);color:white;border-color:var(--accent)}

    .main{display:grid;grid-template-columns:1fr 460px;height:calc(100vh - 130px)}
    .map-wrap{position:relative;overflow:hidden}
    .sb{border-left:1px solid var(--border);overflow-y:auto;background:var(--bg)}

    /* PIN MARKERS — smaller now */
    .pin-marker{
      width:20px;height:20px;border-radius:50%;
      background:white;border:2px solid #333;
      display:flex;align-items:center;justify-content:center;
      font-size:10px;
      box-shadow:0 2px 6px rgba(0,0,0,0.18);
      cursor:pointer;
      transition:transform .15s;
    }
    .pin-marker.visited{background:#333}
    .pin-marker:hover{transform:scale(1.25)}

    /* CLUSTER ICONS */
    .cluster-icon{
      width:36px;height:36px;border-radius:50%;
      background:#333;color:white;
      display:flex;align-items:center;justify-content:center;
      font-family:'Inter',sans-serif;font-weight:500;font-size:13px;
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);
    }
    .leaflet-marker-icon.leaflet-div-icon{background:transparent;border:none}

    .detail{animation:fi .22s ease}
    @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
    .cover{position:relative;width:100%;height:200px;overflow:hidden;background:var(--bg-panel);display:flex;align-items:center;justify-content:center}
    .cover img{width:100%;height:100%;object-fit:cover;display:block}
    .cover-empty{font-size:56px;opacity:.25}
    .cover-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.45) 100%);pointer-events:none}
    .back-btn{background:rgba(255,255,255,0.92);border:1px solid var(--border);cursor:pointer;font-size:13px;font-weight:400;color:var(--text);font-family:var(--fb);padding:6px 14px;border-radius:18px;display:inline-flex;align-items:center;gap:5px;transition:all .15s;position:absolute;top:14px;left:16px;z-index:5;backdrop-filter:blur(8px)}
    .back-btn:hover{background:white}
    .share-btn{position:absolute;top:14px;right:16px;z-index:5;background:rgba(255,255,255,0.92);border:1px solid var(--border);cursor:pointer;font-size:13px;color:var(--text);font-family:var(--fb);padding:6px 12px;border-radius:18px;backdrop-filter:blur(8px);display:flex;align-items:center;gap:5px;transition:all .15s}
    .share-btn:hover{background:white}

    .detail-body{padding:22px 28px 38px}
    .cat-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:500;letter-spacing:.05em;margin-bottom:12px;color:var(--text-mid);background:var(--bg-panel);border:1px solid var(--border)}
    .spot-name{font-family:var(--fd);font-size:32px;font-weight:500;line-height:1.15;color:var(--text);margin-bottom:5px;letter-spacing:.005em}
    .spot-loc{font-size:13px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--text-light);margin-bottom:14px}
    .dates-row{font-size:12px;color:var(--text-light);margin-bottom:18px;display:flex;gap:14px;flex-wrap:wrap}
    .dates-row strong{font-weight:500;color:var(--text-mid)}

    .meta-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:22px;padding-bottom:20px;border-bottom:1px solid var(--border-soft)}
    .tag{padding:4px 11px;border-radius:14px;font-size:12px;font-weight:400;border:1px solid var(--border);color:var(--text-mid);background:var(--bg-soft)}
    .tag.active{background:var(--accent);color:white;border-color:var(--accent)}

    /* GALLERY */
    .gallery{margin-bottom:22px}
    .gallery-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .gallery-item{position:relative;aspect-ratio:4/3;border-radius:8px;overflow:hidden;background:var(--bg-panel)}
    .gallery-item img{width:100%;height:100%;object-fit:cover;display:block}
    .gallery-remove{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,0.65);color:white;border:none;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;opacity:0;transition:opacity .15s}
    .gallery-item:hover .gallery-remove{opacity:1}
    .gallery-remove:hover{background:rgba(0,0,0,0.85)}
    .gallery-add-tile{aspect-ratio:4/3;border:1px dashed var(--border);border-radius:8px;background:var(--bg-soft);color:var(--text-light);font-size:24px;cursor:pointer;font-family:var(--fb);transition:all .15s;display:flex;align-items:center;justify-content:center}
    .gallery-add-tile:hover{border-color:var(--text-mid);color:var(--text);background:var(--bg)}
    .gallery-empty{width:100%;padding:30px;border:1px dashed var(--border);border-radius:8px;background:var(--bg-soft);color:var(--text-light);font-size:14px;cursor:pointer;font-family:var(--fb);text-align:center;transition:all .15s}
    .gallery-empty:hover{border-color:var(--text-mid);color:var(--text)}

    /* READ MODE — what you see when not editing */
    .readmode{margin-bottom:22px;padding:14px 16px;border-radius:8px;cursor:text;transition:background .15s;position:relative;border:1px solid transparent}
    .readmode:hover{background:var(--bg-soft);border-color:var(--border-soft)}
    .readmode-content{font-size:15px;line-height:1.75;color:var(--text)}
    .readmode-empty{font-size:14px;color:var(--text-light);font-style:italic;padding:8px 0}
    .readmode-hint{position:absolute;top:8px;right:12px;font-size:11px;color:var(--text-light);opacity:0;transition:opacity .15s;font-weight:400;letter-spacing:.05em}
    .readmode:hover .readmode-hint{opacity:1}
    .readmode-content p{margin:0 0 8px}
    .readmode-content p:last-child{margin-bottom:0}
    .readmode-content h2{font-family:var(--fd);font-size:24px;font-weight:500;margin:14px 0 8px;color:var(--text);line-height:1.25}
    .readmode-content h3{font-family:var(--fd);font-size:19px;font-weight:500;margin:12px 0 6px;color:var(--text);line-height:1.3}
    .readmode-content ul,.readmode-content ol{margin:6px 0 8px 22px}
    .readmode-content li{margin-bottom:4px}
    .readmode-content blockquote{border-left:3px solid var(--border);padding:6px 14px;margin:8px 0;color:var(--text-mid);font-style:italic;background:var(--bg-soft);border-radius:0 6px 6px 0}
    .readmode-content .todo-item{display:flex;align-items:flex-start;gap:8px;margin:4px 0}

    /* RICH TEXT EDITOR — only visible when editing */
    .editor-wrap{margin-bottom:22px;animation:fi .2s ease}
    .editor-toolbar{display:flex;align-items:center;gap:2px;padding:6px;background:var(--bg-soft);border:1px solid var(--border);border-bottom:none;border-radius:8px 8px 0 0;flex-wrap:wrap}
    .tb-btn{background:transparent;border:none;width:30px;height:30px;border-radius:5px;cursor:pointer;color:var(--text-mid);font-family:var(--fb);font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s;padding:0}
    .tb-btn:hover{background:var(--bg);color:var(--text)}
    .tb-sep{width:1px;height:18px;background:var(--border);margin:0 4px}
    .tb-done{background:var(--accent);color:white;border:none;padding:6px 14px;border-radius:14px;font-family:var(--fb);font-size:12px;font-weight:500;cursor:pointer;transition:background .15s}
    .tb-done:hover{background:var(--text)}
    .editor{min-height:160px;padding:14px 16px;border:1px solid var(--border);border-radius:0 0 8px 8px;background:var(--bg);font-family:var(--fb);font-size:15px;line-height:1.7;color:var(--text);outline:none;transition:border-color .15s}
    .editor:focus{border-color:var(--text-mid)}
    .editor p{margin:0 0 8px}
    .editor h2{font-family:var(--fd);font-size:24px;font-weight:500;margin:14px 0 8px;color:var(--text);line-height:1.25}
    .editor h3{font-family:var(--fd);font-size:19px;font-weight:500;margin:12px 0 6px;color:var(--text);line-height:1.3}
    .editor ul,.editor ol{margin:6px 0 8px 22px}
    .editor li{margin-bottom:4px}
    .editor blockquote{border-left:3px solid var(--border);padding:6px 14px;margin:8px 0;color:var(--text-mid);font-style:italic;background:var(--bg-soft);border-radius:0 6px 6px 0}
    .editor .todo-item{display:flex;align-items:flex-start;gap:8px;margin:4px 0}
    .editor .todo-item input{margin-top:5px;cursor:pointer;flex-shrink:0}

    .block{margin-bottom:22px}
    .slbl{font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--text-light);margin-bottom:8px;display:flex;align-items:center;gap:6px}

    .link-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;transition:all .15s;text-decoration:none;color:var(--text);font-size:14px;font-weight:400;background:var(--bg)}
    .link-item:hover{border-color:var(--text-mid);background:var(--bg-soft)}
    .link-icon{width:18px;height:18px;flex-shrink:0;color:var(--text-light)}
    .add-link-btn{font-size:13px;color:var(--text-light);background:none;border:1px dashed var(--border);padding:9px 12px;border-radius:8px;cursor:pointer;font-family:var(--fb);font-weight:400;width:100%;text-align:left;transition:all .15s}
    .add-link-btn:hover{border-color:var(--text-mid);color:var(--text)}

    .btn{padding:9px 18px;border-radius:22px;font-size:14px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--text);transition:all .18s;font-family:var(--fb)}
    .btn:hover{background:var(--bg-soft)}
    .btn.p{background:var(--accent);color:white;border-color:var(--accent)}
    .btn.p:hover{background:var(--text)}

    .list-hdr{padding:22px 26px 14px;font-family:var(--fd);font-size:24px;font-weight:500;color:var(--text);border-bottom:1px solid var(--border)}
    .list-cnt{font-size:12px;font-weight:400;color:var(--text-light);letter-spacing:.08em;font-family:var(--fb);display:block;margin-top:4px}
    .si{padding:16px 26px;border-bottom:1px solid var(--border-soft);cursor:pointer;transition:background .13s;display:flex;align-items:flex-start;gap:14px}
    .si:hover{background:var(--bg-soft)}
    .si-emoji{font-size:22px;flex-shrink:0;margin-top:2px}
    .si-name{font-family:var(--fd);font-size:19px;font-weight:500;color:var(--text);line-height:1.2}
    .si-sub{font-size:12px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--text-light);margin-top:4px}
    .si-dot{width:8px;height:8px;border-radius:50%;margin-top:8px;flex-shrink:0;margin-left:auto;background:var(--accent)}
    .si-dot.want{background:var(--bg);border:1.5px solid var(--accent)}

    .add-btn{position:absolute;bottom:24px;right:24px;width:48px;height:48px;border-radius:50%;background:var(--accent);color:white;border:none;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.18);transition:transform .18s;z-index:999;font-family:var(--fb)}
    .add-btn:hover{transform:scale(1.08)}

    .form{padding:26px}
    .form-title{font-family:var(--fd);font-size:26px;font-weight:500;color:var(--text);margin-bottom:22px}
    .fg2{margin-bottom:14px}
    .flbl{display:block;font-size:11px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--text-light);margin-bottom:6px}
    .finp{width:100%;padding:9px 13px;border:1px solid var(--border);border-radius:7px;background:var(--bg);font-family:var(--fb);font-size:14px;font-weight:400;color:var(--text);outline:none;transition:border-color .18s}
    .finp:focus{border-color:var(--text-mid)}
    .frow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .fchk{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:400;color:var(--text);cursor:pointer}
    .factions{display:flex;gap:10px;margin-top:22px}
    .hint{font-size:12px;color:var(--text-light);font-weight:400;margin-top:-4px;margin-bottom:12px;line-height:1.5}

    .map-tooltip{background:var(--text)!important;color:white!important;border:none!important;border-radius:6px!important;font-family:var(--fb)!important;font-size:13px!important;font-weight:400!important;padding:5px 11px!important;box-shadow:0 2px 8px rgba(0,0,0,.18)!important}
    .map-tooltip::before{display:none!important}
    .leaflet-control-attribution{font-size:10px!important;opacity:0.6}

    /* SHARE TOAST */
    .toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--text);color:white;padding:10px 18px;border-radius:22px;font-family:var(--fb);font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,0.2);z-index:9999;animation:toastIn .25s ease}
    @keyframes toastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}

    @media(max-width:680px){
      .main{grid-template-columns:1fr;grid-template-rows:45vh 1fr}
      .hdr{padding:14px 18px}
      .search-row{padding:10px 18px}
      .detail-body{padding:20px 22px 30px}
      .spot-name{font-size:28px}
    }
  `;

  const hasActiveFilters = activeCategories.size < CATEGORIES.length || statusFilter !== "all" || strollerFilter;

  return (
    <>
      <style>{css}</style>
      <div className="app">

        <div className="hdr">
          <div>
            <div className="hdr-title">Our <em>Map</em></div>
            <div className="hdr-sub">Adventures & Places We Love</div>
          </div>
        </div>

        {/* SEARCH BAR — collapsible */}
        <div className="search-row">
          <div className={`search-wrap ${searchOpen ? "open" : ""}`}>
            <button className="search-toggle" onClick={() => {
              if (searchOpen && search) { setSearch(""); }
              setSearchOpen(o => !o);
            }} title={searchOpen ? "Close search" : "Search"}>
              {searchOpen && search ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              )}
            </button>
            {searchOpen && (
              <input className="search-input" placeholder="Search spots, cities, descriptions…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus/>
            )}
          </div>
          <button className={`filter-toggle ${showFilters || hasActiveFilters ? "on" : ""}`} onClick={()=>setShowFilters(f=>!f)}>
            ⚙ Filters {hasActiveFilters && `(${[activeCategories.size < CATEGORIES.length, statusFilter !== "all", strollerFilter].filter(Boolean).length})`}
          </button>
          <span className="filter-count">{filtered.length} {filtered.length === 1 ? "spot" : "spots"}</span>
        </div>

        {showFilters && (
          <div className="filters-expanded">
            <div className="fg">
              <span className="fl">Category</span>
              {CATEGORIES.map(cat => (
                <button key={cat.id} className={`chip ${activeCategories.has(cat.id)?"on":""}`}
                  onClick={() => setActiveCategories(p => { const n=new Set(p); n.has(cat.id)?n.delete(cat.id):n.add(cat.id); return n; })}>
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
              <button className={`chip ${strollerFilter?"on":""}`} onClick={()=>setStrollerFilter(f=>!f)}>🍼 Stroller Friendly</button>
            </div>
          </div>
        )}

        <div className="main">
          <div className="map-wrap">
            <div ref={mapRef} style={{width:"100%",height:"100%"}}/>
            {!mapReady && (
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-soft)",fontFamily:"var(--fb)",fontSize:"14px",color:"var(--text-light)"}}>
                Loading map…
              </div>
            )}
            <button className="add-btn" onClick={()=>{setShowAddForm(true);setSelectedSpotId(null);}}>+</button>
          </div>

          <div className="sb">
            {showAddForm ? (
              <div className="form">
                <div className="form-title">Add a new spot</div>
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
                <div className="frow">
                  <div className="fg2"><label className="flbl">Latitude *</label><input className="finp" placeholder="35.0094" value={newSpot.lat} onChange={e=>setNewSpot(p=>({...p,lat:e.target.value}))}/></div>
                  <div className="fg2"><label className="flbl">Longitude *</label><input className="finp" placeholder="135.6722" value={newSpot.lng} onChange={e=>setNewSpot(p=>({...p,lng:e.target.value}))}/></div>
                </div>
                <p className="hint">💡 Right-click any spot on Google Maps → "What's here?" to get the coordinates</p>
                <div className="fg2">
                  <label className="flbl">Status</label>
                  <select className="finp" value={newSpot.status} onChange={e=>setNewSpot(p=>({...p,status:e.target.value}))}>
                    <option value="want">🌟 Want to go</option>
                    <option value="visited">✅ Already visited</option>
                  </select>
                </div>
                <label className="fchk"><input type="checkbox" checked={newSpot.strollerFriendly} onChange={e=>setNewSpot(p=>({...p,strollerFriendly:e.target.checked}))}/> 🍼 Stroller friendly</label>
                <p className="hint" style={{marginTop:"10px"}}>You can write the full description after creating the spot ✨</p>
                <div className="factions">
                  <button className="btn p" onClick={addSpot}>Save spot</button>
                  <button className="btn" onClick={()=>setShowAddForm(false)}>Cancel</button>
                </div>
              </div>
            ) : selectedSpot ? (
              <div className="detail">
                <div className="cover">
                  <button className="back-btn" onClick={()=>setSelectedSpotId(null)}>← All spots</button>
                  <button className="share-btn" onClick={()=>shareSpot(selectedSpot)} title="Copy share link">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Share
                  </button>
                  {selectedSpot.images && selectedSpot.images[0] ? (
                    <>
                      <img src={selectedSpot.images[0]} alt={selectedSpot.name}/>
                      <div className="cover-overlay"/>
                    </>
                  ) : (
                    <div className="cover-empty">{getCat(selectedSpot.category).emoji}</div>
                  )}
                </div>

                <div className="detail-body">
                  <span className="cat-badge">{getCat(selectedSpot.category).emoji} {getCat(selectedSpot.category).label}</span>
                  <div className="spot-name">{selectedSpot.name}</div>
                  <div className="spot-loc">{selectedSpot.city}{selectedSpot.city&&selectedSpot.country?" · ":""}{selectedSpot.country}</div>

                  <div className="dates-row">
                    {selectedSpot.visitedDate && <span><strong>Visited:</strong> {formatDate(selectedSpot.visitedDate)}</span>}
                    {selectedSpot.updatedAt && <span><strong>Updated:</strong> {formatDate(selectedSpot.updatedAt)}</span>}
                  </div>

                  <div className="meta-row">
                    <span className={`tag ${selectedSpot.status==="visited"?"active":""}`} onClick={()=>toggleVisited(selectedSpot.id)} style={{cursor:"pointer"}}>
                      {selectedSpot.status==="visited"?"✅ Visited":"🌟 Want to go"}
                    </span>
                    {selectedSpot.strollerFriendly && <span className="tag">🍼 Stroller friendly</span>}
                    <div style={{marginLeft:"auto"}}>
                      <StarRating rating={selectedSpot.rating} onRate={r=>updateRating(selectedSpot.id,r)} readonly={selectedSpot.status!=="visited"}/>
                    </div>
                  </div>

                  {/* PHOTO GALLERY */}
                  <PhotoGallery
                    images={selectedSpot.images || []}
                    onAdd={()=>addImage(selectedSpot.id)}
                    onRemove={(i)=>removeImage(selectedSpot.id, i)}
                  />

                  {/* RICH TEXT EDITOR */}
                  <RichEditor
                    key={selectedSpot.id}
                    content={selectedSpot.content}
                    onChange={(html) => updateSpot(selectedSpot.id, "content", html)}
                  />

                  {/* Links */}
                  <div className="block">
                    <div className="slbl">🔗 Links & Resources</div>
                    {(selectedSpot.links || []).map((link, i) => (
                      <a key={i} href={link.url} target="_blank" rel="noopener" className="link-item">
                        <svg className="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        {link.label}
                      </a>
                    ))}
                    <button className="add-link-btn" onClick={() => {
                      const label = prompt("Link name (e.g. 'View on Outdooractive'):");
                      if (!label) return;
                      const url = prompt("Paste the URL:");
                      if (!url) return;
                      updateSpot(selectedSpot.id, "links", [...(selectedSpot.links || []), { label, url }]);
                    }}>+ Add a link</button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="list-hdr">Your spots<span className="list-cnt">{filtered.length} {filtered.length === 1 ? "place" : "places"} showing</span></div>
                {filtered.length===0?(
                  <div style={{padding:"32px 26px",textAlign:"center",color:"var(--text-light)",fontSize:"14px",lineHeight:1.7}}>No spots match your search or filters.<br/>Try adjusting them or add a new spot!</div>
                ):filtered.map(spot=>{
                  const cat=getCat(spot.category);
                  return(
                    <div key={spot.id} className="si" onClick={()=>{ setSelectedSpotId(spot.id); setShowAddForm(false); }}>
                      <span className="si-emoji">{cat.emoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="si-name">{spot.name}</div>
                        <div className="si-sub">{spot.city}{spot.city&&spot.country?" · ":""}{spot.country}</div>
                        {spot.rating&&<div style={{marginTop:"6px"}}><StarRating rating={spot.rating} readonly/></div>}
                      </div>
                      <div className={`si-dot ${spot.status === "want" ? "want" : ""}`}/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {shareNotice && <div className="toast">✓ Link copied to clipboard</div>}
      </div>
    </>
  );
}
