# NIWA Tide API Integration - Quick Start Checklist

## Setup Steps

- [ ] **1. Get API Key**
  - Go to https://api.niwa.co.nz/
  - Sign in or create account
  - Navigate to Apps → Create New App
  - Name your app (e.g., "SmartDive")
  - Generate API key
  - Copy the full key to clipboard

- [ ] **2. Configure Environment**
  - Create/edit `backend/.env` file
  - Add: `NIWA_API_KEY=your_full_api_key_here`
  - Save the file

- [ ] **3. Install Dependencies** (if not already done)

  ```bash
  cd backend
  npm install
  ```

- [ ] **4. Start Backend**

  ```bash
  npm run dev
  ```

  - Should see: "Server running on http://localhost:5000"

- [ ] **5. Test API**
  - Open terminal and run:
    ```bash
    curl http://localhost:5000/api/health
    ```
  - Should return health status

- [ ] **6. Test Tide API**
  - Example coordinates for Auckland:
    ```bash
    curl "http://localhost:5000/api/tide/forecast?lat=-36.1&long=174.1"
    ```
  - Should return tide data (may take 5-10s on first call due to API request)

- [ ] **7. Check Cache**
  ```bash
  curl http://localhost:5000/api/tide/cache/stats
  ```

  - Should show cached locations

## Key Files

- **`backend/tide-service.js`** - NIWA API integration with caching
- **`backend/server.js`** - Express server with tide endpoints
- **`backend/TIDE_API.md`** - Full documentation
- **`backend/.env`** - Environment config (NIWA_API_KEY)

## Available Endpoints

| Endpoint                                  | Method | Purpose                       |
| ----------------------------------------- | ------ | ----------------------------- |
| `/api/tide/forecast?lat=X&long=Y`         | GET    | Get tide data for coordinates |
| `/api/tide/dive-spot/:id`                 | GET    | Get tide data for a dive spot |
| `/api/tide/chart?lat=X&long=Y&format=svg` | GET    | Get tide chart URL            |
| `/api/tide/cache/stats`                   | GET    | View cache statistics         |
| `/api/tide/cache/clear`                   | POST   | Clear cached tide data        |

## Troubleshooting

**Issue: "NIWA API key not configured"**

- ✓ Check `.env` file exists in `backend/` folder
- ✓ Verify key is correct: `NIWA_API_KEY=your_key`
- ✓ Restart server: `npm run dev`

**Issue: "Invalid NIWA API key"**

- ✓ Double-check key has no extra spaces
- ✓ Go to https://api.niwa.co.nz/ and regenerate if needed

**Issue: Slow first request (10+ seconds)**

- This is normal - first request queries NIWA API, then caches result
- Subsequent requests for same location will be instant (6-hour cache)

**Issue: "Invalid coordinates for tide forecast"**

- Coordinates must be in New Zealand EEZ
- Use NZGD1949 format (not WGS84)
- Test with: `lat=-36.1&long=174.1` (Auckland)

## Next Steps

### To integrate with dive spots:

1. **Update Dive Spot Table** (if not already present)
   - Ensure dive spots have `latitude` and `longitude` columns
   - Use NZGD1949 coordinates

2. **Frontend Integration**
   - Call `/api/tide/dive-spot/:id` to get tide data
   - Display tide forecast with dive spot details
   - Optionally embed chart using `/api/tide/chart` endpoint

3. **Caching Strategy**
   - Current: 6-hour cache in memory
   - For production: Consider persistent cache (Redis)
   - Monitor with `/api/tide/cache/stats`

## Support

For detailed API documentation, see `backend/TIDE_API.md`

For NIWA API direct support: https://api.niwa.co.nz/docs
