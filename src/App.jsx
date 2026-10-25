import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generativeai';

// Initialize Supabase Client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY || 'YOUR_GEMINI_KEY');

export default function App() {
  const [location, setLocation] = useState('');
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [priceLimit, setPriceLimit] = useState(1000);
  const [minStars, setMinStars] = useState(1);

  const fetchHotels = async () => {
    if (!location) return;
    setLoading(true);

    try {
      // 1. Check PostgreSQL Database Cache (Supabase)
      const { data, error } = await supabase
        .from('search_cache')
        .select('results, created_at')
        .eq('search_query', location.toLowerCase())
        .single();

      // Return cached results if they exist and are less than 24 hours old
      if (data && new Date() - new Date(data.created_at) < 24 * 60 * 60 * 1000) {
        setHotels(data.results);
        setLoading(false);
        return;
      }

      // 2. Fallback to Gemini API if cache misses or expires
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
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
                "hotelName", "cityLocation", "starRating", "averagePrice", 
                "amenities", "specialties", "guestReportedPerks", 
                "bookingUrl", "expediaUrl", "hotelsUrl"
              ]
            }
          }
        }
