import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';

// ── Vul hier je NS API key in van https://apiportal.ns.nl ──
const NS_API_KEY = '7383917274334e0dad1099b05e091088';

// Zet op true om mock-data te zien zonder API key of locatie
const DEMO_MODE = false;

const DESTINATIONS = [
  { code: 'RTD',  label: 'Rotterdam Centraal' },
  { code: 'ASA',  label: 'Amsterdam Amstel' },
  { code: 'ASD',  label: 'Amsterdam Centraal' },
  { code: 'ASDZ', label: 'Amsterdam Zuid' },
  { code: 'ASB',  label: 'Amsterdam Bijlmer ArenA' },
  { code: 'ASS',  label: 'Amsterdam Sloterdijk' },
  { code: 'UT',   label: 'Utrecht Centraal' },
  { code: 'GVC',  label: 'Den Haag Centraal' },
  { code: 'SHL',  label: 'Schiphol Airport' },
  { code: 'EHV',  label: 'Eindhoven' },
  { code: 'AMF',  label: 'Amersfoort Centraal' },
  { code: 'ZL',   label: 'Zwolle' },
  { code: 'LLS',  label: 'Lelystad Centrum' },
  { code: 'HVS',  label: 'Hilversum' },
  { code: 'ALM',  label: 'Almere Centrum' },
  { code: 'DV',   label: 'Deventer' },
  { code: 'GN',   label: 'Groningen' },
  { code: 'NM',   label: 'Nijmegen' },
  { code: 'HT',   label: 'Den Bosch' },
  { code: 'MT',   label: 'Maastricht' },
];

const STORAGE_KEY = 'train_home_destination';

function loadDestination() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const dest = DESTINATIONS.find(d => d.code === saved);
      if (dest) return dest;
    }
  } catch {}
  return DESTINATIONS[0];
}

function saveDestination(code: string) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch {}
}

// ── Stations met coördinaten voor dichtstbijzijnde-berekening ──
const STATIONS = [
  { code: 'ASD',  name: 'Amsterdam Centraal',      lat: 52.3791, lng: 4.8999 },
  { code: 'ASA',  name: 'Amsterdam Amstel',         lat: 52.3464, lng: 4.9170 },
  { code: 'ASS',  name: 'Amsterdam Sloterdijk',     lat: 52.3889, lng: 4.8378 },
  { code: 'ASB',  name: 'Amsterdam Bijlmer ArenA',  lat: 52.3125, lng: 4.9472 },
  { code: 'ASDZ', name: 'Amsterdam Zuid',            lat: 52.3388, lng: 4.8729 },
  { code: 'ASDM', name: 'Amsterdam Muiderpoort',    lat: 52.3619, lng: 4.9356 },
  { code: 'RAI',  name: 'Amsterdam RAI',            lat: 52.3393, lng: 4.8935 },
  { code: 'ASSP', name: 'Amsterdam Sciencepark',    lat: 52.3568, lng: 4.9475 },
  { code: 'DMN',  name: 'Diemen',                   lat: 52.3432, lng: 4.9638 },
  { code: 'DMNZ', name: 'Diemen Zuid',              lat: 52.3333, lng: 4.9611 },
  { code: 'DUD',  name: 'Duivendrecht',             lat: 52.3218, lng: 4.9480 },
  { code: 'WP',   name: 'Weesp',                    lat: 52.3089, lng: 5.0426 },
  { code: 'NDB',  name: 'Naarden-Bussum',           lat: 52.2979, lng: 5.1522 },
  { code: 'BSMZ', name: 'Bussum Zuid',              lat: 52.2740, lng: 5.1630 },
  { code: 'HVS',  name: 'Hilversum',                lat: 52.2265, lng: 5.1812 },
  { code: 'HVSM', name: 'Hilversum Media Park',     lat: 52.2167, lng: 5.1780 },
  { code: 'ALM',  name: 'Almere Centrum',           lat: 52.3748, lng: 5.2166 },
  { code: 'ALMB', name: 'Almere Buiten',            lat: 52.3843, lng: 5.2563 },
  { code: 'SHL',  name: 'Schiphol Airport',         lat: 52.3108, lng: 4.7645 },
  { code: 'HOO',  name: 'Hoofddorp',                lat: 52.2963, lng: 4.6939 },
  { code: 'UT',   name: 'Utrecht Centraal',         lat: 52.0896, lng: 5.1101 },
  { code: 'AMF',  name: 'Amersfoort Centraal',      lat: 52.1554, lng: 5.3750 },
  { code: 'ZL',   name: 'Zwolle',                   lat: 52.5047, lng: 6.0938 },
  { code: 'LLS',  name: 'Lelystad Centrum',         lat: 52.5033, lng: 5.4755 },
  { code: 'RTD',  name: 'Rotterdam Centraal',       lat: 51.9247, lng: 4.4691 },
  { code: 'EHV',  name: 'Eindhoven',                lat: 51.4440, lng: 5.4794 },
];

interface Trip {
  departureTime: string;        // actual departure from origin
  plannedDepartureTime: string;
  arrivalTime: string;          // actual arrival at destination
  track: string;                // platform at origin
  transfers: number;
  trainName: string;            // e.g. "Sprinter 5842"
  cancelled: boolean;
}

function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dG = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestStation(lat: number, lng: number) {
  return STATIONS.reduce((best, s) =>
    km(lat, lng, s.lat, s.lng) < km(lat, lng, best.lat, best.lng) ? s : best
  );
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function secsUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 1000);
}

// Parse raw NS trip into our Trip model
function parseTrip(t: any): Trip | null {
  const legs = t.legs;
  if (!legs?.length) return null;
  const firstLeg = legs[0];
  const lastLeg  = legs[legs.length - 1];
  if (t.status === 'CANCELLED') return null;
  return {
    plannedDepartureTime: firstLeg.origin.plannedDateTime,
    departureTime:  firstLeg.origin.actualDateTime ?? firstLeg.origin.plannedDateTime,
    arrivalTime:    lastLeg.destination.actualDateTime ?? lastLeg.destination.plannedDateTime,
    track:          firstLeg.origin.actualTrack ?? firstLeg.origin.plannedTrack ?? '—',
    transfers:      t.transfers ?? legs.length - 1,
    trainName:      legs.map((l: any) => l.product?.shortCategoryName ?? '').filter(Boolean).join(' + '),
    cancelled:      false,
  };
}

const BLUE = '#003082';
const GOLD = '#FFD700';
const RED  = '#FE0437';

// Lower = better quality (IC=1, mix=2, Sprinter=3)
function trainQuality(trainName: string): number {
  const n = trainName.toLowerCase();
  const hasIC = n.includes('intercity') || n.includes(' ic');
  const hasSprinter = n.includes('sprinter');
  if (hasIC && !hasSprinter) return 1;
  if (hasIC && hasSprinter) return 2;
  return 3;
}

const WALK_SPEED = 1.4; // m/s normal walking pace

// Returns a color between green→orange→red based on whether you can make the train
function catchColor(secsLeft: number, distMeters: number | null): string {
  if (distMeters === null || secsLeft <= 0) return '#999';
  const walkSecs = distMeters / WALK_SPEED;
  const ratio = secsLeft / walkSecs; // >1 means enough time
  if (ratio >= 2.0) return '#22C55E';   // green — comfortably on time
  if (ratio >= 1.4) return '#84CC16';   // yellow-green
  if (ratio >= 1.0) return '#F97316';   // orange — just make it
  return '#EF4444';                      // red — too late
}

function Countdown({ iso, distMeters, inverse }: { iso: string; distMeters: number | null; inverse?: boolean }) {
  const [s, setS] = useState(() => secsUntil(iso));
  useEffect(() => {
    const id = setInterval(() => setS(secsUntil(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);

  const textColor = inverse ? '#FFF' : '#003082';
  const urgentColor = inverse ? '#FFD700' : '#FE0437';

  if (s <= 0) return <Text style={[cd.gone, inverse && { color: 'rgba(255,255,255,0.5)' }]}>Vertrokken</Text>;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const dot = catchColor(s, distMeters);
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[cd.text, { color: m < 3 ? urgentColor : textColor }]}>
        {m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${s}s`}
      </Text>
      <View style={[cd.dot, { backgroundColor: dot }]} />
    </View>
  );
}

const cd = StyleSheet.create({
  text: { fontSize: 22, fontWeight: '900', textAlign: 'right' },
  gone: { color: '#999', fontSize: 14, fontWeight: '600' },
  dot:  { width: 10, height: 10, borderRadius: 5, marginTop: 4, alignSelf: 'flex-end' },
});

function TrainCard({ trip, dest, selected, onPress, distMeters }: {
  trip: Trip; dest: string; selected: boolean;
  onPress: () => void; distMeters: number | null;
}) {
  const delayed = trip.departureTime !== trip.plannedDepartureTime;
  const inv = selected;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <View style={[card.wrap, inv && card.wrapInv]}>
        <View style={[card.perron, inv && card.perronInv]}>
          <Text style={[card.perronLabel, inv && { color: BLUE }]}>Perron</Text>
          <Text style={[card.perronNum, inv && { color: BLUE }]}>{trip.track}</Text>
        </View>
        <View style={card.center}>
          <Text style={[card.dest, inv && { color: '#FFF' }]}>{dest}</Text>
          <View style={card.timeRow}>
            <Text style={[card.timeVal, delayed && card.delayed, inv && !delayed && { color: 'rgba(255,255,255,0.9)' }]}>{hhmm(trip.departureTime)}</Text>
            {delayed && <Text style={[card.planned, inv && { color: 'rgba(255,255,255,0.5)' }]}>{hhmm(trip.plannedDepartureTime)}</Text>}
            <Text style={[card.arrow, inv && { color: 'rgba(255,255,255,0.4)' }]}> → </Text>
            <Text style={[card.timeVal, inv && { color: 'rgba(255,255,255,0.9)' }]}>{hhmm(trip.arrivalTime)}</Text>
          </View>
          <Text style={[card.transfers, inv && { color: 'rgba(255,255,255,0.6)' }]}>
            {trip.transfers === 0 ? `Direct · ${trip.trainName}` : trip.transfers === 1 ? `1 overstap · ${trip.trainName}` : `${trip.transfers} overstappen · ${trip.trainName}`}
          </Text>
        </View>
        <View style={card.timerWrap}>
          <Countdown iso={trip.departureTime} distMeters={distMeters} inverse={inv} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Fullscreen landscape view for selected trip
function LandscapeView({ trip, dest, distMeters }: { trip: Trip; dest: string; distMeters: number | null }) {
  const delayed = trip.departureTime !== trip.plannedDepartureTime;
  return (
    <View style={ls.wrap}>
      <View style={ls.perronBlock}>
        <Text style={ls.perronLabel}>Perron</Text>
        <Text style={ls.perronNum}>{trip.track}</Text>
      </View>
      <View style={ls.main}>
        <Text style={ls.dest}>{dest}</Text>
        <View style={ls.timeRow}>
          <Text style={[ls.time, delayed && { color: '#FFD700' }]}>{hhmm(trip.departureTime)}</Text>
          {delayed && <Text style={ls.planned}>{hhmm(trip.plannedDepartureTime)}</Text>}
          <Text style={ls.arrow}> → </Text>
          <Text style={ls.time}>{hhmm(trip.arrivalTime)}</Text>
        </View>
        <Text style={ls.transfers}>
          {trip.transfers === 0 ? `Direct · ${trip.trainName}` : `${trip.transfers} overstap · ${trip.trainName}`}
        </Text>
      </View>
      <View style={ls.timerBlock}>
        <Countdown iso={trip.departureTime} distMeters={distMeters} inverse />
      </View>
    </View>
  );
}

const ls = StyleSheet.create({
  wrap:        { flex: 1, backgroundColor: BLUE, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 20 },
  perronBlock: { backgroundColor: GOLD, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center', marginRight: 40 },
  perronLabel: { fontSize: 11, color: BLUE, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '800' },
  perronNum:   { fontSize: 64, fontWeight: '900', color: BLUE, lineHeight: 72 },
  main:        { flex: 1 },
  dest:        { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  timeRow:     { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  time:        { color: '#FFF', fontSize: 42, fontWeight: '900' },
  planned:     { color: 'rgba(255,255,255,0.5)', fontSize: 18, textDecorationLine: 'line-through', marginLeft: 8 },
  arrow:       { color: 'rgba(255,255,255,0.4)', fontSize: 28 },
  transfers:   { color: 'rgba(255,255,255,0.65)', fontSize: 16 },
  timerBlock:  { alignItems: 'flex-end', minWidth: 130 },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  wrapInv: { backgroundColor: BLUE },

  // Perron — links
  perron: {
    backgroundColor: BLUE,
    borderRadius: 12,
    width: 64,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 14,
  },
  perronInv:   { backgroundColor: GOLD },
  perronLabel: { fontSize: 9, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  perronNum:   { fontSize: 34, fontWeight: '900', color: '#FFF', lineHeight: 40 },

  // Midden
  center:    { flex: 1 },
  dest:      { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  timeRow:   { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  timeVal:   { fontSize: 15, fontWeight: '700', color: '#111' },
  delayed:   { color: RED },
  planned:   { fontSize: 11, color: '#999', textDecorationLine: 'line-through', marginLeft: 4 },
  arrow:     { fontSize: 14, color: '#BBB' },
  transfers: { fontSize: 12, color: '#888', marginTop: 4 },

  // Timer — rechts
  timerWrap: { marginLeft: 12, alignItems: 'flex-end' },
});

export default function App() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [station, setStation] = useState<typeof STATIONS[0] | null>(null);
  const [stationDist, setStationDist] = useState<number | null>(null);
  const [destination, setDestinationState] = useState(() => loadDestination());
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sortSnelst, setSortSnelst] = useState(false);
  const [sortGemak, setSortGemak] = useState(false);
  const [filterHaalIk, setFilterHaalIk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleDestinationChange(code: string) {
    const dest = DESTINATIONS.find(d => d.code === code) ?? DESTINATIONS[0];
    setDestinationState(dest);
    saveDestination(code);
    if (station) fetchDeps(station.code, code);
  }

  const destinationRef = React.useRef(destination);
  destinationRef.current = destination;

  const fetchDeps = useCallback(async (stationCode: string, destCode?: string) => {
    const toCode = destCode ?? destinationRef.current.code;
    setLoading(true);
    setApiError(null);
    try {
      if (DEMO_MODE) {
        const now = new Date();
        const dt = (m: number) => new Date(now.getTime() + m * 60000).toISOString();
        await new Promise(r => setTimeout(r, 600));
        setTrips([
          { plannedDepartureTime: dt(5),  departureTime: dt(6),  arrivalTime: dt(22), track: '3', transfers: 0, trainName: 'Sprinter',    cancelled: false },
          { plannedDepartureTime: dt(11), departureTime: dt(11), arrivalTime: dt(45), track: '1', transfers: 1, trainName: 'IC + Sprinter', cancelled: false },
          { plannedDepartureTime: dt(19), departureTime: dt(19), arrivalTime: dt(36), track: '3', transfers: 0, trainName: 'Sprinter',    cancelled: false },
          { plannedDepartureTime: dt(29), departureTime: dt(31), arrivalTime: dt(63), track: '4', transfers: 1, trainName: 'Sprinter + IC', cancelled: false },
          { plannedDepartureTime: dt(39), departureTime: dt(39), arrivalTime: dt(56), track: '3', transfers: 0, trainName: 'Intercity',   cancelled: false },
        ]);
        setRefreshed(new Date());
        setLoading(false);
        return;
      }

      if (stationCode === toCode) {
        setTrips([]);
        setRefreshed(new Date());
        setLoading(false);
        setApiError('Je bent al op je bestemming! Kies een ander thuisstation.');
        return;
      }

      const dateTime = encodeURIComponent(new Date().toISOString());
      const res = await fetch(
        `/api/trips?fromStation=${stationCode}&toStation=${toCode}&dateTime=${dateTime}&searchForArrival=false&travelClass=2&maxTransfers=1&numJourneys=10`
      );
      if (!res.ok) {
        if (res.status === 401)
          throw new Error('Ongeldige API key');
        if (res.status === 400)
          throw new Error('Ongeldig station of bestemming — kies een ander thuisstation.');
        throw new Error(`NS API fout ${res.status}`);
      }
      const data = await res.json();
      let parsed: Trip[] = (data.trips ?? [])
        .map(parseTrip)
        .filter(Boolean) as Trip[];

      // Top up to at least 3 future trips if needed
      const futureNow = parsed.filter(t => secsUntil(t.departureTime) > 0);
      if (futureNow.length < 3 && parsed.length > 0) {
        const lastTrip = parsed[parsed.length - 1];
        const laterTime = encodeURIComponent(
          new Date(new Date(lastTrip.departureTime).getTime() + 60000).toISOString()
        );
        const res2 = await fetch(
          `/api/trips?fromStation=${stationCode}&toStation=${toCode}&dateTime=${laterTime}&searchForArrival=false&travelClass=2&maxTransfers=1&numJourneys=5`
        );
        if (res2.ok) {
          const data2 = await res2.json();
          const extra: Trip[] = (data2.trips ?? []).map(parseTrip).filter(Boolean) as Trip[];
          parsed = [...parsed, ...extra];
        }
      }

      setTrips(parsed);
      setRefreshed(new Date());
    } catch (e: any) {
      setApiError(e.message ?? 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  }, []);

  const init = useCallback(async () => {
    setLocError(null);
    if (DEMO_MODE) {
      const s = STATIONS.find(st => st.code === 'HVS')!;
      setStation(s);
      setStationDist(430);
      await fetchDeps(s.code);
      return;
    }

    // On web use navigator.geolocation directly — expo-location doesn't
    // trigger the browser permission dialog reliably in a plain browser.
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) {
        setLocError('Je browser ondersteunt geen locatie.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const s = nearestStation(latitude, longitude);
          const distKm = km(latitude, longitude, s.lat, s.lng);
          setStation(s);
          setStationDist(Math.round(distKm * 1000));
          await fetchDeps(s.code);
        },
        (err) => {
          setLocError('Locatietoestemming geweigerd. Klik op het slotje in de adresbalk en sta locatie toe.');
        },
        { timeout: 10000, maximumAge: 60000 }
      );
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Locatietoestemming geweigerd. Sta locatie toe in instellingen.');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const s = nearestStation(coords.latitude, coords.longitude);
      const distKm = km(coords.latitude, coords.longitude, s.lat, s.lng);
      setStation(s);
      setStationDist(Math.round(distKm * 1000));
      await fetchDeps(s.code);
    } catch (e: any) {
      setLocError('Kon locatie niet bepalen: ' + (e.message ?? 'onbekende fout'));
    }
  }, [fetchDeps]);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (!station) return;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => fetchDeps(station.code), 30_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [station?.code]);

  const MAX_MINS = 59;
  const upcoming = [...trips].filter(t => secsUntil(t.departureTime) > 0);
  // Always show at least 3; cap at 59 min only if we have >= 3 within that window
  const within59 = upcoming.filter(t => secsUntil(t.departureTime) <= MAX_MINS * 60);
  // Always show min 3; use 59-min cap only when >=3 trains fit within it
  const tripsToShow = within59.length >= 3 ? within59.slice(0, 5) : upcoming.slice(0, 5);
  const sortedTrips = tripsToShow.sort((a, b) => {
    if (sortSnelst && sortGemak) {
      // Snelst+Gemak: minste overstappen eerst, dan vroegste aankomst
      if (a.transfers !== b.transfers) return a.transfers - b.transfers;
      return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
    }
    if (sortSnelst) {
      // Vroegste aankomst
      return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
    }
    if (sortGemak) {
      // Minste overstappen, dan treintype (IC > Sprinter), dan vertrektijd
      if (a.transfers !== b.transfers) return a.transfers - b.transfers;
      const qa = trainQuality(a.trainName), qb = trainQuality(b.trainName);
      if (qa !== qb) return qa - qb;
      return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
    }
    // Standaard: vertrektijd
    return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
  });

  // "Haal ik" filter: keep greens + max 2 oranges, remove reds
  // If stationDist unknown, disable filter (can't calculate catchability)
  const visibleTrips = (filterHaalIk && stationDist !== null) ? (() => {
    const colored = sortedTrips.map(t => ({ t, color: catchColor(secsUntil(t.departureTime), stationDist) }));
    const greens  = colored.filter(x => x.color === '#22C55E' || x.color === '#84CC16').map(x => x.t);
    const oranges = colored.filter(x => x.color === '#F97316').map(x => x.t).slice(0, 2);
    const kept = new Set([...greens, ...oranges]);
    return sortedTrips.filter(t => kept.has(t));
  })() : sortedTrips;

  const selectedTrip = selectedIndex !== null ? visibleTrips[selectedIndex] ?? null : null;

  // Landscape: fullscreen selected trip (or first available)
  if (isLandscape && visibleTrips.length > 0) {
    const trip = selectedTrip ?? visibleTrips[0];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BLUE }}>
        <StatusBar style="light" />
        <LandscapeView trip={trip} dest={destination.label} distMeters={stationDist} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Snelste trein naar huis</Text>
      </View>

      {/* Station */}
      {station && (
        <View style={s.stationBar}>
          <View style={s.stationCol}>
            <Text style={s.stationMeta}>Vertrekstation</Text>
            <Text style={s.stationName}>
              {station.name}
              {stationDist !== null && (
                <Text style={s.stationDist}>
                  {'  '}{stationDist >= 1000
                    ? `${(stationDist / 1000).toFixed(1)} km`
                    : `${stationDist} m`}
                </Text>
              )}
            </Text>
          </View>
          <View style={s.destCol}>
            <Text style={s.stationMeta}>Thuis</Text>
            {Platform.OS === 'web'
              ? (React.createElement as any)('select', {
                  value: destination.code,
                  onChange: (e: any) => handleDestinationChange(e.target.value),
                  style: {
                    fontSize: 17, fontWeight: '700', color: '#111',
                    background: 'transparent', border: 'none', outline: 'none',
                    padding: 0, marginTop: 2, cursor: 'pointer', width: '100%',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
                    appearance: 'none', WebkitAppearance: 'none',
                  },
                },
                ...DESTINATIONS.map(d =>
                  (React.createElement as any)('option', { key: d.code, value: d.code }, d.label)
                )
              )
              : (
                <TouchableOpacity onPress={() => {/* native picker TBD */}}>
                  <Text style={s.stationName}>{destination.label} ▾</Text>
                </TouchableOpacity>
              )
            }
          </View>
        </View>
      )}

      {/* Errors */}
      {locError && (
        <View style={s.errBox}>
          <Text style={s.errText}>📍 {locError}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={init}>
            <Text style={s.retryTxt}>Opnieuw</Text>
          </TouchableOpacity>
        </View>
      )}
      {apiError && (
        <View style={s.errBox}>
          <Text style={s.errText}>⚠️ {apiError}</Text>
          {station && (
            <TouchableOpacity style={s.retryBtn} onPress={() => fetchDeps(station.code)}>
              <Text style={s.retryTxt}>Opnieuw</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Loading */}
      {loading && !trips.length && (
        <View style={s.loadBox}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={s.loadTxt}>Reizen ophalen…</Text>
        </View>
      )}

      {/* Top 5 list */}
      {visibleTrips.length > 0 && (
        <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Header row met sorteerknoppen */}
          <View style={s.listHdrRow}>
            <Text style={s.listHdr}>Top {trips.length} reizen</Text>
            <View style={s.sortBtns}>
              <TouchableOpacity
                style={[s.sortBtn, sortSnelst && s.sortBtnOn]}
                onPress={() => setSortSnelst(v => !v)}
              >
                <Text style={[s.sortBtnTxt, sortSnelst && s.sortBtnTxtOn]}>Snelst</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.sortBtn, sortGemak && s.sortBtnOn]}
                onPress={() => setSortGemak(v => !v)}
              >
                <Text style={[s.sortBtnTxt, sortGemak && s.sortBtnTxtOn]}>Gemak</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.sortBtn, filterHaalIk && s.sortBtnHaalIk]}
                onPress={() => setFilterHaalIk(v => !v)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={[s.sortBtnTxt, filterHaalIk && s.sortBtnTxtOn]}>Haal ik</Text>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: filterHaalIk ? '#FFF' : '#22C55E' }} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
          {visibleTrips.map((trip, i) => (
            <TrainCard
              key={i}
              trip={trip}
              dest={destination.label}
              selected={selectedIndex === i}
              distMeters={stationDist}
              onPress={() => setSelectedIndex(prev => prev === i ? null : i)}
            />
          ))}
        </ScrollView>
      )}

      {/* Empty */}
      {!loading && !apiError && !locError && visibleTrips.length === 0 && station && (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Geen reizen naar {destination.label} gevonden.</Text>
        </View>
      )}

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.refreshBtn}
          onPress={() => station ? fetchDeps(station.code) : init()}
        >
          <Text style={s.refreshTxt}>{loading ? '…' : '↻  Verversen'}</Text>
        </TouchableOpacity>
        {refreshed && (
          <Text style={s.refreshTime}>
            Bijgewerkt: {refreshed.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F8' },

  header: {
    backgroundColor: BLUE,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  headerDest:  { color: GOLD, fontSize: 14, marginTop: 3 },

  stationBar: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    flexDirection: 'row',
    gap: 16,
  },
  stationCol: { flex: 1 },
  destCol:    { flex: 1 },
  stationMeta: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6 },
  stationName: { fontSize: 17, fontWeight: '700', color: '#111', marginTop: 2 },
  stationDist: { fontSize: 13, fontWeight: '400', color: '#999' },

  errBox: {
    margin: 16,
    backgroundColor: '#FFF0F2',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: RED,
  },
  errText:  { color: '#900', fontSize: 14, lineHeight: 20 },
  retryBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: RED, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 7 },
  retryTxt: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  loadBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadTxt: { color: '#888', fontSize: 14 },

  list:       { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
  listHdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  listHdr:    { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  sortBtns:   { flexDirection: 'row', gap: 6 },
  sortBtn:    { borderWidth: 1.5, borderColor: '#CCC', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  sortBtnOn:  { borderColor: BLUE, backgroundColor: BLUE },
  sortBtnTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
  sortBtnTxtOn:  { color: '#FFF' },
  sortBtnHaalIk: { borderColor: '#22C55E', backgroundColor: '#22C55E' },

  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
  emptyTxt: { fontSize: 16, fontWeight: '600', color: '#333', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8, lineHeight: 19 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FFF',
  },
  refreshBtn:  { backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  refreshTxt:  { color: '#FFF', fontWeight: '700', fontSize: 13 },
  refreshTime: { fontSize: 11, color: '#AAA' },
});
