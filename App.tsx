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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';

// ── Vul hier je NS API key in van https://apiportal.ns.nl ──
const NS_API_KEY = '7383917274334e0dad1099b05e091088';

// Zet op true om mock-data te zien zonder API key of locatie
const DEMO_MODE = false;

const DESTINATION_LABEL = 'Rotterdam Centraal';

// ── Stations met coördinaten voor dichtstbijzijnde-berekening ──
const STATIONS = [
  { code: 'ACA',  name: 'Amsterdam Centraal',      lat: 52.3791, lng: 4.8999 },
  { code: 'ASD',  name: 'Amsterdam Amstel',         lat: 52.3464, lng: 4.9170 },
  { code: 'ASS',  name: 'Amsterdam Sloterdijk',     lat: 52.3889, lng: 4.8378 },
  { code: 'ASP',  name: 'Amsterdam Bijlmer ArenA',  lat: 52.3125, lng: 4.9472 },
  { code: 'NASM', name: 'Amsterdam Zuid',            lat: 52.3388, lng: 4.8729 },
  { code: 'ADM',  name: 'Amsterdam Muiderpoort',    lat: 52.3619, lng: 4.9356 },
  { code: 'RAI',  name: 'Amsterdam RAI',            lat: 52.3393, lng: 4.8935 },
  { code: 'ASSP', name: 'Amsterdam Sciencepark',    lat: 52.3568, lng: 4.9475 },
  { code: 'DT',   name: 'Diemen',                   lat: 52.3432, lng: 4.9638 },
  { code: 'DTZD', name: 'Diemen Zuid',              lat: 52.3333, lng: 4.9611 },
  { code: 'DU',   name: 'Duivendrecht',             lat: 52.3218, lng: 4.9480 },
  { code: 'WP',   name: 'Weesp',                    lat: 52.3089, lng: 5.0426 },
  { code: 'NM',   name: 'Naarden-Bussum',           lat: 52.2979, lng: 5.1522 },
  { code: 'BSMZ', name: 'Bussum Zuid',              lat: 52.2740, lng: 5.1630 },
  { code: 'HVS',  name: 'Hilversum',                lat: 52.2265, lng: 5.1812 },
  { code: 'HVSM', name: 'Hilversum Media Park',     lat: 52.2167, lng: 5.1780 },
  { code: 'ALM',  name: 'Almere Centrum',           lat: 52.3748, lng: 5.2166 },
  { code: 'ALMB', name: 'Almere Buiten',            lat: 52.3843, lng: 5.2563 },
  { code: 'SCHP', name: 'Schiphol Airport',         lat: 52.3108, lng: 4.7645 },
  { code: 'HFD',  name: 'Hoofddorp',                lat: 52.2963, lng: 4.6939 },
  { code: 'UT',   name: 'Utrecht Centraal',         lat: 52.0896, lng: 5.1101 },
  { code: 'AMF',  name: 'Amersfoort Centraal',      lat: 52.1554, lng: 5.3750 },
  { code: 'ZL',   name: 'Zwolle',                   lat: 52.5047, lng: 6.0938 },
  { code: 'LW',   name: 'Lelystad Centrum',         lat: 52.5033, lng: 5.4755 },
  { code: 'RTD',  name: 'Rotterdam Centraal',       lat: 51.9247, lng: 4.4691 },
  { code: 'ES',   name: 'Eindhoven',                lat: 51.4440, lng: 5.4794 },
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

function Countdown({ iso }: { iso: string }) {
  const [s, setS] = useState(() => secsUntil(iso));
  useEffect(() => {
    const id = setInterval(() => setS(secsUntil(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);

  if (s <= 0) return <Text style={cd.gone}>Vertrokken</Text>;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return (
    <Text style={[cd.text, m < 3 && cd.urgent]}>
      {m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${s}s`}
    </Text>
  );
}

const cd = StyleSheet.create({
  text:   { color: '#003082', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  urgent: { color: '#FE0437' },
  gone:   { color: '#999', fontSize: 14, fontWeight: '600' },
});

// Single train card: [Perron groot] [Bestemming + tijden + overstappen] [Afteltimer groot]
function TrainCard({ trip, dest }: { trip: Trip; dest: string }) {
  const delayed = trip.departureTime !== trip.plannedDepartureTime;
  return (
    <View style={card.wrap}>
      {/* Perron — groot links */}
      <View style={card.perron}>
        <Text style={card.perronLabel}>Perron</Text>
        <Text style={card.perronNum}>{trip.track}</Text>
      </View>

      {/* Midden */}
      <View style={card.center}>
        <Text style={card.dest}>{dest}</Text>
        <View style={card.timeRow}>
          <Text style={[card.timeVal, delayed && card.delayed]}>{hhmm(trip.departureTime)}</Text>
          {delayed && <Text style={card.planned}>{hhmm(trip.plannedDepartureTime)}</Text>}
          <Text style={card.arrow}> → </Text>
          <Text style={card.timeVal}>{hhmm(trip.arrivalTime)}</Text>
        </View>
        <Text style={card.transfers}>
          {trip.transfers === 0
            ? `Direct · ${trip.trainName}`
            : trip.transfers === 1 ? `1 overstap · ${trip.trainName}` : `${trip.transfers} overstappen · ${trip.trainName}`}
        </Text>
      </View>

      {/* Afteltimer — groot rechts */}
      <View style={card.timerWrap}>
        <Countdown iso={trip.departureTime} />
      </View>
    </View>
  );
}

const BLUE = '#003082';
const GOLD = '#FFD700';
const RED  = '#FE0437';

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

  // Perron — links
  perron: {
    backgroundColor: BLUE,
    borderRadius: 12,
    width: 64,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 14,
  },
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
  const [station, setStation] = useState<typeof STATIONS[0] | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [sortSnelst, setSortSnelst] = useState(false);
  const [sortGemak, setSortGemak] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDeps = useCallback(async (code: string) => {
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

      const dateTime = encodeURIComponent(new Date().toISOString());
      const res = await fetch(
        `/api/trips?fromStation=${code}&toStation=RTD&dateTime=${dateTime}&searchForArrival=false&travelClass=2&maxTransfers=1`
      );
      if (!res.ok) {
        if (res.status === 401)
          throw new Error('Ongeldige API key');
        throw new Error(`NS API fout ${res.status}`);
      }
      const data = await res.json();
      const parsed: Trip[] = (data.trips ?? [])
        .map(parseTrip)
        .filter(Boolean)
        .slice(0, 5) as Trip[];

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
          const s = nearestStation(pos.coords.latitude, pos.coords.longitude);
          setStation(s);
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
      setStation(s);
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

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Snelste trein naar huis</Text>
        <Text style={s.headerDest}>→ {DESTINATION_LABEL}</Text>
      </View>

      {/* Station */}
      {station && (
        <View style={s.stationBar}>
          <Text style={s.stationMeta}>Vertrekstation</Text>
          <Text style={s.stationName}>{station.name}</Text>
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
      {trips.length > 0 && (
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
            </View>
          </View>
          {[...trips].sort((a, b) => {
            if (sortSnelst && sortGemak) {
              // Minste overstappen eerst, dan vroegste aankomst
              if (a.transfers !== b.transfers) return a.transfers - b.transfers;
              return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
            }
            if (sortSnelst) return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
            if (sortGemak)  return a.transfers !== b.transfers ? a.transfers - b.transfers : new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
            return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
          }).map((trip, i) => (
            <TrainCard key={i} trip={trip} dest={DESTINATION_LABEL} />
          ))}
        </ScrollView>
      )}

      {/* Empty */}
      {!loading && !apiError && !locError && trips.length === 0 && station && (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Geen reizen naar {DESTINATION_LABEL} gevonden.</Text>
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
  },
  stationMeta: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6 },
  stationName: { fontSize: 20, fontWeight: '700', color: '#111', marginTop: 2 },

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
  sortBtnTxtOn: { color: '#FFF' },

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
