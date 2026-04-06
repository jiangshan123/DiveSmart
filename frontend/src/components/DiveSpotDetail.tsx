import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TideCurve } from './TideCurve';

interface DiveSpot {
  id: number;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  difficulty_level: string;
  depth_max_meters: number;
  facing_direction: number;
  description: string;
}

interface ConditionsData {
  location: { latitude: number; longitude: number };
  tide: {
    metadata?: {
      latitude: number;
      longitude: number;
      datum: string;
      start: string;
      days: number;
      height: string;
    };
    values: Array<{ time: string; value: number }>;
  };
  weather: {
    current: {
      temperature: number;
      wind_speed: number;
      wind_direction: string | number;
      humidity?: number;
      cloud_cover?: number;
    };
  };
  cached_time: string;
}

export function DiveSpotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [spot, setSpot] = useState<DiveSpot | null>(null);
  const [conditions, setConditions] = useState<ConditionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSpotDetails();
  }, [id]);

  const fetchSpotDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [spotRes, conditionsRes] = await Promise.all([
        axios.get(`http://localhost:8080/api/dive-spots/${id}`),
        axios.get('http://localhost:8080/api/conditions', { params: { spotId: id } }),
      ]);
      setSpot(spotRes.data.data);
      console.log('Conditions data:', conditionsRes.data.data);
      setConditions(conditionsRes.data.data);
    } catch (err) {
      setError('Failed to fetch spot details. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getWindDirection = (degrees: number | string): string => {
    if (typeof degrees === 'string') {
      return degrees; // Already in format like "NNE"
    }
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>{error || 'Spot not found'}</p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      {/* Header */}
      <div style={{ width: '100%', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '20px',
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ width: '100%' }}>
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#333' }}>{spot.name}</h1>
          <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px' }}>
            {spot.region} • Level: {spot.difficulty_level} • Max Depth: {spot.depth_max_meters}m
          </p>
          <p style={{ margin: 0, color: '#999', fontSize: '13px', lineHeight: '1.6' }}>{spot.description}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Dive Spot Info</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Coordinates</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                  {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Facing</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                  {spot.facing_direction}° ({getWindDirection(spot.facing_direction)})
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Max Depth</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{spot.depth_max_meters}m</p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Difficulty</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{spot.difficulty_level}</p>
              </div>
            </div>
          </div>

          {conditions && (
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#333' }}>Current Conditions</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Temperature</p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{conditions.weather.current.temperature}°C</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Wind Speed</p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{conditions.weather.current.wind_speed} m/s</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Wind Direction</p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                    {getWindDirection(conditions.weather.current.wind_direction)}
                  </p>
                </div>
                {conditions.weather.current.humidity !== undefined && (
                  <div>
                    <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Humidity</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{conditions.weather.current.humidity}%</p>
                  </div>
                )}
                {conditions.weather.current.cloud_cover !== undefined && (
                  <div>
                    <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Cloud Cover</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{conditions.weather.current.cloud_cover}%</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {conditions && (
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Tide Chart</h3>
            <TideCurve data={conditions.tide} />
            <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#999', textAlign: 'right' }}>
              Updated: {new Date(conditions.cached_time).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
