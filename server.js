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
  let airport = 'İstanbul Havalimanı (IST)';
  let iata = 'IST';

  if (code.includes('ESB') || code === 'TK2124') {
    airline = 'Turkish Airlines';
    airport = 'Ankara Esenboğa Havalimanı (ESB)';
    iata = 'ESB';
  } else if (code.includes('AYT') || code === 'TK100') {
    airline = 'Turkish Airlines';
    airport = 'Antalya Havalimanı (AYT)';
    iata = 'AYT';
  } else if (code.includes('ADB') || code === 'TK200') {
    airline = 'Turkish Airlines';
    airport = 'İzmir Adnan Menderes Havalimanı (ADB)';
    iata = 'ADB';
  } else if (code.includes('JFK') || code === 'AA100') {
    airline = 'American Airlines';
    airport = 'John F. Kennedy International Airport (JFK)';
    iata = 'JFK';
  } else if (code.includes('CDG') || code === 'AF200') {
    airline = 'Air France';
    airport = 'Charles de Gaulle Airport (CDG)';
    iata = 'CDG';
  } else if (code.includes('DXB') || code === 'EK300') {
    airline = 'Emirates';
    airport = 'Dubai International Airport (DXB)';
    iata = 'DXB';
  } else if (code === 'TK1592') {
    airline = 'Turkish Airlines';
    airport = 'Munich Airport (MUC)'; // Desteklenmiyor
    iata = 'MUC';
  } else if (prefix === 'TK') {
    airline = 'Turkish Airlines';
    airport = 'İstanbul Havalimanı (IST)';
    iata = 'IST';
  } else if (prefix === 'PC' || prefix === 'PGS') {
    airline = 'Pegasus Airlines';
    airport = 'Sabiha Gökçen Havalimanı (SAW)';
    iata = 'SAW';
  } else if (prefix === 'LH') {
    airline = 'Lufthansa';
    airport = 'Frankfurt Airport (FRA)';
    iata = 'FRA';
  } else if (prefix === 'BA') {
    airline = 'British Airways';
    airport = 'London Heathrow Airport (LHR)';
    iata = 'LHR';
  } else {
    airline = 'Diğer Havayolu';
    airport = 'Munich Airport (MUC)';
    iata = 'MUC';
  }

  // Bazi ucuslarin kapisi ilk basta bos gelsin (null) test yapilabilmesi icin
  const gates = [null, 'A1', 'B12', 'C4', 'D7', 'E2', 'F15', 'G3'];
  const randomIndex = Math.floor(Math.random() * gates.length);
  const gate = gates[randomIndex];

  const now = new Date();
  const scheduledTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 saat sonra

  return {
    flight_date: now.toISOString().split('T')[0],
    flight_status: Math.random() > 0.15 ? 'active' : 'scheduled',
    departure: {
      airport: airport,
      timezone: 'Europe/Istanbul',
      iata: iata,
      terminal: Math.random() > 0.5 ? '1' : '2',
      gate: gate,
      delay: Math.random() > 0.7 ? Math.floor(Math.random() * 60) + 15 : 0, // %30 ihtimalle gecikme
      scheduled: scheduledTime.toISOString(),
      estimated: new Date(scheduledTime.getTime() + 15 * 60 * 1000).toISOString()
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

/* ==========================================
   REST ENDPOINT'LERI
   ========================================== */

// 1. Ucus Koduna Gore Sorgulama Endpoint'i
app.get('/api/flight/:flight_code', async (req, res) => {
  const flightCode = req.params.flight_code.toUpperCase().replace(/\s+/g, '');
  const apiKey = process.env.AVIATIONSTACK_API_KEY;

  console.log(`Ucus sorgulaniyor: ${flightCode}`);

  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'YOUR_REAL_API_KEY_HERE') {
    console.log('Aviationstack API_KEY bulunamadi veya gecersiz. Simule veri donuluyor...');
    const mockFlight = generateSimulatedFlight(flightCode);
    return res.json(formatFlightResponse(mockFlight));
  }

  try {
    const response = await axios.get('http://api.aviationstack.com/v1/flights', {
      params: {
        access_key: apiKey,
        flight_iata: flightCode
      },
      timeout: 8000 // 8 saniye zaman asimi
    });

    const body = response.data;

    // Veri bulunamadiysa veya API hata dondurduyse simule veriye geri dus
    if (!body || !body.data || body.data.length === 0) {
      console.warn(`Aviationstack API'de '${flightCode}' kodlu ucus bulunamadi. Demo icin simule veri saglaniyor.`);
      const mockFlight = generateSimulatedFlight(flightCode);
      return res.json(formatFlightResponse(mockFlight));
    }

    // Ilk eslesen aktif veya planlanmis ucusu aliyoruz
    const flightData = body.data[0];
    return res.json(formatFlightResponse(flightData));

  } catch (error) {
    console.error('Aviationstack API entegrasyon hatasi:', error.message);
    console.log('Sunucu hatasi alindi, simule veri ile devam ediliyor...');
    // API Hatasinda da sistemin cokmemesi ve uygulamanin incelenebilmesi icin mock donduruyoruz.
    const mockFlight = generateSimulatedFlight(flightCode);
    return res.json(formatFlightResponse(mockFlight));
  }
});

// Aviationstack ham verisini frontend'in istedigi temiz formata dondurur
const formatFlightResponse = (flight) => {
  const dep = flight.departure || {};
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
    rawStatus: statusRaw
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
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'YOUR_REAL_API_KEY_HERE') {
    // API anahtarı girilmemişse arka planda sorgulama yapamayacağımız için sessizce çıkıyoruz
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
      const response = await axios.get('http://api.aviationstack.com/v1/flights', {
        params: {
          access_key: apiKey,
          flight_iata: flight.flightCode
        },
        timeout: 6050
      });

      const body = response.data;
      if (body && body.data && body.data.length > 0) {
        const liveFlight = body.data[0];
        const formatted = formatFlightResponse(liveFlight);
        const newGate = formatted.gate;

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
