import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import mongoose from 'mongoose';
import TrackedFlight from './models/TrackedFlight.js';

// Cevre degiskenlerini yukle
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Gelistirme asamasinda tum kaynaklara acik
    methods: ['GET', 'POST']
  }
});

// Middleware kurulumu
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/airport_assistant';

// MongoDB Baglantisi (Hata durumunda uygulamanin cokmemesi icin korumali baglanti)
let isMongoConnected = false;
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB baglantisi basarili.');
    isMongoConnected = true;
  })
  .catch((err) => {
    console.warn('MongoDB baglantisi basarisiz oldu. Uygulama in-memory veritabani ile calismaya devam ediyor.\nHata:', err.message);
  });

// Gecici bellek veri tabani (MongoDB baglantisi yoksa kullanilacak geri dustu mekanizmasi)
const inMemoryTrackedFlights = [];

// Gercekci Simule Ucus Ureticisi (API Key olmadiginda veya sorgu basarisiz oldugunda uygulamanin demo edilmesini saglar)
const generateSimulatedFlight = (flightCode) => {
  const code = flightCode.toUpperCase().replace(/\s+/g, '');
  const prefix = code.substring(0, 2);
  const number = code.substring(2);

  // Havayolu belirleme ve havalimanı eşleme
  let airline = 'Diğer Havayolu';
  let depAirport = 'İstanbul Havalimanı (IST)';
  let depIata = 'IST';
  let arrAirport = 'London Heathrow Airport (LHR)';
  let arrIata = 'LHR';
  let gate = null;
  let terminal = '1';

  // Check specific test cases from Istanbul Airport live screen:
  if (code === '3O0523' || code === '3O523') {
    airline = 'Air Arabia Morocco';
    depAirport = 'İstanbul Havalimanı (IST)';
    depIata = 'IST';
    arrAirport = 'Rabat Salé Airport (RBA)';
    arrIata = 'RBA';
    gate = 'B1A';
    terminal = '1';
  } else if (code === 'TK0111' || code === 'TK111') {
    airline = 'Turkish Airlines';
    depAirport = 'İstanbul Havalimanı (IST)';
    depIata = 'IST';
    arrAirport = 'John F. Kennedy International Airport (JFK)';
    arrIata = 'JFK';
    gate = 'A8B';
    terminal = '1';
  } else if (code === 'TK0262' || code === 'TK262') {
    airline = 'Turkish Airlines';
    depAirport = 'İstanbul Havalimanı (IST)';
    depIata = 'IST';
    arrAirport = 'Urgench International Airport (UGC)';
    arrIata = 'UGC';
    gate = 'D15';
    terminal = '1';
  } else if (code.includes('ESB') || code === 'TK2124') {
    airline = 'Turkish Airlines';
    depAirport = 'Ankara Esenboğa Havalimanı (ESB)';
    depIata = 'ESB';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
    gate = 'A1';
  } else if (code.includes('AYT') || code === 'TK100') {
    airline = 'Turkish Airlines';
    depAirport = 'Antalya Havalimanı (AYT)';
    depIata = 'AYT';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
    gate = 'B12';
  } else if (code.includes('ADB') || code === 'TK200') {
    airline = 'Turkish Airlines';
    depAirport = 'İzmir Adnan Menderes Havalimanı (ADB)';
    depIata = 'ADB';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
    gate = 'C4';
  } else if (code.includes('JFK') || code === 'AA100') {
    airline = 'American Airlines';
    depAirport = 'John F. Kennedy International Airport (JFK)';
    depIata = 'JFK';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
    gate = 'D7';
  } else if (code.includes('CDG') || code === 'AF200') {
    airline = 'Air France';
    depAirport = 'Charles de Gaulle Airport (CDG)';
    depIata = 'CDG';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
    gate = 'E2';
  } else if (code.includes('DXB') || code === 'EK300') {
    airline = 'Emirates';
    depAirport = 'Dubai International Airport (DXB)';
    depIata = 'DXB';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
    gate = 'F15';
  } else if (code === 'TK1592') {
    airline = 'Turkish Airlines';
    depAirport = 'Munich Airport (MUC)';
    depIata = 'MUC';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
    gate = 'G3';
  } else if (prefix === 'TK') {
    airline = 'Turkish Airlines';
    depAirport = 'İstanbul Havalimanı (IST)';
    depIata = 'IST';
    arrAirport = 'London Heathrow Airport (LHR)';
    arrIata = 'LHR';
  } else if (prefix === 'PC' || prefix === 'PGS') {
    airline = 'Pegasus Airlines';
    depAirport = 'Sabiha Gökçen Havalimanı (SAW)';
    depIata = 'SAW';
    arrAirport = 'Paris Orly Airport (ORY)';
    arrIata = 'ORY';
  } else if (prefix === 'LH') {
    airline = 'Lufthansa';
    depAirport = 'Frankfurt Airport (FRA)';
    depIata = 'FRA';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
  } else if (prefix === 'BA') {
    airline = 'British Airways';
    depAirport = 'London Heathrow Airport (LHR)';
    depIata = 'LHR';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
  } else {
    airline = 'Diğer Havayolu';
    depAirport = 'Munich Airport (MUC)';
    depIata = 'MUC';
    arrAirport = 'İstanbul Havalimanı (IST)';
    arrIata = 'IST';
  }

  // Eger kapı yukarıdaki spesifik kurallarla atanmadıysa, test amaçlı rastgele ata
  if (gate === null) {
    const gates = [null, 'A1', 'B12', 'C4', 'D7', 'E2', 'F15', 'G3'];
    const randomIndex = Math.floor(Math.random() * gates.length);
    gate = gates[randomIndex];
  }

  const now = new Date();
  const scheduledTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 saat sonra

  return {
    flight_date: now.toISOString().split('T')[0],
    flight_status: Math.random() > 0.15 ? 'active' : 'scheduled',
    departure: {
      airport: depAirport,
      timezone: 'Europe/Istanbul',
      iata: depIata,
      terminal: terminal,
      gate: gate,
      delay: Math.random() > 0.7 ? Math.floor(Math.random() * 60) + 15 : 0,
      scheduled: scheduledTime.toISOString(),
      estimated: new Date(scheduledTime.getTime() + 15 * 60 * 1000).toISOString()
    },
    arrival: {
      airport: arrAirport,
      timezone: 'Europe/Paris',
      iata: arrIata,
      gate: null,
      scheduled: scheduledTime.toISOString(),
      estimated: scheduledTime.toISOString()
    },
    airline: {
      name: airline
    },
    flight: {
      number: number,
      iata: code
    }
  };
};

// API.market / AeroDataBox ham verisini frontend'in istedigi temiz formata dondurur
const formatAeroDataBoxResponse = (flight, flightCode = 'Bilinmiyor') => {
  const dep = flight.departure || {};
  const arr = flight.arrival || {};
  const depAirport = dep.airport || {};
  const arrAirport = arr.airport || {};

  // Kapı numarası yoksa "Henüz Açıklanmadı" dönülecektir
  const gateVal = dep.gate ? dep.gate.trim() : null;
  const gateDisplay = gateVal ? gateVal : 'Henüz Açıklanmadı';

  // Durum
  const statusRaw = flight.status || 'scheduled';
  let statusText = 'Zamanında';
  if (statusRaw.toLowerCase() === 'cancelled') {
    statusText = 'İptal Edildi';
  } else if (statusRaw.toLowerCase() === 'active' || statusRaw.toLowerCase() === 'enroute') {
    statusText = 'Havada / Aktif';
  }

  return {
    flightCode: flight.identification?.number || flightCode,
    airline: flight.airline?.name || 'Bilinmeyen Havayolu',
    airport: depAirport.name || 'Bilinmeyen Havalimanı',
    terminal: dep.terminal || '1',
    gate: gateDisplay,
    scheduledTime: dep.scheduledTimeLocal || new Date().toISOString(),
    estimatedTime: dep.actualTimeLocal || dep.scheduledTimeLocal || new Date().toISOString(),
    delayMinutes: 0,
    flightStatus: statusText,
    isDelayed: false,
    rawStatus: statusRaw,
    originIata: depAirport.iata || 'IST',
    originAirport: depAirport.name || 'İstanbul Havalimanı (IST)',
    destinationIata: arrAirport.iata || 'LHR',
    destinationAirport: arrAirport.name || 'London Heathrow Airport (LHR)'
  };
};

/* ==========================================
   REST ENDPOINT'LERI
   ========================================== */

// 1. Ucus Koduna Gore Sorgulama Endpoint'i
app.get('/api/flight/:flight_code', async (req, res) => {
  const flightCode = req.params.flight_code.toUpperCase().replace(/\s+/g, '');
  const magicApiKey = process.env.MAGICAPI_KEY;
  const apiKey = process.env.AVIATIONSTACK_API_KEY;

  console.log(`Ucus sorgulaniyor: ${flightCode}`);

  // 1. Alternatif: API.market AeroDataBox API Sorgusu
  if (magicApiKey && magicApiKey.trim() !== '' && magicApiKey.trim() !== 'YOUR_REAL_API_KEY_HERE') {
    try {
      console.log(`API Market (AeroDataBox) kullanilarak ucus sorgulaniyor: ${flightCode}`);
      const today = new Date();
      // Türkiye saat dilimine göre (UTC+3) yerel güncel tarihi alalım
      const localTime = new Date(today.getTime() + 3 * 60 * 60 * 1000);
      const dateStr = localTime.toISOString().split('T')[0];

      const response = await axios.get(`https://prod.api.market/api/v1/aedbx/aerodatabox/flights/number/${flightCode}/${dateStr}`, {
        params: {
          dateLocalRole: 'Both'
        },
        headers: {
          'x-magicapi-key': magicApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 9000
      });

      const body = response.data;
      if (body && Array.isArray(body) && body.length > 0) {
        console.log(`API Market verisi basariyla alindi: ${flightCode}`);
        return res.json(formatAeroDataBoxResponse(body[0], flightCode));
      } else {
        console.warn(`API Market'te '${flightCode}' bu tarih icin bulunamadı: ${dateStr}. Diğer alternatif veya simülasyona geçiliyor.`);
      }
    } catch (error) {
      console.error('API Market (AeroDataBox) sorgusu basarisiz oldu:', error.message);
    }
  }

  // 2. Alternatif: Aviationstack API Sorgusu
  if (apiKey && apiKey.trim() !== '' && apiKey.trim() !== 'YOUR_REAL_API_KEY_HERE') {
    try {
      console.log(`Aviationstack kullanilarak ucus sorgulaniyor: ${flightCode}`);
      const response = await axios.get('http://api.aviationstack.com/v1/flights', {
        params: {
          access_key: apiKey,
          flight_iata: flightCode
        },
        timeout: 8000
      });

      const body = response.data;
      if (body && body.data && body.data.length > 0) {
        return res.json(formatFlightResponse(body[0]));
      }
    } catch (error) {
      console.error('Aviationstack API sorgusu basarisiz oldu:', error.message);
    }
  }

  // 3. Alternatif/Geriye Düşüş: Simülasyon Verisi
  console.log('API sorguları basarısız veya anahtarlar eksik. Simüle veri donuluyor...');
  const mockFlight = generateSimulatedFlight(flightCode);
  return res.json(formatFlightResponse(mockFlight));
});

// Aviationstack ham verisini frontend'in istedigi temiz formata dondurur
const formatFlightResponse = (flight) => {
  const dep = flight.departure || {};
  const arr = flight.arrival || {};
  const statusRaw = flight.flight_status || 'scheduled';
  
  // Kapı numarası yoksa "Henüz Açıklanmadı" dönülecektir
  const gateVal = dep.gate ? dep.gate.trim() : null;
  const gateDisplay = gateVal ? gateVal : 'Henüz Açıklanmadı';

  // Rötar yönetimi
  const delay = dep.delay || 0;
  let statusText = 'Zamanında';
  if (statusRaw === 'cancelled') {
    statusText = 'İptal Edildi';
  } else if (delay > 0) {
    statusText = `Rötar (${delay} dk)`;
  } else if (statusRaw === 'active') {
    statusText = 'Havada / Aktif';
  }

  return {
    flightCode: flight.flight?.iata || 'Bilinmiyor',
    airline: flight.airline?.name || 'Bilinmeyen Havayolu',
    airport: dep.airport || 'Bilinmeyen Havalimanı',
    terminal: dep.terminal || '1',
    gate: gateDisplay,
    scheduledTime: dep.scheduled || new Date().toISOString(),
    estimatedTime: dep.estimated || dep.scheduled || new Date().toISOString(),
    delayMinutes: delay,
    flightStatus: statusText,
    isDelayed: delay > 0,
    rawStatus: statusRaw,
    originIata: dep.iata || 'IST',
    originAirport: dep.airport || 'İstanbul Havalimanı (IST)',
    destinationIata: arr.iata || 'LHR',
    destinationAirport: arr.airport || 'London Heathrow Airport (LHR)'
  };
};

// 2. Takip Edilen Ucuslari Kaydetme (Database/Memory)
app.post('/api/track', async (req, res) => {
  const { flightCode, airline, gate, terminal, departureTime, status } = req.body;
  if (!flightCode) {
    return res.status(400).json({ error: 'Uçuş kodu zorunludur.' });
  }

  const payload = {
    flightCode: flightCode.toUpperCase().trim(),
    airline: airline || 'Bilinmeyen Havayolu',
    gate: gate || 'Henüz Açıklanmadı',
    terminal: terminal || '1',
    departureTime: departureTime ? new Date(departureTime) : new Date(),
    status: status || 'Zamanında',
    trackedAt: new Date()
  };

  try {
    if (isMongoConnected) {
      // Once ayni ucus zaten takip ediliyor mu diye bak ve guncelle
      const updated = await TrackedFlight.findOneAndUpdate(
        { flightCode: payload.flightCode },
        payload,
        { upsert: true, new: true }
      );
      return res.status(201).json({ message: 'Uçuş takip listesine database\'e eklendi / güncellendi.', data: updated });
    } else {
      // In-Memory kayit
      const existIndex = inMemoryTrackedFlights.findIndex(f => f.flightCode === payload.flightCode);
      if (existIndex > -1) {
        inMemoryTrackedFlights[existIndex] = payload;
      } else {
        inMemoryTrackedFlights.push(payload);
      }
      return res.status(201).json({ message: 'Uçuş takip listesine in-memory kaydedildi.', data: payload });
    }
  } catch (error) {
    console.error('Uçuş takip kaydetme hatası:', error);
    return res.status(500).json({ error: 'Veritabanı kayıt hatası.' });
  }
});

// 3. Takip Edilen Ucuslari Listeleme
app.get('/api/tracked-flights', async (req, res) => {
  try {
    if (isMongoConnected) {
      const list = await TrackedFlight.find().sort({ trackedAt: -1 });
      return res.json(list);
    } else {
      return res.json(inMemoryTrackedFlights);
    }
  } catch (error) {
    console.error('Takip listesi çekme hatası:', error);
    return res.status(500).json({ error: 'Uçuş listesi veritabanından çekilemedi.' });
  }
});

/* ==========================================
   WEBSOCKET VE ARKA PLAN GERÇEK KAPI POLLİNG SORGULAYICI
   ========================================== */

// Takip edilen gerçek uçuşları belirli aralıklarla API'den sorgulayan fonksiyon
const checkTrackedFlightsForUpdates = async () => {
  const magicApiKey = process.env.MAGICAPI_KEY;
  const apiKey = process.env.AVIATIONSTACK_API_KEY;

  if (
    (!magicApiKey || magicApiKey.trim() === '' || magicApiKey.trim() === 'YOUR_REAL_API_KEY_HERE') &&
    (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'YOUR_REAL_API_KEY_HERE')
  ) {
    // API anahtarları girilmemişse arka planda sorgulama yapamayacağımız için sessizce çıkıyoruz
    return;
  }

  console.log('Takip edilen uçuşlar için arka planda gerçek kapı kontrolü yapılıyor...');

  let trackedList = [];
  try {
    if (isMongoConnected) {
      trackedList = await TrackedFlight.find();
    } else {
      trackedList = [...inMemoryTrackedFlights];
    }
  } catch (err) {
    console.error('Takip listesi veritabanından çekilemedi:', err.message);
    return;
  }

  for (const flight of trackedList) {
    try {
      console.log(`FIDS Poller: ${flight.flightCode} sorgulanıyor...`);
      let newGate = null;

      // 1. Alternatif: API.market (AeroDataBox) Polling
      if (magicApiKey && magicApiKey.trim() !== '' && magicApiKey.trim() !== 'YOUR_REAL_API_KEY_HERE') {
        const today = new Date();
        const localTime = new Date(today.getTime() + 3 * 60 * 60 * 1000);
        const dateStr = localTime.toISOString().split('T')[0];

        const response = await axios.get(`https://prod.api.market/api/v1/aedbx/aerodatabox/flights/number/${flight.flightCode}/${dateStr}`, {
          params: { dateLocalRole: 'Both' },
          headers: {
            'x-magicapi-key': magicApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 6050
        });

        const body = response.data;
        if (body && Array.isArray(body) && body.length > 0) {
          const formatted = formatAeroDataBoxResponse(body[0], flight.flightCode);
          newGate = formatted.gate;
        }
      } 
      // 2. Alternatif: Aviationstack Polling
      else if (apiKey && apiKey.trim() !== '' && apiKey.trim() !== 'YOUR_REAL_API_KEY_HERE') {
        const response = await axios.get('http://api.aviationstack.com/v1/flights', {
          params: {
            access_key: apiKey,
            flight_iata: flight.flightCode
          },
          timeout: 6050
        });

        const body = response.data;
        if (body && body.data && body.data.length > 0) {
          const formatted = formatFlightResponse(body[0]);
          newGate = formatted.gate;
        }
      }

      // Gerçek kapıda değişim algılanırsa
      if (newGate && newGate !== 'Henüz Açıklanmadı' && newGate !== flight.gate) {
        console.log(`🚨 GERÇEK KAPI DEĞİŞİMİ: ${flight.flightCode} kapısı güncellendi! Eski: ${flight.gate} ➔ Yeni: ${newGate}`);

        // Veritabanını / hafızayı güncelle
        if (isMongoConnected) {
          await TrackedFlight.findOneAndUpdate({ flightCode: flight.flightCode }, { gate: newGate });
        } else {
          const idx = inMemoryTrackedFlights.findIndex(f => f.flightCode === flight.flightCode);
          if (idx > -1) inMemoryTrackedFlights[idx].gate = newGate;
        }

        // WebSocket ile tüm bağlı istemcilere gerçek kapı değişimi bildirimini fırlat
        io.emit('gate_update', {
          flightCode: flight.flightCode,
          oldGate: flight.gate,
          newGate: newGate,
          message: `Uçuş Kapı Uyarısı: ${flight.flightCode} uçuşunun kapı numarası değişti! (Eski Kapı: ${flight.gate} ➔ Yeni Kapı: ${newGate})`
        });
      }
    } catch (err) {
      console.warn(`${flight.flightCode} gerçek kapı kontrol sorgulaması başarısız:`, err.message);
    }
  }
};

// Takip edilen uçuşları her 60 saniyede bir gerçek API'den tarat
// (Canlı Aviationstack API limitlerinizi korumak için isterseniz süreyi artırabilirsiniz)
setInterval(checkTrackedFlightsForUpdates, 60000);

io.on('connection', (socket) => {
  console.log(`Yeni istemci bağlandı: ID: ${socket.id}`);

  socket.on('track_flight', (data) => {
    const { flightCode, currentGate } = data;
    console.log(`İstemci ${socket.id}, ${flightCode} uçuşunu aktif takip ekranına aldı. (Mevcut Kapı: ${currentGate})`);
  });

  socket.on('disconnect', () => {
    console.log(`İstemci bağlantısı koptu: ID: ${socket.id}`);
  });
});

// Sunucuyu Başlat
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  Havalimanı Akıllı Asistanı Backend Sunucusu Hazır`);
  console.log(`  PORT      : http://localhost:${PORT}`);
  console.log(`  WebSocket : socket.io dinleniyor`);
  console.log(`  Poller    : 60 saniyelik gerçek kapı tarayıcısı aktif`);
  console.log(`====================================================`);
});
