# NIWA Tide API Integration Guide

This document explains how to integrate NIWA's Tide Forecasting API with your SmartDive backend.

## Overview

The NIWA Tide Forecasting API provides tide predictions for New Zealand's coastal and ocean waters. The SmartDive integration includes:

- **Automatic caching** (6-hour duration) to minimize API calls
- **Multiple endpoints** for tide data, charts, and location-based queries
- **Cache management** utilities for monitoring and clearing cached data

## Prerequisites

1. **NIWA API Key**: Obtain from https://api.niwa.co.nz/
   - Sign up for an account
   - Create a new app
   - Copy your API key

2. **Node.js Dependencies**: Already installed in package.json
   - `axios` - For HTTP requests
   - `express` - Backend framework

3. **Environment Configuration**: Add your API key to `.env`

## Setup

### 1. Configure Environment Variables

Create or update your `.env` file in the backend directory:

```env
NIWA_API_KEY=your_api_key_here
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### 2. Start the Server

```bash
npm run dev
```

The server will automatically load your NIWA API key from the environment variables.

## API Endpoints

### Get Tide Forecast for Coordinates

```http
GET /api/tide/forecast?lat=-36.1&long=174.1
```

**Parameters:**

- `lat` (required): Latitude in NZGD1949 format
- `long` (required): Longitude in NZGD1949 format

**Response:**

```json
{
  "success": true,
  "data": {
    "region": "Auckland",
    "lat": -36.1,
    "long": 174.1,
    "tides": [
      {
        "time": "2026-03-18T08:30:00Z",
        "height": 2.45,
        "type": "high"
      },
      {
        "time": "2026-03-18T14:15:00Z",
        "height": 0.42,
        "type": "low"
      }
    ]
  }
}
```

### Get Tide Forecast for a Dive Spot

```http
GET /api/tide/dive-spot/:id
```

**Parameters:**

- `id` (required): Dive spot ID from your database

**Response:**

```json
{
  "success": true,
  "diveSpot": {
    "id": "spot-123",
    "name": "Piha Beach",
    "latitude": -37.23,
    "longitude": 174.47
  },
  "tideData": {
    "region": "Auckland",
    "tides": [...]
  }
}
```

### Get Tide Chart URL

```http
GET /api/tide/chart?lat=-36.1&long=174.1&format=svg
```

**Parameters:**

- `lat` (required): Latitude in NZGD1949
- `long` (required): Longitude in NZGD1949
- `format` (optional): `svg` (default) or `png`

**Response:**

```json
{
  "success": true,
  "url": "https://api.niwa.co.nz/tides/chart.svg?lat=-36.1&long=174.1&apikey=...",
  "format": "svg"
}
```

### Get Cache Statistics

```http
GET /api/tide/cache/stats
```

**Response:**

```json
{
  "success": true,
  "cache": {
    "size": 2,
    "entries": [
      {
        "location": "-36.1,174.1",
        "cached": "2026-03-18T10:30:00.123Z",
        "expired": false
      }
    ]
  }
}
```

### Clear Cache

**Clear all cache:**

```http
POST /api/tide/cache/clear
Content-Type: application/json
```

**Clear cache for specific location:**

```http
POST /api/tide/cache/clear
Content-Type: application/json

{
  "lat": -36.1,
  "long": 174.1
}
```

## Important Notes

### Coordinate System

- **NZGD1949**: Used by NIWA API (~200m difference from WGS84)
- Ensure your dive spot coordinates are in NZGD1949 format
- If coordinates are outside the model domain, the API returns the nearest valid location

### Caching

- Tide data is cached for **6 hours** per location
- Cache is stored in-memory (lost on server restart)
- Monitor cache size with `/api/tide/cache/stats`
- Clear cache manually if needed for force-refresh

### Rate Limits

- NIWA API enforces rate limits based on your API plan
- Caching helps reduce API calls
- Monitor error messages for rate limit responses (HTTP 429)

### Error Handling

Common errors and solutions:

```
// Missing API key
{
  "success": false,
  "error": "NIWA API key not configured"
}
// Solution: Add NIWA_API_KEY to .env

// Invalid coordinates
{
  "success": false,
  "error": "Invalid coordinates for tide forecast"
}
// Solution: Verify coordinates are within NZ EEZ and in NZGD1949

// API rate limit exceeded
{
  "success": false,
  "error": "NIWA API rate limit exceeded"
}
// Solution: Upgrade NIWA API plan or implement request throttling
```

## Frontend Integration Example

### React/TypeScript Example

```typescript
// services/tideService.ts
import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

export interface TideForecast {
  region: string;
  lat: number;
  long: number;
  tides: Tide[];
}

export interface Tide {
  time: string;
  height: number;
  type: "high" | "low";
}

export async function getTideForDiveSpot(
  spotId: string,
): Promise<TideForecast> {
  const response = await axios.get(
    `${API_BASE_URL}/api/tide/dive-spot/${spotId}`,
  );
  return response.data.tideData;
}

export async function getTideChartUrl(
  lat: number,
  long: number,
  format: "svg" | "png" = "svg",
): Promise<string> {
  const response = await axios.get(`${API_BASE_URL}/api/tide/chart`, {
    params: { lat, long, format },
  });
  return response.data.url;
}

// Usage in component:
// const tideData = await getTideForDiveSpot(diveSpotId);
// const chartUrl = await getTideChartUrl(lat, long, 'svg');
```

## Testing

### Using cURL

```bash
# Test tide forecast
curl -X GET "http://localhost:5000/api/tide/forecast?lat=-36.1&long=174.1"

# Test dive spot tide data
curl -X GET "http://localhost:5000/api/tide/dive-spot/spot-123"

# Get tile chart URL
curl -X GET "http://localhost:5000/api/tide/chart?lat=-36.1&long=174.1&format=svg"

# Check cache stats
curl -X GET "http://localhost:5000/api/tide/cache/stats"

# Clear cache
curl -X POST "http://localhost:5000/api/tide/cache/clear" \
  -H "Content-Type: application/json" \
  -d '{"lat": -36.1, "long": 174.1}'
```

## Troubleshooting

### 1. "NIWA API key not configured"

- Check `.env` file exists in backend directory
- Verify `NIWA_API_KEY` is set correctly
- Restart the server after adding the key

### 2. No data returned from tide forecast

- Verify coordinates are within New Zealand EEZ
- Check coordinates are in NZGD1949 format
- The API automatically returns nearest valid location

### 3. API requests timing out

- Check your internet connection
- NIWA API might be experiencing issues
- Increase timeout if needed in `tide-service.js`

### 4. Cache not clearing

- Ensure coordinates match exactly (decimal precision)
- Use `/api/tide/cache/stats` to see cached locations
- Try clearing all cache instead of specific location

## Further Resources

- **NIWA Tide API Documentation**: https://api.niwa.co.nz/
- **Coordinates**: https://www.linz.govt.nz/ (find NZGD1949 coordinates)
- **API Examples**: Check NIWA's API portal for more examples

## Files Modified/Created

- **New**: `backend/tide-service.js` - Main NIWA integration service
- **Modified**: `backend/server.js` - Added tide API endpoints
- **Documentation**: `backend/TIDE_API.md` - This file
