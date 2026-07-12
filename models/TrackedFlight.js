import mongoose from 'mongoose';

const trackedFlightSchema = new mongoose.Schema({
  flightCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  airline: {
    type: String,
    default: 'Bilinmeyen Havayolu'
  },
  gate: {
    type: String,
    default: 'Henüz Açıklanmadı'
  },
  terminal: {
    type: String,
    default: 'Bilinmiyor'
  },
  departureTime: {
    type: Date
  },
  status: {
    type: String,
    default: 'scheduled'
  },
  trackedAt: {
    type: Date,
    default: Date.now
  }
});

const TrackedFlight = mongoose.model('TrackedFlight', trackedFlightSchema);
export default TrackedFlight;
