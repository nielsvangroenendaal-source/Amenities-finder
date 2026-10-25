import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

export default function App() {
const [location, setLocation] = useState('')
const [hotels, setHotels] = useState([])
const [loading, setLoading] = useState(false)
const [priceLimit, setPriceLimit] = useState(1000)
const [minStars, setMinStars] = useState(1)

const fetchHotels = async () => {
if (!location) return
setLoading(true)

try {
  const { data, error } = await supabase
    .from('search_cache')
    .select('results, created_at')
    .eq('search_query', location.toLowerCase())
    .single()

  if (data && new Date() - new Date(data.created_at) < 24 * 60 * 60 * 1000) {
    setHotels(data.results)
    setLoading(false)
    return
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            hotelName: { type: SchemaType.STRING },
            cityLocation: { type: SchemaType.STRING },
            starRating: { type: SchemaType.NUMBER },
            averagePrice: { type: SchemaType.NUMBER },
            amenities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            specialties: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            guestReportedPerks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            bookingUrl: { type: SchemaType.STRING },
            expediaUrl: { type: SchemaType.STRING },
            hotelsUrl: { type: SchemaType.STRING }
          },
          required: [
            'hotelName', 'cityLocation', 'starRating', 'averagePrice', 
            'amenities', 'specialties', 'guestReportedPerks', 
            'bookingUrl', 'expediaUrl', 'hotelsUrl'
          ]
        }
      }
    }
  })

  const prompt = `Find 5 hotels in ${location} with at least ${minStars} stars and under $${priceLimit} per night.`
  const result = await model.generateContent(prompt)
  const responseText = result.response.text()
  const hotelData = JSON.parse(responseText)

  setHotels(hotelData)

  await supabase
    .from('search_cache')
    .upsert({ 
      search_query: location.toLowerCase(), 
      results: hotelData,
      created_at: new Date().toISOString()
    })

} catch (err) {
  console.error(err)
} finally {
  setLoading(false)
}
}

return (
<div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
Hotel Ranker

<input
type="text"
value={location}
onChange={(e) => setLocation(e.target.value)}
placeholder="Enter city"
/>

{loading ? 'Searching' : 'Search'}


<div style={{ marginTop: '20px' }}>
{hotels.map((hotel, index) => (
<div key={index} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
{hotel.hotelName} ({hotel.starRating} Stars)
Location: {hotel.cityLocation}
Price: ${hotel.averagePrice}
Amenities: {hotel.amenities?.join(', ')}

))}


)
}
