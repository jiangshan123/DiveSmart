# SmartDive API Endpoints

## Server Info

- **Base URL**: http://localhost:5000
- **Database**: Supabase (PostgreSQL)
- **Table**: `dive_spots`

## Available Endpoints

### Health Checks

- **GET** `/health` - API health status
- **GET** `/health/db` - Database connection status

### Dive Spots API

#### Get All Dive Spots

- **GET** `/api/dive-spots`
- **Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Great Barrier Reef",
      "region": "Queensland, Australia",
      "latitude": -16.2839,
      "longitude": 145.7781,
      "facing_direction": 90,
      "depth_max_meters": 30,
      "difficulty_level": "Intermediate",
      "description": "World's largest coral reef...",
      "created_at": "2026-03-12T11:25:34.355175"
    }
  ],
  "count": 5
}
```

#### Get Dive Spots by Difficulty

- **GET** `/api/dive-spots/difficulty/{level}`
- **Levels**: `Beginner`, `Intermediate`, `Advanced`
- **Example**: `/api/dive-spots/difficulty/Beginner`

#### Get Single Dive Spot

- **GET** `/api/dive-spots/{id}`
- **Example**: `/api/dive-spots/1`

## Test Data Added

✅ **5 dive spots inserted successfully:**

1. **Great Barrier Reef** (Australia) - Intermediate, 30m depth
2. **Blue Hole** (Belize) - Advanced, 124m depth
3. **Maldives Atolls** (Maldives) - Beginner, 25.5m depth
4. **Red Sea Reef** (Egypt) - Intermediate, 40m depth
5. **Cenote Dos Ojos** (Mexico) - Beginner, 10m depth

## Database Schema

```sql
CREATE TABLE dive_spots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    region VARCHAR(50),
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    facing_direction INTEGER,
    depth_max_meters DECIMAL(4, 1),
    difficulty_level VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Next Steps for Frontend

1. Create dive spot listing page
2. Add map integration using latitude/longitude
3. Implement filtering by difficulty level
4. Create detailed dive spot view
5. Add search functionality by name/region
