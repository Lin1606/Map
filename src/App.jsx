import { useState, useEffect, useRef } from "react";

// ============================================================
// 👋 TUTORIAL: YOUR CATEGORIES
// Like column headers in Excel. Each has:
// - id: the "code name" used behind the scenes
// - label: what shows on screen
// - emoji: the icon
// - color: the pin/badge color
//
// TO ADD A CATEGORY LATER:
// Copy any line and change the details. That's it!
// ============================================================
const CATEGORIES = [
  { id: "hiking",     label: "Hiking",             emoji: "🥾", color: "#8B7355" },
  { id: "nature",     label: "Relaxed Nature",      emoji: "🌿", color: "#7A9E7E" },
  { id: "museum",     label: "Museum",              emoji: "🏛️", color: "#9B8EA8" },
  { id: "food",       label: "Food & Drinks",       emoji: "🍜", color: "#C49A6C" },
  { id: "historical", label: "Historical & Hidden", emoji: "🏯", color: "#A87B7B" },
];

// ============================================================
// 👋 TUTORIAL: YOUR SPOTS
// Each spot = one row in a spreadsheet.
// - id: unique number, keep incrementing
// - name: place name
// - category: must match an id from CATEGORIES above
// - lat/lng: coordinates (right-click Google Maps → "What's here?")
// - country, city: location info
// - description: what is this place?
// - tips: your personal notes
// - status: "visited" or "want"
// - rating: 1-5, or null if not visited yet
// - strollerFriendly: true or false
// - image: (optional) paste a photo URL here
// ============================================================
const INITIAL_SPOTS = [
  {
    id: 1, name: "Maxipark Hamm", category: "nature",
    lat: 51.6912, lng: 7.8601, country: "Germany", city: "Hamm",
    description: "Beautiful park with open meadows, a lake and lovely walking paths. Perfect for a slow morning with the pram.",
    tips: "Weekday mornings are calm and beautiful. The lake path is completely flat — great for the stroller.",
    status: "visited", rating: 4, strollerFriendly: true,
  },
  {
    id: 2, name: "Westfälisches Freilichtmuseum", category: "museum",
    lat: 51.3602, lng: 7.4856, country: "Germany", city: "Hagen",
    description: "Open air museum with historical crafts, old buildings and a working water mill. A real half-day trip.",
    tips: "Most paths are stroller friendly. Bring snacks, the café is small. Kids love the mill.",
    status: "visited", rating: 5, strollerFriendly: true,
  },
  {
    id: 3, name: "Arashiyama Bamboo Grove", category: "nature",
    lat: 35.0094, lng: 135.6722, country: "Japan", city: "Kyoto",
    description: "The iconic bamboo forest just outside Kyoto. Ethereal morning light filters through the tall stalks.",
    tips: "Go before 8am before the crowds arrive. The path is flat and mostly pram friendly.",
    status: "want", rating: null, strollerFriendly: true,
    // 👋 TUTORIAL: Add a photo to any spot like this!
    // Go to unsplash.com, find a photo, right-click → "Copy image address"
    image: "https://images.unsplash.com/photo-1611918900220-de58f4374b85?w=800&q=80",
  },
  {
    id: 4, name: "Philosopher's Path", category: "nature",
    lat: 35.0272, lng: 135.7936, country: "Japan", city: "Kyoto",
    description: "A quiet canal-side walk lined with hundreds of cherry trees. One of the most beautiful walks in Japan.",
    tips: "Magical during cherry blossom season (late March). Flat path, fully stroller friendly.",
    status: "want", rating: null, strollerFriendly: true,
  },
  {
    id: 5, name: "Teutoburger Wald", category: "hiking",
    lat: 51.9127, lng: 8.7564, country: "Germany", city: "Detmold",
    description: "Beautiful forested hills with marked trails of varying difficulty. Feels remote but very accessible from NRW.",
    tips: "Easier valley trails work with a hiking stroller. The Hermannsdenkmal monument is worth the detour.",
    status: "want", rating: null, strollerFriendly: false,
  },
  {
    id: 6, name: "Fushimi Inari Taisha", category: "historical",
    lat: 34.9671, lng: 135.7727, country: "Japan", city: "Kyoto",
    description: "Thousands of vermillion torii gates winding up a forested mountain. Magical at any time of day.",
    tips: "Early morning or evening for fewer crowds. Lower paths are stroller friendly, upper trails are steep.",
    status: "want", rating: null, strollerFriendly: false,
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
          style={{ cursor: readonly ? "default" : "pointer", fontSize: "15px", color: s <= (hovered ?? rating ?? 0) ? "#C49A6C" : "#E8E0D8", transition: "color 0.15s" }}
        >★</span>
      ))}
    </div>
  );
}

export default function AdventureMap() {
  const [spots, setSpots] = useState(INITIAL_SPOTS);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [activeCategories, setActiveCategories] = useState(new Set(CATEGORIES.map(c => c.id)));
  const [statusFilter, setStatusFilter] = useState("all");
  const [strollerFilter, setStrollerFilter] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [newSpot, setNewSpot] = useState({
    name:"", category:"nature", lat:"", lng:"",
    country:"", city:"", description:"", tips:"",
    status:"want", rating:null, strollerFriendly:false,
  });
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef({});

  const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];

  const filtered = spots.filter(s => {
    if (!activeCategories.has(s.category)) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (strollerFilter && !s.strollerFriendly) return false;
    return true;
  });

  // Load Leaflet CSS + JS dynamically
  useEffect(() => {
    if (window.L) { setMapReady(true); return; }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  // Init map once Leaflet is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMap.current) return;

    const L = window.L;
    const map = L.map(mapRef.current, {
      center: [40, 20],
      zoom: 3,
      zoomControl: true,
    });

    // 👋 TUTORIAL: This is the map style — "tiles" are the little square images
    // that make up the map. You can swap this URL for a different style!
    // Some free alternatives:
    // Soft/light: https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
    // Minimal:    https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    leafletMap.current = map;
  }, [mapReady]);

  // Update markers whenever filtered spots change
  useEffect(() => {
    if (!mapReady || !leafletMap.current) return;
    const L = window.L;
    const map = leafletMap.current;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    // Add new markers
    filtered.forEach(spot => {
      const cat = getCat(spot.category);
      const isVisited = spot.status === "visited";

      // 👋 TUTORIAL: This creates a custom HTML pin for each spot.
      // The color comes from the category, the ring shows if visited or not.
      const icon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:${spot.strollerFriendly ? "28px" : "24px"};
            height:${spot.strollerFriendly ? "28px" : "24px"};
            border-radius:50%;
            background:${isVisited ? cat.color : "white"};
            border:2.5px solid ${cat.color};
            display:flex;align-items:center;justify-content:center;
            font-size:11px;
            box-shadow:0 2px 8px rgba(0,0,0,0.18);
            cursor:pointer;
            transition:transform 0.15s;
          ">${isVisited ? "" : spot.strollerFriendly ? "🍼" : cat.emoji}</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([spot.lat, spot.lng], { icon })
        .addTo(map)
        .bindTooltip(spot.name, { direction: "top", offset: [0, -14], className: "map-tooltip" });

      marker.on("click", () => {
        setSelectedSpot(spot);
        setShowAddForm(false);
      });

      markersRef.current[spot.id] = marker;
    });
  }, [mapReady, filtered, spots]);

  // Fly to selected spot on map
  useEffect(() => {
    if (!leafletMap.current || !selectedSpot) return;
    leafletMap.current.flyTo([selectedSpot.lat, selectedSpot.lng], 10, { duration: 1.2 });
  }, [selectedSpot]);

  const addSpot = () => {
    if (!newSpot.name || !newSpot.lat || !newSpot.lng) return;
    const spot = { ...newSpot, id: Date.now(), lat: parseFloat(newSpot.lat), lng: parseFloat(newSpot.lng) };
    setSpots(p => [...p, spot]);
    setShowAddForm(false);
    setNewSpot({ name:"", category:"nature", lat:"", lng:"", country:"", city:"", description:"", tips:"", status:"want", rating:null, strollerFriendly:false });
  };

  const toggleVisited = (id) => {
    setSpots(p => p.map(s => s.id === id ? { ...s, status: s.status === "visited" ? "want" : "visited" } : s));
    setSelectedSpot(p => p?.id === id ? { ...p, status: p.status === "visited" ? "want" : "visited" } : p);
  };

  const updateRating = (id, rating) => {
    setSpots(p => p.map(s => s.id === id ? { ...s, rating } : s));
    setSelectedSpot(p => p?.id === id ? { ...p, rating } : p);
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    :root{
      --cr:#FAF7F4;--pa:#F2EDE6;--sa:#E8DDD0;--wg:#C8BCB0;
      --td:#2C2420;--tm:#6B5B50;--tl:#9B8B80;
      --sage:#7A9E7E;--blush:#D4A5A0;--gold:#C49A6C;
      --fd:'Cormorant Garamond',serif;--fb:'Jost',sans-serif;
    }
    body{background:var(--cr)}
    .app{min-height:100vh;background:var(--cr);font-family:var(--fb);color:var(--td)}
    .hdr{padding:18px 28px 14px;border-bottom:1px solid var(--sa);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:var(--cr)}
    .hdr-title{font-family:var(--fd);font-size:26px;font-weight:300;letter-spacing:.02em;color:var(--td)}
    .hdr-title em{font-style:italic;color:var(--tm)}
    .hdr-sub{font-size:10px;font-weight:200;letter-spacing:.15em;text-transform:uppercase;color:var(--tl);margin-top:2px}
    .filters{padding:10px 28px;border-bottom:1px solid var(--sa);background:var(--pa);display:flex;gap:20px;align-items:center;flex-wrap:wrap}
    .fl{font-size:9px;font-weight:300;letter-spacing:.14em;text-transform:uppercase;color:var(--tl);margin-right:3px}
    .fg{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
    .chip{padding:3px 11px;border-radius:20px;font-size:11px;font-weight:300;letter-spacing:.04em;cursor:pointer;border:1px solid var(--sa);background:transparent;color:var(--tm);transition:all .18s;font-family:var(--fb)}
    .chip:hover{border-color:var(--wg);color:var(--td)}
    .chip.on{background:var(--td);color:var(--cr);border-color:var(--td)}
    .main{display:grid;grid-template-columns:1fr 370px;height:calc(100vh - 108px)}
    .map-wrap{position:relative;overflow:hidden}
    .sb{border-left:1px solid var(--sa);overflow-y:auto;background:var(--cr)}
    .detail{padding:0;animation:fi .22s ease}
    @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
    .back-btn{background:none;border:none;cursor:pointer;font-size:10px;font-weight:200;letter-spacing:.12em;color:var(--tl);margin-bottom:14px;font-family:var(--fb);padding:0;display:flex;align-items:center;gap:3px;text-transform:uppercase}
    .cat-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:300;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;color:white}
    .spot-name{font-family:var(--fd);font-size:25px;font-weight:300;line-height:1.2;color:var(--td);margin-bottom:3px}
    .spot-loc{font-size:10px;font-weight:200;letter-spacing:.14em;text-transform:uppercase;color:var(--tl);margin-bottom:14px}
    .tags{display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap}
    .tag{padding:3px 10px;border-radius:12px;font-size:10px;font-weight:300;letter-spacing:.07em;border:1px solid var(--sa);color:var(--tm)}
    .tag.v{background:#EBF3EC;border-color:var(--sage);color:var(--sage)}
    .tag.w{background:#F7EDEC;border-color:var(--blush);color:#B07A76}
    .tag.s{background:#FBF4EA;border-color:var(--gold);color:#9B7240}
    .div{height:1px;background:var(--sa);margin:14px 0}
    .slbl{font-size:9px;font-weight:300;letter-spacing:.2em;text-transform:uppercase;color:var(--tl);margin-bottom:5px}
    .desc{font-size:13px;font-weight:300;line-height:1.75;color:var(--tm);margin-bottom:10px}
    .tips-box{font-size:12px;font-weight:300;line-height:1.75;color:var(--tm);font-style:italic;padding:11px 13px;background:var(--pa);border-radius:7px;border-left:2px solid var(--gold)}
    .btn{padding:7px 16px;border-radius:20px;font-size:11px;font-weight:300;letter-spacing:.07em;cursor:pointer;border:1px solid var(--sa);background:transparent;color:var(--tm);transition:all .18s;font-family:var(--fb)}
    .btn:hover{background:var(--pa)}
    .btn.p{background:var(--td);color:var(--cr);border-color:var(--td)}
    .btn.p:hover{background:var(--tm)}
    .list-hdr{padding:18px 22px 10px;font-family:var(--fd);font-size:19px;font-weight:300;color:var(--td);border-bottom:1px solid var(--sa)}
    .list-cnt{font-size:10px;font-weight:200;color:var(--tl);letter-spacing:.1em;font-family:var(--fb);display:block;margin-top:2px}
    .si{padding:13px 22px;border-bottom:1px solid var(--pa);cursor:pointer;transition:background .13s;display:flex;align-items:flex-start;gap:11px}
    .si:hover{background:var(--pa)}
    .si-name{font-family:var(--fd);font-size:16px;font-weight:300;color:var(--td);line-height:1.2}
    .si-sub{font-size:10px;font-weight:200;letter-spacing:.1em;text-transform:uppercase;color:var(--tl);margin-top:2px}
    .si-dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex-shrink:0;margin-left:auto}
    .add-btn{position:absolute;bottom:20px;right:20px;width:42px;height:42px;border-radius:50%;background:var(--td);color:var(--cr);border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.18);transition:transform .18s;z-index:999;font-family:var(--fb)}
    .add-btn:hover{transform:scale(1.08)}
    .form{padding:22px;animation:fi .22s ease}
    .form-title{font-family:var(--fd);font-size:21px;font-weight:300;color:var(--td);margin-bottom:18px}
    .fg2{margin-bottom:12px}
    .flbl{display:block;font-size:9px;font-weight:300;letter-spacing:.2em;text-transform:uppercase;color:var(--tl);margin-bottom:4px}
    .finp{width:100%;padding:7px 11px;border:1px solid var(--sa);border-radius:6px;background:var(--pa);font-family:var(--fb);font-size:13px;font-weight:300;color:var(--td);outline:none;transition:border-color .18s}
    .finp:focus{border-color:var(--wg)}
    .frow{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .fchk{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:300;color:var(--tm);cursor:pointer}
    .factions{display:flex;gap:9px;margin-top:18px}
    .hint{font-size:10px;color:var(--tl);font-weight:200;margin-top:-6px;margin-bottom:10px;line-height:1.5}
    .map-tooltip{background:var(--td)!important;color:var(--cr)!important;border:none!important;border-radius:5px!important;font-family:var(--fb)!important;font-size:11px!important;font-weight:300!important;padding:4px 10px!important;box-shadow:0 2px 8px rgba(0,0,0,.15)!important}
    .map-tooltip::before{display:none!important}
    .leaflet-control-attribution{font-size:9px!important;opacity:0.6}
    @media(max-width:680px){.main{grid-template-columns:1fr;grid-template-rows:50vh 1fr}.hdr{padding:12px 16px}.filters{padding:8px 16px;gap:10px}}
  `;

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* HEADER */}
        <div className="hdr">
          <div>
            <div className="hdr-title">Our <em>Map</em></div>
            <div className="hdr-sub">Adventures & Places We Love</div>
          </div>
          <span style={{fontSize:"11px",fontWeight:200,color:"var(--tl)",letterSpacing:".05em"}}>{filtered.length} spot{filtered.length!==1?"s":""}</span>
        </div>

        {/* FILTERS */}
        <div className="filters">
          <div className="fg">
            <span className="fl">Category</span>
            {CATEGORIES.map(cat => (
              <button key={cat.id} className={`chip ${activeCategories.has(cat.id)?"on":""}`}
                style={activeCategories.has(cat.id)?{background:cat.color,borderColor:cat.color,color:"white"}:{}}
                onClick={() => setActiveCategories(p => { const n=new Set(p); n.has(cat.id)?n.delete(cat.id):n.add(cat.id); return n; })}>
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
          <div className="fg">
            <span className="fl">Status</span>
            {[["all","All"],["visited","✅ Visited"],["want","🌟 Want to go"]].map(([v,l])=>(
              <button key={v} className={`chip ${statusFilter===v?"on":""}`}
                style={statusFilter===v&&v==="visited"?{background:"var(--sage)",borderColor:"var(--sage)",color:"white"}:statusFilter===v&&v==="want"?{background:"var(--blush)",borderColor:"var(--blush)",color:"white"}:{}}
                onClick={()=>setStatusFilter(v)}>{l}</button>
            ))}
          </div>
          <div className="fg">
            <button className={`chip ${strollerFilter?"on":""}`}
              style={strollerFilter?{background:"var(--gold)",borderColor:"var(--gold)",color:"white"}:{}}
              onClick={()=>setStrollerFilter(f=>!f)}>🍼 Stroller Friendly</button>
          </div>
        </div>

        <div className="main">
          {/* MAP */}
          <div className="map-wrap">
            {/* 👋 TUTORIAL: This div is where the Leaflet map gets drawn.
                Leaflet takes over this empty box and fills it with a real map! */}
            <div ref={mapRef} style={{width:"100%",height:"100%"}}/>
            {!mapReady && (
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--pa)",fontFamily:"var(--fb)",fontSize:"12px",fontWeight:200,color:"var(--tl)",letterSpacing:".1em"}}>
                Loading map…
              </div>
            )}
            <button className="add-btn" onClick={()=>{setShowAddForm(true);setSelectedSpot(null);}}>+</button>
          </div>

          {/* SIDEBAR */}
          <div className="sb">
            {showAddForm ? (
              <div className="form">
                <div className="form-title">Add a <em style={{fontStyle:"italic"}}>new spot</em></div>
                <div className="fg2">
                  <label className="flbl">Name *</label>
                  <input className="finp" placeholder="e.g. Arashiyama Bamboo Grove" value={newSpot.name} onChange={e=>setNewSpot(p=>({...p,name:e.target.value}))}/>
                </div>
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
                <div className="fg2"><label className="flbl">Description</label><textarea className="finp" style={{resize:"vertical",minHeight:"64px",lineHeight:1.65}} placeholder="What is this place? What makes it special?" value={newSpot.description} onChange={e=>setNewSpot(p=>({...p,description:e.target.value}))}/></div>
                <div className="fg2"><label className="flbl">Your Tips</label><textarea className="finp" style={{resize:"vertical",minHeight:"60px",lineHeight:1.65}} placeholder="Best time to visit, what to bring..." value={newSpot.tips} onChange={e=>setNewSpot(p=>({...p,tips:e.target.value}))}/></div>
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
              <div className="detail">
                {selectedSpot.image ? (
                  <div style={{position:"relative",width:"100%",height:"195px",overflow:"hidden",flexShrink:0}}>
                    <img src={selectedSpot.image} alt={selectedSpot.name}
                      style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 30%,rgba(44,36,32,0.6) 100%)"}}/>
                    <button className="back-btn" onClick={()=>setSelectedSpot(null)}
                      style={{position:"absolute",top:12,left:14,color:"white",background:"rgba(0,0,0,0.28)",padding:"4px 10px",borderRadius:"12px",backdropFilter:"blur(6px)",border:"1px solid rgba(255,255,255,0.2)"}}>
                      ← All spots
                    </button>
                  </div>
                ) : null}
                <div style={{padding:"20px 22px 26px"}}>
                  {!selectedSpot.image && <button className="back-btn" onClick={()=>setSelectedSpot(null)}>← All spots</button>}
                  {(()=>{const cat=getCat(selectedSpot.category);return(
                    <span className="cat-badge" style={{background:cat.color}}>{cat.emoji} {cat.label}</span>
                  );})()}
                  <div className="spot-name">{selectedSpot.name}</div>
                  <div className="spot-loc">{selectedSpot.city}{selectedSpot.city&&selectedSpot.country?" · ":""}{selectedSpot.country}</div>
                  <div className="tags">
                    <span className={`tag ${selectedSpot.status==="visited"?"v":"w"}`}>{selectedSpot.status==="visited"?"✅ Visited":"🌟 Want to go"}</span>
                    {selectedSpot.strollerFriendly&&<span className="tag s">🍼 Stroller friendly</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px"}}>
                    <StarRating rating={selectedSpot.rating} onRate={r=>updateRating(selectedSpot.id,r)} readonly={selectedSpot.status!=="visited"}/>
                    {selectedSpot.status!=="visited"&&<span style={{fontSize:"10px",color:"var(--tl)",fontWeight:200}}>visit first to rate</span>}
                  </div>
                  <div className="div"/>
                  {selectedSpot.description&&<><div className="slbl">About this place</div><div className="desc">{selectedSpot.description}</div></>}
                  {selectedSpot.tips&&<><div className="slbl" style={{marginTop:"10px"}}>Tips & Notes</div><div className="tips-box">{selectedSpot.tips}</div></>}
                  <div className="div"/>
                  <button className="btn p" onClick={()=>toggleVisited(selectedSpot.id)}>
                    {selectedSpot.status==="visited"?"Move to wish list":"Mark as visited ✅"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="list-hdr">Your spots<span className="list-cnt">{filtered.length} place{filtered.length!==1?"s":""} showing</span></div>
                {filtered.length===0?(
                  <div style={{padding:"28px 22px",textAlign:"center",color:"var(--tl)",fontSize:"13px",fontWeight:200,lineHeight:1.7}}>No spots match your filters.<br/>Try adjusting above or add a new spot!</div>
                ):filtered.map(spot=>{
                  const cat=getCat(spot.category);
                  return(
                    <div key={spot.id} className="si" onClick={()=>{ setSelectedSpot(spot); setShowAddForm(false); }}>
                      <span style={{fontSize:"18px",flexShrink:0,marginTop:"2px"}}>{cat.emoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="si-name">{spot.name}</div>
                        <div className="si-sub">{spot.city}{spot.city&&spot.country?" · ":""}{spot.country}</div>
                        {spot.rating&&<div style={{marginTop:"3px"}}><StarRating rating={spot.rating} readonly/></div>}
                      </div>
                      <div className="si-dot" style={{background:spot.status==="visited"?"var(--sage)":"var(--blush)"}}/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
