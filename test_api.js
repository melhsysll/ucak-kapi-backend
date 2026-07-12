import axios from 'axios';

const access_key = '0c9cd7780052e791998976bff8c67aa9';
const flight_iata = 'TK111';

async function test() {
  try {
    const response = await axios.get('http://api.aviationstack.com/v1/flights', {
      params: { access_key, flight_iata }
    });
    console.log('API RESPONSE STATUS:', response.status);
    console.log('API DATA LENGTH:', response.data?.data?.length);
    if (response.data?.data?.length > 0) {
      const flight = response.data.data[0];
      console.log('FLIGHT IATA:', flight.flight?.iata);
      console.log('AIRLINE:', flight.airline?.name);
      console.log('DEPARTURE AIRPORT:', flight.departure?.airport);
      console.log('DEPARTURE GATE:', flight.departure?.gate);
      console.log('DEPARTURE TERMINAL:', flight.departure?.terminal);
      console.log('ARRIVAL AIRPORT:', flight.arrival?.airport);
      console.log('ARRIVAL GATE:', flight.arrival?.gate);
      console.log('FULL DEPARTURE OBJECT:', JSON.stringify(flight.departure, null, 2));
      console.log('FULL ARRIVAL OBJECT:', JSON.stringify(flight.arrival, null, 2));
    } else {
      console.log('No flight details found in API response.');
    }
  } catch (err) {
    console.error('API Error:', err.message);
  }
}

test();
