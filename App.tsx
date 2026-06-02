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

interface RouteStation {
  uicCode: string;
  mediumName: string;
  plannedArrivalDateTime?: string;
  actualArrivalDateTime?: string;
}

interface Departure {
  direction: string;
  name: string;
  plannedDateTime: string;
  actualDateTime?: string;
  plannedTrack?: string;
  actualTrack?: string;
  cancelled: boolean;
  routeStations?: RouteStation[];
  // resolved fields
  arrivalTime?: string;
  transfers: number;
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

// Find arrival time at destination from routeStations
function findArrivalAtDest(routeStations?: RouteStation[]): string | undefined {
  if (!routeStations) return undefined;
  const stop = routeStations.find(
    (r) =>
      r.mediumName?.toLowerCase().includes('rotterdam') ||
      r.uicCode === '8400561' // NS UIC code voor Rotterdam Centraal
  );
  return stop?.actualArrivalDateTime ?? stop?.plannedArrivalDateTime;
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
  text:   { color: '#003082', fontSize: 15, fontWeight: '800' },
  urgent: { color: '#FE0437' },
  gone:   { color: '#999', fontSize: 13, fontWeight: '600' },
});

// Single train card for the top-5 list
function TrainCard({ dep, rank }: { dep: Departure; rank: number }) {
  const depTime = dep.actualDateTime ?? dep.plannedDateTime;
  const track   = dep.actualTrack ?? dep.plannedTrack;
  const delayed = dep.actualDateTime && dep.actualDateTime !== dep.plannedDateTime;
  const isNext  = rank === 1;

  return (
    <View style={[card.wrap, isNext && card.wrapFirst]}>
      {/* Left: rank + countdown */}
      <View style={card.left}>
        <Text style={[card.rank, isNext && card.rankFirst]}>{rank}</Text>
        <Countdown iso={depTime} />
      </View>

      {/* Center: main info */}
      <View style={card.center}>
        {/* Bestemming */}
        <Text style={card.dest}>{dep.direction}</Text>
        {/* Treintype */}
        <Text style={card.trainName}>{dep.name}</Text>

        {/* Row: vertrek + aankomst */}
        <View style={card.timeRow}>
          <View style={card.timeBlock}>
            <Text style={card.timeLabel}>Vertrek</Text>
            <Text style={[card.timeVal, delayed && card.delayed]}>{hhmm(depTime)}</Text>
            {delayed && (
              <Text style={card.plannedTime}>{hhmm(dep.plannedDateTime)}</Text>
            )}
          </View>
          <Text style={card.arrow}>→</Text>
          <View style={card.timeBlock}>
            <Text style={card.timeLabel}>Aankomst</Text>
            <Text style={card.timeVal}>
              {dep.arrivalTime ? hhmm(dep.arrivalTime) : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Right: perron + overstappen */}
      <View style={card.right}>
        {track ? (
          <View style={[card.trackBadge, isNext && card.trackBadgeFirst]}>
            <Text style={[card.trackLabel, isNext && card.trackLabelFirst]}>Perron</Text>
            <Text style={[card.trackNum, isNext && card.trackNumFirst]}>{track}</Text>
          </View>
        ) : (
          <View style={card.trackBadge}>
            <Text style={card.trackLabel}>Perron</Text>
            <Text style={card.trackNum}>—</Text>
          </View>
        )}
        <View style={card.transferBadge}>
          <Text style={card.transferNum}>{dep.transfers}</Text>
          <Text style={card.transferLabel}>
            {dep.transfers === 1 ? 'overstap' : 'overstappen'}
          </Text>
        </View>
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
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#E0E0E0',
  },
  wrapFirst: {
    borderLeftColor: GOLD,
    backgroundColor: '#F5F8FF',
    shadowOpacity: 0.12,
  },

  left: { alignItems: 'center', width: 52, marginRight: 12 },
  rank: { fontSize: 28, fontWeight: '900', color: '#CCC', lineHeight: 32 },
  rankFirst: { color: BLUE },

  center: { flex: 1 },
  dest: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 2 },
  trainName: { fontSize: 12, color: '#888', marginBottom: 8 },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBlock: { alignItems: 'flex-start' },
  timeLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.4 },
  timeVal: { fontSize: 16, fontWeight: '700', color: '#111' },
  delayed: { color: RED },
  plannedTime: { fontSize: 11, color: '#999', textDecorationLine: 'line-through' },
  arrow: { fontSize: 16, color: '#CCC', paddingHorizontal: 2 },

  right: { alignItems: 'center', gap: 8, marginLeft: 10 },

  trackBadge: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 56,
  },
  trackBadgeFirst: { backgroundColor: BLUE },
  trackLabel: { fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' },
  trackLabelFirst: { color: GOLD },
  trackNum: { fontSize: 22, fontWeight: '900', color: '#333', lineHeight: 26 },
  trackNumFirst: { color: '#FFF' },

  transferBadge: { alignItems: 'center' },
  transferNum: { fontSize: 18, fontWeight: '800', color: BLUE, lineHeight: 22 },
  transferLabel: { fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.3 },
});

export default function App() {
  const [station, setStation] = useState<typeof STATIONS[0] | null>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);
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
        setDepartures([
          { direction: 'Amsterdam Amstel', name: 'Sprinter 5842', plannedDateTime: dt(4),  actualDateTime: dt(5),  plannedTrack: '3', actualTrack: '3', cancelled: false, transfers: 0, arrivalTime: dt(22) },
          { direction: 'Amsterdam Amstel', name: 'Intercity 1234', plannedDateTime: dt(11), actualDateTime: dt(11), plannedTrack: '1', actualTrack: '1', cancelled: false, transfers: 0, arrivalTime: dt(28) },
          { direction: 'Amsterdam Amstel', name: 'Sprinter 5844', plannedDateTime: dt(19), actualDateTime: dt(19), plannedTrack: '3', actualTrack: '3', cancelled: false, transfers: 0, arrivalTime: dt(36) },
          { direction: 'Amsterdam Amstel', name: 'Intercity 1236', plannedDateTime: dt(29), actualDateTime: dt(31), plannedTrack: '2', actualTrack: '4', cancelled: false, transfers: 0, arrivalTime: dt(46) },
          { direction: 'Amsterdam Amstel', name: 'Sprinter 5846', plannedDateTime: dt(39), actualDateTime: dt(39), plannedTrack: '3', actualTrack: '3', cancelled: false, transfers: 0, arrivalTime: dt(56) },
        ]);
        setRefreshed(new Date());
        setLoading(false);
        return;
      }
      const res = await fetch(
        `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/departures?station=${code}&maxJourneys=40`,
        { headers: { 'Ocp-Apim-Subscription-Key': NS_API_KEY } }
      );
      if (!res.ok) {
        if (res.status === 401)
          throw new Error('Ongeldige API key — vul je NS key in bij NS_API_KEY in App.tsx');
        throw new Error(`NS API fout ${res.status}`);
      }
      const data = await res.json();
      const all: any[] = (data.payload?.departures ?? []).filter((d: any) => !d.cancelled);

      // Treinen naar Rotterdam Centraal (richting bevat "rotterdam")
      let filtered = all.filter((d) =>
        d.direction?.toLowerCase().includes('rotterdam')
      );
      // Fallback: alle overige richtingen
      if (!filtered.length)
        filtered = all.slice(0, 5);

      const resolved: Departure[] = filtered.slice(0, 5).map((d) => ({
        direction:         d.direction,
        name:              d.name,
        plannedDateTime:   d.plannedDateTime,
        actualDateTime:    d.actualDateTime,
        plannedTrack:      d.plannedTrack,
        actualTrack:       d.actualTrack,
        cancelled:         false,
        routeStations:     d.routeStations,
        arrivalTime:       findArrivalAtDest(d.routeStations),
        transfers:         0, // direct train
      }));

      setDepartures(resolved);
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
      {loading && !departures.length && (
        <View style={s.loadBox}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={s.loadTxt}>Vertrektijden ophalen…</Text>
        </View>
      )}

      {/* Top 5 list */}
      {departures.length > 0 && (
        <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 20 }}>
          <Text style={s.listHdr}>Top {departures.length} snelste treinen</Text>
          {departures.map((dep, i) => (
            <TrainCard key={i} dep={dep} rank={i + 1} />
          ))}
        </ScrollView>
      )}

      {/* Empty */}
      {!loading && !apiError && !locError && departures.length === 0 && station && (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Geen treinen naar {DESTINATION_LABEL} gevonden.</Text>
          <Text style={s.emptySub}>Check de NS app voor reizen met overstap.</Text>
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

  list:    { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
  listHdr: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

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
