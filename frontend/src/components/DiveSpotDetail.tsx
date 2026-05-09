import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TideCurve } from './TideCurve';

interface DiveSpot {
  spotId: number;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  difficulty_level: string | null;
  depth_max_meters: number | null;
  facing_direction: number | null;
  /** True when API filled facing from lat/lon heuristic (not stored in DB). */
  facing_direction_estimated?: boolean;
  description: string;
  /** e.g. Snorkeling, Freediving, Spearfishing, Scuba */
  suitable_for?: string[] | null;
  /** Driving / walking directions to the site */
  getting_there?: string | null;
  /** Where to park */
  parking_location?: string | null;
  /** yes | no | optional */
  boat_required?: string | null;
  /** Walk time or distance from parking to water entry */
  parking_to_entry_walk?: string | null;
  /** Extra access tips */
  access_notes?: string | null;
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
  visibility?: {
    visibility_meters: number;
    level: string;
    color: string;
    rating: number;
    recommendation: string;
    factors?: {
      wind_impact: number;
      cloud_impact: number;
      humidity_impact: number;
      tide_impact: number;
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

  const formatFacing = (deg: number | null | undefined) => {
    if (deg == null || Number.isNaN(Number(deg))) return null;
    const n = Number(deg);
    return `${n}° (${getWindDirection(n)})`;
  };

  const formatDepthM = (m: number | null | undefined) =>
    m != null && !Number.isNaN(Number(m)) ? `${m}m` : null;

  const missingHintStyle: CSSProperties = {
    margin: '4px 0 0',
    fontSize: '11px',
    color: '#999',
    lineHeight: 1.45,
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

  const facingStr = formatFacing(spot.facing_direction);
  const depthStr = formatDepthM(spot.depth_max_meters);

  const boatRequiredLabel = (v: string | null | undefined): string | null => {
    if (v == null || String(v).trim() === '') return null;
    const s = String(v).toLowerCase().trim();
    if (s === 'yes') return 'Yes — boat needed to dive this site';
    if (s === 'no') return 'No — shore / jetty access only';
    if (s === 'optional') return 'Optional — boat can make it easier but is not required';
    return String(v);
  };

  const accessBlockStyle: CSSProperties = {
    margin: '0 0 14px',
    fontSize: '14px',
    color: '#333',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  };

  const hasAccessExtras =
    (spot.suitable_for && spot.suitable_for.length > 0) ||
    spot.getting_there ||
    spot.parking_location ||
    boatRequiredLabel(spot.boat_required) ||
    spot.parking_to_entry_walk ||
    spot.access_notes;

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
            {spot.region} • Level: {spot.difficulty_level ?? 'Not provided'} • Max Depth: {depthStr ?? 'Not provided'}
          </p>
          {(!spot.difficulty_level || depthStr == null) && (
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#888' }}>
              “Not provided” means this detail is missing in the dive spot database (it can be added when editing the
              site record).
            </p>
          )}
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
                {facingStr ? (
                  <>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{facingStr}</p>
                    {spot.facing_direction_estimated && (
                      <p style={missingHintStyle}>
                        Approximate bearing from coordinates (not from a survey). Save a real value in the database for
                        accuracy.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Not provided</p>
                    <p style={missingHintStyle}>
                      No compass bearing (degrees from north) is stored, and no estimate is available for this location.
                    </p>
                  </>
                )}
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Max Depth</p>
                {depthStr ? (
                  <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{depthStr}</p>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Not provided</p>
                    <p style={missingHintStyle}>
                      Maximum typical depth (metres) for this site is not saved in the database.
                    </p>
                  </>
                )}
              </div>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Difficulty</p>
                {spot.difficulty_level ? (
                  <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{spot.difficulty_level}</p>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Not provided</p>
                    <p style={missingHintStyle}>
                      Difficulty (e.g. Beginner / Intermediate / Advanced) is not saved for this dive spot.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 20,
                borderTop: '1px solid #eee',
              }}
            >
              <h4 style={{ margin: '0 0 6px', fontSize: 15, color: '#333' }}>Activities & access</h4>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#999', lineHeight: 1.45 }}>
                What the site is good for, how to get there, parking, boat, and walk to the entry. (Fill these fields in
                the dive spot database.)
              </p>

              {hasAccessExtras ? (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 6px', color: '#999', fontSize: 12 }}>Suitable for</p>
                    {spot.suitable_for && spot.suitable_for.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {spot.suitable_for.map((tag, i) => (
                          <span
                            key={`${tag}-${i}`}
                            style={{
                              padding: '4px 10px',
                              background: '#e6f7ff',
                              color: '#096dd9',
                              borderRadius: 6,
                              fontSize: 13,
                              border: '1px solid #91d5ff',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Not provided</p>
                        <p style={missingHintStyle}>
                          e.g. Snorkeling, Freediving, Spearfishing, Scuba — not listed for this site yet.
                        </p>
                      </>
                    )}
                  </div>

                  {spot.getting_there ? (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ margin: '0 0 6px', color: '#999', fontSize: 12 }}>Getting there</p>
                      <p style={accessBlockStyle}>{spot.getting_there}</p>
                    </div>
                  ) : null}

                  {spot.parking_location ? (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ margin: '0 0 6px', color: '#999', fontSize: 12 }}>Parking</p>
                      <p style={accessBlockStyle}>{spot.parking_location}</p>
                    </div>
                  ) : null}

                  {boatRequiredLabel(spot.boat_required) ? (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ margin: '0 0 6px', color: '#999', fontSize: 12 }}>Boat required?</p>
                      <p style={{ ...accessBlockStyle, marginBottom: 0 }}>{boatRequiredLabel(spot.boat_required)}</p>
                    </div>
                  ) : null}

                  {spot.parking_to_entry_walk ? (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ margin: '0 0 6px', color: '#999', fontSize: 12 }}>
                        Parking to water entry (walk / distance)
                      </p>
                      <p style={accessBlockStyle}>{spot.parking_to_entry_walk}</p>
                    </div>
                  ) : null}

                  {spot.access_notes ? (
                    <div>
                      <p style={{ margin: '0 0 6px', color: '#999', fontSize: 12 }}>Extra notes</p>
                      <p style={{ ...accessBlockStyle, marginBottom: 0 }}>{spot.access_notes}</p>
                    </div>
                  ) : null}

                  {!spot.getting_there &&
                    !spot.parking_location &&
                    !boatRequiredLabel(spot.boat_required) &&
                    !spot.parking_to_entry_walk &&
                    !spot.access_notes &&
                    spot.suitable_for &&
                    spot.suitable_for.length > 0 && (
                      <p style={{ ...missingHintStyle, marginTop: 8 }}>
                        Directions, parking, boat, and walk details are not filled in yet.
                      </p>
                    )}
                </>
              ) : (
                <div>
                  <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Not provided</p>
                  <p style={missingHintStyle}>
                    Add suitable activities (snorkel / freedive / spearfishing / scuba), driving directions, where to
                    park, whether a boat is needed, and how far to walk from the car to the entry — in DynamoDB fields:
                    suitable_for, getting_there, parking_location, boat_required (yes/no/optional),
                    parking_to_entry_walk, access_notes.
                  </p>
                </div>
              )}
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
                {conditions.visibility && (
                  <>
                    <div style={{ gridColumn: '1 / -1', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                      <p style={{ margin: '0 0 8px 0', color: '#999', fontSize: '12px', fontWeight: '600' }}>UNDERWATER VISIBILITY</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Visibility</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: conditions.visibility.color }}>
                          {conditions.visibility.visibility_meters}m
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: conditions.visibility.color }}>
                          {conditions.visibility.level}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Rating</p>
                      <p style={{ margin: 0, fontSize: '16px', color: conditions.visibility.color }}>
                        {'★'.repeat(conditions.visibility.rating)}{'☆'.repeat(5 - conditions.visibility.rating)}
                      </p>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Recommendation</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: '1.4' }}>
                        {conditions.visibility.recommendation}
                      </p>
                    </div>
                  </>
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
